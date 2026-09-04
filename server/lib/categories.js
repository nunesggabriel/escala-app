const { pool } = require("../db");

function toClient(row) {
  return {
    key: row.key,
    label: row.label,
    color: row.color,
    presencial: row.presencial,
    order: row.sort_order,
    active: row.active,
  };
}

// Small in-memory cache: categories change rarely and this is a single-node
// app, so a query per request would be wasteful. invalidate() is called
// after every write so the next read is always fresh.
let cache = null;

async function loadCategories() {
  const { rows } = await pool.query("SELECT * FROM categories ORDER BY sort_order ASC, label ASC");
  cache = rows.map(toClient);
  return cache;
}

async function getCategories() {
  if (!cache) await loadCategories();
  return cache;
}

async function getActiveKeys() {
  const cats = await getCategories();
  return cats.filter((c) => c.active !== false).map((c) => c.key);
}

async function isKnownKey(key) {
  const cats = await getCategories();
  return cats.some((c) => c.key === key);
}

function invalidate() {
  cache = null;
}

module.exports = { getCategories, getActiveKeys, isKnownKey, invalidate, toClient };
