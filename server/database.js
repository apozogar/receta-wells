const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./menu.db');

db.serialize(() => {
  // Crear tabla de recetas
  db.run(`CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT,
    slot TEXT,
    tags TEXT,
    cookidooId TEXT
  )`);

  // Crear tabla de calendario (guardamos el menú generado por fecha)
  db.run(`CREATE TABLE IF NOT EXISTS calendar (
    day INTEGER,
    month INTEGER,
    year INTEGER,
    lunch_recipe_id INTEGER,
    dinner_recipe_id INTEGER,
    PRIMARY KEY (day, month, year)
  )`);

  // Insertar recetas iniciales (si está vacía)
  db.get("SELECT count(*) as count FROM recipes", (err, row) => {
    if (row.count === 0) {
      const recipes = [
        { name: "Lentejas estofadas con verduras", type: "legumbres", slot: "lunch", tags: "HP", cookidooId: "r255618" },
        { name: "Garbanzos con espinacas y bacalao", type: "legumbres", slot: "lunch", tags: "HP", cookidooId: "" },
        { name: "Alubias blancas con almejas", type: "legumbres", slot: "lunch", tags: "Bajo Grasa", cookidooId: "" },
        { name: "Judías verdes + Huevo poché", type: "verduras", slot: "any", tags: "Cena Top", cookidooId: "" },
        { name: "Crema de calabacín (con queso batido)", type: "verduras", slot: "any", tags: "Ligero", cookidooId: "" },
        { name: "Menestra de verduras con jamón", type: "verduras", slot: "lunch", tags: "Vit", cookidooId: "" },
        { name: "Dorada a la sal (Varoma)", type: "pescado", slot: "any", tags: "Clean", cookidooId: "" },
        { name: "Merluza en salsa verde", type: "pescado", slot: "lunch", tags: "Prot", cookidooId: "" },
        { name: "Salmón vapor + trigueros", type: "pescado", slot: "dinner", tags: "Grasas", cookidooId: "" },
        { name: "Pasta integral boloñesa pavo", type: "pasta", slot: "lunch", tags: "Energía", cookidooId: "" },
        { name: "Zoodles (Calabacín) con gambas", type: "pasta", slot: "dinner", tags: "Low Carb", cookidooId: "" },
        { name: "Pollo al chilindrón", type: "carne", slot: "lunch", tags: "Clásico", cookidooId: "" },
        { name: "Solomillo cerdo mostaza", type: "carne", slot: "lunch", tags: "Gourmet", cookidooId: "" },
        { name: "Pavo estofado setas", type: "carne", slot: "any", tags: "Saciante", cookidooId: "" },
        { name: "Huevos rellenos atún (sin mayo)", type: "cena", slot: "dinner", tags: "Rápido", cookidooId: "" },
        { name: "Crema calabaza y jengibre", type: "cena", slot: "dinner", tags: "Detox", cookidooId: "" },
        { name: "Mejillones vapor picadillo", type: "cena", slot: "dinner", tags: "Varoma", cookidooId: "" },
        { name: "Tortilla francesa + Gazpacho", type: "cena", slot: "dinner", tags: "Express", cookidooId: "" },
        { name: "Revuelto setas y gambas", type: "cena", slot: "dinner", tags: "Prot", cookidooId: "" },
        { name: "Sepia plancha + Ensalada", type: "cena", slot: "dinner", tags: "Clean", cookidooId: "" },
        { name: "Lentejas curry y pollo", type: "legumbres", slot: "lunch", tags: "Exótico", cookidooId: "" },
        { name: "Vichyssoise ligera", type: "verduras", slot: "any", tags: "Clásico", cookidooId: "" },
        { name: "Coliflor ajoarriero", type: "verduras", slot: "dinner", tags: "Low Carb", cookidooId: "" },
        { name: "Marmitako de bonito", type: "pescado", slot: "lunch", tags: "Cuchara", cookidooId: "" },
        { name: "Calamares en su tinta", type: "pescado", slot: "lunch", tags: "Tradición", cookidooId: "" },
        { name: "Fideuá de marisco", type: "pasta", slot: "lunch", tags: "Top", cookidooId: "" },
        { name: "Carrilladas vino tinto", type: "carne", slot: "lunch", tags: "Tierno", cookidooId: "" },
        { name: "Pollo Tikka Masala", type: "carne", slot: "lunch", tags: "Especias", cookidooId: "" },
        { name: "Sopa Juliana", type: "cena", slot: "dinner", tags: "Detox", cookidooId: "" },
        { name: "Pastel calabacín y atún", type: "cena", slot: "dinner", tags: "Varoma", cookidooId: "" }
      ];

      const stmt = db.prepare("INSERT INTO recipes (name, type, slot, tags, cookidooId) VALUES (?, ?, ?, ?, ?)");
      recipes.forEach(r => stmt.run(r.name, r.type, r.slot, r.tags, r.cookidooId));
      stmt.finalize();
      console.log("Recetas iniciales insertadas.");
    }
  });
});

module.exports = db;
