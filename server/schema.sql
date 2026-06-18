-- PostgreSQL schema for MenuBox
-- Ejecutar: psql -U postgres -d menubox -f schema.sql

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menus (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_menus (
  user_id INTEGER NOT NULL REFERENCES users(id),
  menu_id INTEGER NOT NULL REFERENCES menus(id),
  role TEXT NOT NULL DEFAULT 'editor',
  PRIMARY KEY (user_id, menu_id)
);

CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  slot TEXT NOT NULL,
  tags TEXT DEFAULT '',
  cookidooId TEXT DEFAULT '',
  menu_id INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id),
  name TEXT NOT NULL,
  category TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS calendar (
  day INTEGER NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  lunch_recipe_id INTEGER,
  dinner_recipe_id INTEGER,
  menu_id INTEGER DEFAULT 1,
  UNIQUE(day, month, year, menu_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT NOT NULL,
  value TEXT DEFAULT '',
  menu_id INTEGER DEFAULT 1,
  PRIMARY KEY (key, menu_id)
);
