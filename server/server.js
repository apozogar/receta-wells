const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('./database');
const db = require('./database');
const JWT_SECRET = db.JWT_SECRET || process.env.JWT_SECRET || 'change-me';

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// === AUTH MIDDLEWARE ===
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    } catch {}
  }
  next();
}

// === AUTH ENDPOINTS ===
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos: username, email, password' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const userResult = await query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [username, email, hash]
    );
    const userId = userResult.rows[0].id;

    const menuResult = await query(
      "INSERT INTO menus (name, owner_id) VALUES ($1, $2) RETURNING id",
      ['Mi Menú', userId]
    );
    const menuId = menuResult.rows[0].id;
    await query(
      "INSERT INTO user_menus (user_id, menu_id, role) VALUES ($1, $2, $3)",
      [userId, menuId, 'admin']
    );

    const token = jwt.sign({ userId, username, email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: userId, username, email }, menuId });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'El usuario o email ya existe' });
    }
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan campos: username, password' });
  }
  try {
    const { rows } = await query(
      "SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1",
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    const row = rows[0];
    if (!bcrypt.compareSync(password, row.password_hash)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    const token = jwt.sign(
      { userId: row.id, username: row.username, email: row.email },
      JWT_SECRET,
      { expiresIn: '30d' },
    );
    res.json({ token, user: { id: row.id, username: row.username, email: row.email } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT id, username, email, created_at FROM users WHERE id = $1",
      [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === MENUS ===
app.get('/api/menus', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT m.*, um.role FROM menus m
       JOIN user_menus um ON um.menu_id = m.id
       WHERE um.user_id = $1
       ORDER BY m.name`,
      [req.user.userId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/menus', authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Falta el nombre del menú' });
  try {
    const { rows } = await query(
      "INSERT INTO menus (name, owner_id) VALUES ($1, $2) RETURNING id",
      [name, req.user.userId]
    );
    const menuId = rows[0].id;
    await query(
      "INSERT INTO user_menus (user_id, menu_id, role) VALUES ($1, $2, $3)",
      [req.user.userId, menuId, 'admin']
    );
    res.json({ id: menuId, name, owner_id: req.user.userId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/menus/:id', authMiddleware, async (req, res) => {
  const { name } = req.body;
  try {
    const result = await query(
      "UPDATE menus SET name = $1 WHERE id = $2 AND owner_id = $3",
      [name, req.params.id, req.user.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Menú no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/menus/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      "DELETE FROM menus WHERE id = $1 AND owner_id = $2",
      [req.params.id, req.user.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Menú no encontrado' });
    await query("DELETE FROM user_menus WHERE menu_id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function getMenuIds(userId) {
  const { rows } = await query(
    "SELECT menu_id FROM user_menus WHERE user_id = $1",
    [userId]
  );
  return rows.map(r => r.menu_id);
}

// Obtener todas las recetas
app.get('/api/recipes', optionalAuth, async (req, res) => {
  const menuId = parseInt(req.query.menuId) || 1;
  try {
    if (req.user) {
      const ids = await getMenuIds(req.user.userId);
      if (!ids.includes(menuId)) {
        return res.status(403).json({ error: 'No tienes acceso a este menú' });
      }
    }
    const { rows } = await query(
      "SELECT * FROM recipes WHERE menu_id = $1 ORDER BY name",
      [menuId]
    );
    const recipes = rows.map(r => ({ ...r, tags: r.tags ? r.tags.split(',') : [] }));
    res.json(recipes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crear una receta
app.post('/api/recipes', authMiddleware, async (req, res) => {
  const { name, type, slot, tags, cookidooId } = req.body;
  if (!name || !type || !slot) {
    return res.status(400).json({ error: 'Faltan campos requeridos: name, type, slot' });
  }
  const menuId = req.body.menuId || parseInt(req.query.menuId) || 1;
  try {
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    const { rows } = await query(
      "INSERT INTO recipes (name, type, slot, tags, cookidooId, menu_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [name, type, slot, tagsStr, cookidooId || '', menuId]
    );
    res.json({ id: rows[0].id, name, type, slot, tags: tagsStr ? tagsStr.split(',') : [], cookidooId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar una receta
app.put('/api/recipes/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, type, slot, tags, cookidooId } = req.body;
  if (!name || !type || !slot) {
    return res.status(400).json({ error: 'Faltan campos requeridos: name, type, slot' });
  }
  try {
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    const result = await query(
      "UPDATE recipes SET name = $1, type = $2, slot = $3, tags = $4, cookidooId = $5 WHERE id = $6",
      [name, type, slot, tagsStr, cookidooId || '', id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Receta no encontrada' });
    res.json({ id: Number(id), name, type, slot, tags: tagsStr ? tagsStr.split(',') : [], cookidooId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar una receta
app.delete('/api/recipes/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query("DELETE FROM recipes WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Receta no encontrada' });
    res.json({ message: 'Receta eliminada' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Obtener calendario de un mes/año
app.get('/api/calendar', optionalAuth, async (req, res) => {
  const { month, year } = req.query;
  const menuId = parseInt(req.query.menuId) || 1;
  try {
    if (req.user) {
      const ids = await getMenuIds(req.user.userId);
      if (!ids.includes(menuId)) {
        return res.status(403).json({ error: 'No tienes acceso a este menú' });
      }
    }
    const { rows } = await query(
      "SELECT * FROM calendar WHERE month = $1 AND year = $2 AND menu_id = $3",
      [month, year, menuId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Guardar calendario (recibe un array de días)
app.post('/api/calendar', authMiddleware, async (req, res) => {
  const days = req.body;
  const menuId = req.query.menuId || 1;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const d of days) {
      if (d.day) {
        await client.query(
          `INSERT INTO calendar (day, month, year, lunch_recipe_id, dinner_recipe_id, menu_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (day, month, year, menu_id) DO UPDATE SET
             lunch_recipe_id = EXCLUDED.lunch_recipe_id,
             dinner_recipe_id = EXCLUDED.dinner_recipe_id`,
          [d.day, d.month, d.year, d.lunchId, d.dinnerId, menuId]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ message: "Calendario guardado" });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// === INGREDIENTES ===

// Obtener ingredientes de una receta
app.get('/api/recipes/:id/ingredients', optionalAuth, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT id, name, category FROM recipe_ingredients WHERE recipe_id = $1 ORDER BY id",
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Guardar ingredientes de una receta
app.post('/api/recipes/:id/ingredients', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { ingredients } = req.body;
  if (!Array.isArray(ingredients)) {
    return res.status(400).json({ error: 'ingredients debe ser un array de { name, category }' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("DELETE FROM recipe_ingredients WHERE recipe_id = $1", [id]);
    for (const ing of ingredients) {
      await client.query(
        "INSERT INTO recipe_ingredients (recipe_id, name, category) VALUES ($1, $2, $3)",
        [id, ing.name, ing.category || '']
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Ingredientes guardados', count: ingredients.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Scrape ingredientes desde Cookidoo
app.get('/api/recipes/:id/ingredients/scrape', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT cookidooId FROM recipes WHERE id = $1",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Receta no encontrada' });
    if (!rows[0].cookidooid) return res.status(400).json({ error: 'La receta no tiene cookidooId' });
    const response = await fetch(`https://cookidoo.es/recipes/recipe/es-ES/${rows[0].cookidooid}`);
    const html = await response.text();
    const matches = [...html.matchAll(/<span data-testid="ingredient-amount">.*?<\/span>\s*(?:<span[^>]*>([^<]+)<\/span>\s*)?<span[^>]*>([^<]+)<\/span>/gi)];
    const extracted = matches.map(m => ({ name: (m[2] || m[1] || '').trim(), category: '' })).filter(i => i.name);
    if (extracted.length === 0) {
      const fallback = [...html.matchAll(/(?:de\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s*(?:de\s+[a-záéíóúñ]+\s*[a-záéíóúñ]*)?)(?:\s*<\/span>|\s*<)/g)];
      extracted.push(...fallback.map(m => ({ name: m[1].trim(), category: '' })).filter(i => i.name && i.name.length > 3));
    }
    res.json({ ingredients: extracted });
  } catch (e) {
    res.status(500).json({ error: 'Error al scrapear: ' + e.message });
  }
});

// Obtener todos los ingredientes de las recetas del calendario de un mes
app.get('/api/ingredients/from-calendar', optionalAuth, async (req, res) => {
  const { month, year, menuId } = req.query;
  const mid = parseInt(menuId) || 1;
  try {
    const { rows } = await query(
      `SELECT DISTINCT ri.name, ri.category, r.name as recipe_name, r.type as recipe_type
       FROM recipe_ingredients ri
       JOIN calendar c ON (ri.recipe_id = c.lunch_recipe_id OR ri.recipe_id = c.dinner_recipe_id) AND c.menu_id = $1
       JOIN recipes r ON ri.recipe_id = r.id
       WHERE c.month = $2 AND c.year = $3
       ORDER BY ri.name`,
      [mid, month, year]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === MERCADONA ===

app.post('/api/mercadona/search', authMiddleware, async (req, res) => {
  const { query: searchQuery, warehouse = '146' } = req.body;
  if (!searchQuery) return res.status(400).json({ error: 'query es requerido' });
  try {
    const index = `products_prod_${warehouse}_es`;
    const algoliaRes = await fetch(`https://7uzjkl1dj0-dsn.algolia.net/1/indexes/${index}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Algolia-Application-Id': '7UZJKL1DJ0',
        'X-Algolia-API-Key': '9d8f2e39e90df472b4f2e559a116fe17',
      },
      body: JSON.stringify({ query: searchQuery, hitsPerPage: 5 }),
    });
    if (!algoliaRes.ok) return res.status(502).json({ error: 'Error en búsqueda Mercadona' });
    const data = await algoliaRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al buscar: ' + e.message });
  }
});

app.post('/api/mercadona/cart/add', authMiddleware, async (req, res) => {
  const { customerUuid, warehouse, accessToken, products } = req.body;
  if (!customerUuid || !warehouse || !accessToken || !Array.isArray(products)) {
    return res.status(400).json({ error: 'Faltan campos: customerUuid, warehouse, accessToken, products' });
  }
  const baseUrl = `https://tienda.mercadona.es/api`;
  try {
    const cartRes = await fetch(`${baseUrl}/customers/${customerUuid}/cart/?lang=es&wh=${warehouse}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!cartRes.ok) return res.status(502).json({ error: 'Error al obtener carrito' });
    const cart = await cartRes.json();
    const lines = cart.lines.map(l => ({
      quantity: l.quantity,
      product_id: l.product.id,
      sources: l.sources,
    }));
    products.forEach(p => {
      const existing = lines.find(l => l.product_id === p.id);
      if (existing) {
        existing.quantity += (p.quantity || 1);
        existing.sources.push('+NA');
      } else {
        lines.push({ quantity: p.quantity || 1, product_id: p.id, sources: ['+NA'] });
      }
    });
    const updateRes = await fetch(`${baseUrl}/customers/${customerUuid}/cart/?lang=es&wh=${warehouse}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ id: cart.id, version: cart.version, lines }),
    });
    if (!updateRes.ok) return res.status(502).json({ error: 'Error al actualizar carrito' });
    const updated = await updateRes.json();
    res.json({ message: 'Productos añadidos al carrito', products_count: updated.products_count });
  } catch (e) {
    res.status(500).json({ error: 'Error: ' + e.message });
  }
});

// === COOKIDOO ===

const CIAM_LOGIN_SRV_URL = 'https://ciam.prod.cookidoo.vorwerk-digital.com/login-srv/login';

async function getSettings(keys) {
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await query(
    `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
    keys
  );
  const map = {};
  rows.forEach(r => map[r.key] = r.value);
  return map;
}

let cookidooCookieJar = {};

function parseCookies(res) {
  const cookies = {};
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    setCookie.split(',').forEach(part => {
      const match = part.match(/^([^=]+)=([^;]+)/);
      if (match) cookies[match[1].trim()] = match[2].trim();
    });
  }
  return cookies;
}

function mergeCookies(jar, newCookies) {
  Object.assign(jar, newCookies);
}

function makeCookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function cookidooLogin(email, password) {
  const settings = await getSettings(['cookidoo_country', 'cookidoo_language']);
  const country = settings.cookidoo_country || 'es';
  const language = settings.cookidoo_language || 'es-ES';

  const loginUrl = `https://cookidoo.${country}/profile/${language}/login?redirectAfterLogin=%2Ffoundation%2F${language}%2Ffor-you`;
  const loginRes = await fetch(loginUrl, { redirect: 'manual' });
  let location = loginRes.headers.get('location');
  let redirectCount = 0;
  const maxRedirects = 10;

  while (location && redirectCount < maxRedirects) {
    redirectCount++;
    const redirectRes = await fetch(location.startsWith('http') ? location : `https://cookidoo.${country}${location}`, {
      redirect: 'manual',
      headers: location.includes('ciam') ? {} : { Cookie: makeCookieHeader(cookidooCookieJar) },
    });
    mergeCookies(cookidooCookieJar, parseCookies(redirectRes));
    location = redirectRes.headers.get('location');
    if (!location && redirectRes.status === 200) {
      const html = await redirectRes.text();
      const match = html.match(/<input[^>]*name=["']requestId["'][^>]*value=["']([^"']+)["']/);
      if (match) {
        const requestId = match[1];
        const loginData = new URLSearchParams({ requestId, username: email, password });
        const authRes = await fetch(CIAM_LOGIN_SRV_URL, {
          method: 'POST',
          redirect: 'manual',
          body: loginData.toString(),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        mergeCookies(cookidooCookieJar, parseCookies(authRes));
        let postLocation = authRes.headers.get('location');
        let postCount = 0;
        while (postLocation && postCount < maxRedirects) {
          postCount++;
          const postRes = await fetch(postLocation.startsWith('http') ? postLocation : `https://cookidoo.${country}${postLocation}`, {
            redirect: 'manual',
            headers: { Cookie: makeCookieHeader(cookidooCookieJar) },
          });
          mergeCookies(cookidooCookieJar, parseCookies(postRes));
          postLocation = postRes.headers.get('location');
        }
        if (!cookidooCookieJar['_oauth2_proxy'] && !cookidooCookieJar['v-authenticated']) {
          throw new Error('No se recibieron cookies de autenticación. Credenciales incorrectas.');
        }
        return;
      }
    }
  }
  throw new Error('No se pudo completar el login. Verifica tus credenciales.');
}

async function ensureCookidooAuth() {
  if (cookidooCookieJar['_oauth2_proxy'] && cookidooCookieJar['v-authenticated']) return;
  const settings = await getSettings(['cookidoo_email', 'cookidoo_password']);
  const email = settings.cookidoo_email;
  const password = settings.cookidoo_password;
  if (!email || !password) {
    throw new Error('Configura el email y contraseña de Cookidoo en Ajustes');
  }
  await cookidooLogin(email, password);
}

app.post('/api/cookidoo/login', async (req, res) => {
  try {
    let { email, password } = req.body || {};
    if (!email || !password) {
      const settings = await getSettings(['cookidoo_email', 'cookidoo_password']);
      email = settings.cookidoo_email;
      password = settings.cookidoo_password;
    }
    if (!email || !password) {
      return res.status(400).json({
        error: 'No hay credenciales. Guárdalas en Ajustes o pásalas en el body.',
      });
    }
    cookidooCookieJar = {};
    await cookidooLogin(email, password);
    res.json({ ok: true });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

app.get('/api/cookidoo/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Parámetro "q" requerido' });
  try {
    await ensureCookidooAuth();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  try {
    const settings = await getSettings(['cookidoo_country', 'cookidoo_language']);
    const country = settings.cookidoo_country || 'es';
    const language = settings.cookidoo_language || 'es-ES';
    const locale = language.split('-')[0];

    const searchUrl = `https://cookidoo.${country}/search/${locale}?query=${encodeURIComponent(q)}&pageSize=15`;
    const apiRes = await fetch(searchUrl, {
      headers: {
        Accept: 'application/json',
        Cookie: makeCookieHeader(cookidooCookieJar),
      },
    });
    if (!apiRes.ok) {
      const text = await apiRes.text();
      return res.status(502).json({ error: 'Error al buscar en Cookidoo', detail: text.slice(0, 200) });
    }
    const body = await apiRes.json();
    const hits = body.data || body.recipes || [];
    const results = hits.map((item) => ({
      name: item.title || item.name || '—',
      id: item.id,
    }));
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/cookidoo/add-to-shopping-list', async (req, res) => {
  const { recipeIds } = req.body;
  if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
    return res.status(400).json({ error: 'recipeIds debe ser un array no vacío' });
  }
  try {
    await ensureCookidooAuth();
    const settings = await getSettings(['cookidoo_country', 'cookidoo_language']);
    const country = settings.cookidoo_country || 'es';
    const language = settings.cookidoo_language || 'es-ES';
    const apiRes = await fetch(`https://cookidoo.${country}/shopping/${language}/recipes/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: makeCookieHeader(cookidooCookieJar),
      },
      body: JSON.stringify({ recipeIDs: recipeIds }),
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      return res.json({ ok: true, data });
    }
    if (apiRes.status === 401) {
      cookidooCookieJar = {};
      return res.status(401).json({ error: 'Sesión expirada. Vuelve a iniciar sesión.' });
    }
    const errText = await apiRes.text();
    res.status(502).json({ error: 'Error en Cookidoo', detail: errText.slice(0, 200) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/cookidoo/add-to-calendar', async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries debe ser un array no vacío de { cookidooId, date }' });
  }
  try {
    await ensureCookidooAuth();
    const settings = await getSettings(['cookidoo_country', 'cookidoo_language']);
    const country = settings.cookidoo_country || 'es';
    const language = settings.cookidoo_language || 'es-ES';

    const results = [];
    for (const entry of entries) {
      try {
        const apiRes = await fetch(`https://${country}.tmmobile.vorwerk-digital.com/planning/${language}/api/my-day`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(cookidooCookieJar['v-token']
              ? { Authorization: `Bearer ${cookidooCookieJar['v-token']}` }
              : { Cookie: makeCookieHeader(cookidooCookieJar) }),
          },
          body: JSON.stringify({ dayKey: entry.date, recipeIds: [entry.cookidooId] }),
        });
        mergeCookies(cookidooCookieJar, parseCookies(apiRes));
        if (!apiRes.ok) {
          const err = await apiRes.text();
          results.push({ cookidooId: entry.cookidooId, date: entry.date, ok: false, error: err.slice(0, 100) });
        } else {
          results.push({ cookidooId: entry.cookidooId, date: entry.date, ok: true });
        }
      } catch (e) {
        results.push({ cookidooId: entry.cookidooId, date: entry.date, ok: false, error: e.message });
      }
    }
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === SETTINGS ===

app.get('/api/settings', optionalAuth, async (req, res) => {
  const menuId = req.query.menuId || 1;
  try {
    const { rows } = await query(
      "SELECT key, value FROM settings WHERE menu_id = $1",
      [menuId]
    );
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/settings', authMiddleware, async (req, res) => {
  const { key, value } = req.body;
  const menuId = req.query.menuId || 1;
  if (!key) return res.status(400).json({ error: 'key requerido' });
  try {
    await query(
      `INSERT INTO settings (key, value, menu_id) VALUES ($1, $2, $3)
       ON CONFLICT (key, menu_id) DO UPDATE SET value = $2`,
      [key, value, menuId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/settings/batch', authMiddleware, async (req, res) => {
  const entries = req.body;
  const menuId = req.query.menuId || 1;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de { key, value }' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const entry of entries) {
      if (entry.key) {
        await client.query(
          `INSERT INTO settings (key, value, menu_id) VALUES ($1, $2, $3)
           ON CONFLICT (key, menu_id) DO UPDATE SET value = $2`,
          [entry.key, entry.value, menuId]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true, count: entries.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Serve built Angular app in production
function findDistPath() {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'menubox', 'browser'),
    path.join(__dirname, '..', 'dist', 'receta-wells', 'browser'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const distPath = findDistPath();
if (distPath) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
  console.log(`Sirviendo frontend desde ${distPath}`);
}

const listenPort = process.env.PORT || port;
app.listen(listenPort, () => {
  console.log(`Servidor corriendo en puerto ${listenPort}`);
});