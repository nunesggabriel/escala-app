const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const categories = require("../lib/categories");

const router = express.Router();
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function slugify(label) {
  return (
    String(label)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "categoria"
  );
}

// Any authenticated user can read the category list (needed for the legend
// and the shift form); only admins can change it.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    res.json({ categories: await categories.getCategories() });
  } catch (err) { next(err); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const label = String(req.body.label || "").trim();
    const color = String(req.body.color || "").trim();
    const presencial = req.body.presencial === true;
    if (!label) return res.status(400).json({ error: "Informe um nome para a categoria." });
    if (!HEX_RE.test(color)) return res.status(400).json({ error: "Escolha uma cor válida." });

    let key = slugify(label);
    const { rows: existing } = await pool.query("SELECT 1 FROM categories WHERE key = $1", [key]);
    if (existing[0]) key = key + "_" + Date.now().toString(36).slice(-4);

    const { rows: maxRow } = await pool.query("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM categories");
    const order = maxRow[0].n;

    const { rows } = await pool.query(
      "INSERT INTO categories (key, label, color, presencial, sort_order, active) VALUES ($1,$2,$3,$4,$5,true) RETURNING *",
      [key, label, color, presencial, order]
    );
    categories.invalidate();
    res.status(201).json({ category: categories.toClient(rows[0]) });
  } catch (err) { next(err); }
});

router.patch("/:key", requireAdmin, async (req, res, next) => {
  try {
    const fields = [];
    const values = [];
    let i = 1;
    if (typeof req.body.label === "string" && req.body.label.trim()) { fields.push(`label = $${i++}`); values.push(req.body.label.trim()); }
    if (typeof req.body.color === "string") {
      if (!HEX_RE.test(req.body.color)) return res.status(400).json({ error: "Cor inválida." });
      fields.push(`color = $${i++}`); values.push(req.body.color);
    }
    if (typeof req.body.presencial === "boolean") { fields.push(`presencial = $${i++}`); values.push(req.body.presencial); }
    if (typeof req.body.active === "boolean") { fields.push(`active = $${i++}`); values.push(req.body.active); }
    if (typeof req.body.order === "number") { fields.push(`sort_order = $${i++}`); values.push(req.body.order); }
    if (fields.length === 0) return res.status(400).json({ error: "Nada para atualizar." });

    fields.push("updated_at = now()");
    values.push(req.params.key);
    const { rows } = await pool.query(`UPDATE categories SET ${fields.join(", ")} WHERE key = $${i} RETURNING *`, values);
    if (!rows[0]) return res.status(404).json({ error: "Categoria não encontrada." });
    categories.invalidate();
    res.json({ category: categories.toClient(rows[0]) });
  } catch (err) { next(err); }
});

router.delete("/:key", requireAdmin, async (req, res, next) => {
  try {
    const { rows: inUse } = await pool.query("SELECT count(*)::int AS n FROM shifts WHERE category = $1", [req.params.key]);
    if (inUse[0].n > 0) {
      return res.status(409).json({
        error: `Não é possível remover: ${inUse[0].n} turno(s) já usam esta categoria. Desative-a em vez de remover.`,
      });
    }
    await pool.query("DELETE FROM categories WHERE key = $1", [req.params.key]);
    categories.invalidate();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
