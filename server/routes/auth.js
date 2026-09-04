const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { toClientUser } = require("../middleware/auth");

const router = express.Router();

function normEmail(e) { return String(e || "").trim().toLowerCase(); }

// Step 1 of login: does this email exist / is it active / does it already
// have a password (i.e. is this a first-access signup or a normal login)?
router.post("/check-email", async (req, res, next) => {
  try {
    const email = normEmail(req.body.email);
    if (!email || email.indexOf("@") < 0) return res.status(400).json({ error: "Informe um e-mail válido." });
    const { rows } = await pool.query("SELECT email, display_name, active, password_hash FROM users WHERE email = $1", [email]);
    const row = rows[0];
    if (!row || row.active === false) {
      return res.status(404).json({ error: "E-mail não encontrado ou inativo. Fale com um administrador." });
    }
    res.json({ email: row.email, displayName: row.display_name, firstAccess: !row.password_hash });
  } catch (err) { next(err); }
});

// First access: user sets their own password.
router.post("/signup", async (req, res, next) => {
  try {
    const email = normEmail(req.body.email);
    const password = String(req.body.password || "");
    if (password.length < 4) return res.status(400).json({ error: "A senha precisa ter ao menos 4 caracteres." });

    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const row = rows[0];
    if (!row || row.active === false) return res.status(404).json({ error: "E-mail não encontrado ou inativo." });
    if (row.password_hash) return res.status(409).json({ error: "Esta conta já tem senha. Faça login normalmente." });

    const hash = await bcrypt.hash(password, 10);
    const { rows: updated } = await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = now() WHERE email = $2 RETURNING *",
      [hash, email]
    );
    req.session.email = email;
    res.json({ user: toClientUser(updated[0]) });
  } catch (err) { next(err); }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = normEmail(req.body.email);
    const password = String(req.body.password || "");
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const row = rows[0];
    if (!row || row.active === false) return res.status(404).json({ error: "E-mail não encontrado ou inativo." });
    if (!row.password_hash) return res.status(409).json({ error: "Esta conta ainda não tem senha. Use o primeiro acesso." });

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Senha incorreta." });

    req.session.email = email;
    res.json({ user: toClientUser(row) });
  } catch (err) { next(err); }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// Used on page load to silently restore a persisted session.
router.get("/me", (req, res) => {
  res.json({ user: toClientUser(req.user) });
});

module.exports = router;
