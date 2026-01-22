const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./database');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// Obtener todas las recetas
app.get('/api/recipes', (req, res) => {
  db.all("SELECT * FROM recipes", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // Convertir tags de string a array para el frontend
    const recipes = rows.map(r => ({ ...r, tags: r.tags ? r.tags.split(',') : [] }));
    res.json(recipes);
  });
});

// Obtener calendario de un mes/año
app.get('/api/calendar', (req, res) => {
  const { month, year } = req.query;
  db.all(
    "SELECT * FROM calendar WHERE month = ? AND year = ?",
    [month, year],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Guardar calendario (recibe un array de días)
app.post('/api/calendar', (req, res) => {
  const days = req.body; // Array de { day, month, year, lunchId, dinnerId }
  
  const stmt = db.prepare(`
    INSERT INTO calendar (day, month, year, lunch_recipe_id, dinner_recipe_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(day, month, year) DO UPDATE SET
    lunch_recipe_id=excluded.lunch_recipe_id,
    dinner_recipe_id=excluded.dinner_recipe_id
  `);

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    days.forEach(d => {
      if (d.day) {
        stmt.run(d.day, d.month, d.year, d.lunchId, d.dinnerId);
      }
    });
    db.run("COMMIT", (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Calendario guardado" });
    });
    stmt.finalize();
  });
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
