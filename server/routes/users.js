const express = require("express");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

const ROLES = ["admin", "usuario", "implantacao"];

function toClient(row) {
  return {
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    active: row.active,
    viewOnly: row.view_only,
    hasPassword: !!row.password_hash,
  };
}
function normEmail(e) { return String(e || "").trim().toLowerCase(); }

// All user-management endpoints are admin-only: usuario/implantacao roles
// never get to see the full roster, per the app's permission model.
router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY display_name ASC");
    res.json({ users: rows.map(toClient) });
  } catch (err) { next(err); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const email = normEmail(req.body.email);
    const displayName = String(req.body.displayName || "").trim() || email.split("@")[0];
    const role = ROLES.includes(req.body.role) ? req.body.role : "usuario";
    if (!email || email.indexOf("@") < 0) return res.status(400).json({ error: "Informe um e-mail válido." });

    const { rows: existing } = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (existing[0]) return res.status(409).json({ error: "Este e-mail já está cadastrado." });

    const { rows } = await pool.query(
      "INSERT INTO users (email, display_name, role, active, view_only, password_hash) VALUES ($1,$2,$3,true,false,NULL) RETURNING *",
      [email, displayName, role]
    );
    res.status(201).json({ user: toClient(rows[0]) });
  } catch (err) { next(err); }
});

router.patch("/:email", requireAdmin, async (req, res, next) => {
  try {
    const email = normEmail(req.params.email);
    const fields = [];
    const values = [];
    let i = 1;
    if (typeof req.body.displayName === "string" && req.body.displayName.trim()) { fields.push(`display_name = $${i++}`); values.push(req.body.displayName.trim()); }
    if (ROLES.includes(req.body.role)) { fields.push(`role = $${i++}`); values.push(req.body.role); }
    if (typeof req.body.active === "boolean") { fields.push(`active = $${i++}`); values.push(req.body.active); }
    if (typeof req.body.viewOnly === "boolean") { fields.push(`view_only = $${i++}`); values.push(req.body.viewOnly); }
    if (req.body.resetPassword === true) { fields.push(`password_hash = NULL`); }
    if (fields.length === 0) return res.status(400).json({ error: "Nada para atualizar." });
    fields.push(`updated_at = now()`);
    values.push(email);
    const { rows } = await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE email = $${i} RETURNING *`, values);
    if (!rows[0]) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json({ user: toClient(rows[0]) });
  } catch (err) { next(err); }
});

router.delete("/:email", requireAdmin, async (req, res, next) => {
  try {
    await pool.query("DELETE FROM users WHERE email = $1", [normEmail(req.params.email)]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Lock/unlock every non-admin user's edit access at once.
router.post("/bulk-viewonly", requireAdmin, async (req, res, next) => {
  try {
    const flag = req.body.viewOnly === true;
    const { rows } = await pool.query(
      "UPDATE users SET view_only = $1, updated_at = now() WHERE role <> 'admin' RETURNING email",
      [flag]
    );
    res.json({ ok: true, count: rows.length });
  } catch (err) { next(err); }
});

module.exports = router;
