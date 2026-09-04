const express = require("express");
const crypto = require("crypto");
const { pool } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

function toClient(row) {
  return { id: row.id, name: row.name, group: row.group, active: row.active };
}
function genId() { return "p" + crypto.randomBytes(6).toString("hex"); }

// Any authenticated user can read the people list (needed to populate the
// "who is this shift for" picker); only admins can change it.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM people ORDER BY name ASC');
    res.json({ people: rows.map(toClient) });
  } catch (err) { next(err); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const group = req.body.group === "implantacao" ? "implantacao" : "geral";
    if (!name) return res.status(400).json({ error: "Informe um nome." });
    const id = genId();
    const { rows } = await pool.query(
      'INSERT INTO people (id, name, "group", active) VALUES ($1,$2,$3,true) RETURNING *',
      [id, name, group]
    );
    res.status(201).json({ person: toClient(rows[0]) });
  } catch (err) { next(err); }
});

router.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const fields = [];
    const values = [];
    let i = 1;
    if (typeof req.body.name === "string" && req.body.name.trim()) { fields.push(`name = $${i++}`); values.push(req.body.name.trim()); }
    if (req.body.group === "geral" || req.body.group === "implantacao") { fields.push(`"group" = $${i++}`); values.push(req.body.group); }
    if (typeof req.body.active === "boolean") { fields.push(`active = $${i++}`); values.push(req.body.active); }
    if (fields.length === 0) return res.status(400).json({ error: "Nada para atualizar." });
    fields.push(`updated_at = now()`);
    values.push(id);
    const { rows } = await pool.query(`UPDATE people SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values);
    if (!rows[0]) return res.status(404).json({ error: "Pessoa não encontrada." });
    res.json({ person: toClient(rows[0]) });
  } catch (err) { next(err); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    await pool.query("DELETE FROM people WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
