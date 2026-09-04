const { pool } = require("../db");

function toClientUser(row) {
  if (!row) return null;
  return {
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    active: row.active,
    viewOnly: row.view_only,
    hasPassword: !!row.password_hash,
  };
}

// Loads the current user (if any) fresh from the DB on every request, based
// only on the email stored in the session cookie. This means role/active/
// viewOnly changes made by an admin take effect immediately for that user,
// without them needing to log out and back in - and a deactivated user is
// kicked out on their very next request.
async function attachUser(req, res, next) {
  try {
    const email = req.session && req.session.email;
    if (!email) { req.user = null; return next(); }
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const row = rows[0];
    if (!row || row.active === false) {
      req.session.email = null;
      req.user = null;
      return next();
    }
    // Raw DB row uses snake_case columns; the shared permission helpers
    // (lib/permissions.js) and the rest of the app read camelCase fields
    // like `viewOnly`. Keep the raw row (created_by lookups, password_hash
    // for auth routes, etc.) but also alias the fields permission checks
    // need, so a mismatch here can't silently defeat an access restriction.
    req.user = Object.assign({}, row, {
      viewOnly: row.view_only,
      displayName: row.display_name,
    });
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Não autenticado." });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Não autenticado." });
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas administradores podem fazer isso." });
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin, toClientUser };
