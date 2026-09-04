const express = require("express");
const crypto = require("crypto");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { canCreateForGroup, canManageShift } = require("../lib/permissions");
const { buildDateSeries, isValidISODate } = require("../lib/dates");
const categories = require("../lib/categories");

const router = express.Router();

function toClient(row) {
  return {
    id: row.id,
    personName: row.person_name,
    category: row.category,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
    note: row.note || "",
    createdBy: row.created_by,
    groupId: row.group_id,
    groupType: row.group_type,
  };
}
function genId() { return Date.now().toString(36) + crypto.randomBytes(4).toString("hex"); }

async function personGroupFor(personName) {
  const { rows } = await pool.query('SELECT "group" FROM people WHERE name = $1 LIMIT 1', [personName]);
  return rows[0] ? rows[0].group : "geral";
}

// Everyone signed in can read the full shift list - the calendar itself is a
// shared team view. Editing/deleting is what's restricted by role.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM shifts ORDER BY date ASC");
    res.json({ shifts: rows.map(toClient) });
  } catch (err) { next(err); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const personName = String(req.body.personName || "").trim();
    const category = req.body.category;
    const note = String(req.body.note || "").trim();
    const date = req.body.date;
    const mode = req.body.mode === "range" || req.body.mode === "recurring" ? req.body.mode : null;
    const endDate = req.body.endDate;

    if (!personName) return res.status(400).json({ error: "Selecione a pessoa." });
    if (!category || !(await categories.getActiveKeys()).includes(category)) {
      return res.status(400).json({ error: "Categoria inválida." });
    }
    if (!isValidISODate(date)) return res.status(400).json({ error: "Informe a data." });

    const group = await personGroupFor(personName);
    if (!canCreateForGroup(req.user, group)) {
      return res.status(403).json({ error: "Você não tem permissão para lançar turnos para esta pessoa." });
    }

    const built = buildDateSeries(date, mode, endDate);
    if (built.error) return res.status(400).json({ error: built.error });

    const groupId = built.dates.length > 1 ? "g" + genId() : null;
    const groupType = groupId ? mode : null;
    const owner = req.user.email;

    const client = await pool.connect();
    const created = [];
    try {
      await client.query("BEGIN");
      for (const dt of built.dates) {
        const id = "s" + genId();
        const { rows } = await client.query(
          `INSERT INTO shifts (id, person_name, category, date, note, created_by, group_id, group_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [id, personName, category, dt, note, owner, groupId, groupType]
        );
        created.push(rows[0]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.status(201).json({ shifts: created.map(toClient) });
  } catch (err) { next(err); }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM shifts WHERE id = $1", [req.params.id]);
    const shift = rows[0];
    if (!shift) return res.status(404).json({ error: "Turno não encontrado." });

    const group = await personGroupFor(shift.person_name);
    if (!canManageShift(req.user, shift, group)) {
      return res.status(403).json({ error: "Você não tem permissão para editar este turno." });
    }

    const fields = [];
    const values = [];
    let i = 1;
    if (typeof req.body.personName === "string" && req.body.personName.trim()) { fields.push(`person_name = $${i++}`); values.push(req.body.personName.trim()); }
    if (typeof req.body.category === "string" && (await categories.getActiveKeys()).includes(req.body.category)) {
      fields.push(`category = $${i++}`); values.push(req.body.category);
    }
    if (isValidISODate(req.body.date)) { fields.push(`date = $${i++}`); values.push(req.body.date); }
    if (typeof req.body.note === "string") { fields.push(`note = $${i++}`); values.push(req.body.note.trim()); }
    if (fields.length === 0) return res.status(400).json({ error: "Nada para atualizar." });

    // If the person is changing, re-check permission against the new person's group too.
    if (typeof req.body.personName === "string" && req.body.personName.trim() && req.body.personName.trim() !== shift.person_name) {
      const newGroup = await personGroupFor(req.body.personName.trim());
      if (!canManageShift(req.user, shift, newGroup)) {
        return res.status(403).json({ error: "Você não tem permissão para mover este turno para esta pessoa." });
      }
    }

    fields.push("updated_at = now()");
    values.push(req.params.id);
    const { rows: updated } = await pool.query(`UPDATE shifts SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values);
    res.json({ shift: toClient(updated[0]) });
  } catch (err) { next(err); }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM shifts WHERE id = $1", [req.params.id]);
    const shift = rows[0];
    if (!shift) return res.status(404).json({ error: "Turno não encontrado." });
    const group = await personGroupFor(shift.person_name);
    if (!canManageShift(req.user, shift, group)) {
      return res.status(403).json({ error: "Você não tem permissão para excluir este turno." });
    }
    await pool.query("DELETE FROM shifts WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Delete every shift that belongs to the same range/recurrence group as this one.
router.delete("/group/:groupId/all", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM shifts WHERE group_id = $1", [req.params.groupId]);
    if (rows.length === 0) return res.status(404).json({ error: "Grupo não encontrado." });
    for (const shift of rows) {
      const group = await personGroupFor(shift.person_name);
      if (!canManageShift(req.user, shift, group)) {
        return res.status(403).json({ error: "Você não tem permissão para excluir todos os turnos deste grupo." });
      }
    }
    await pool.query("DELETE FROM shifts WHERE group_id = $1", [req.params.groupId]);
    res.json({ ok: true, count: rows.length });
  } catch (err) { next(err); }
});

// Bulk delete of arbitrary visible ids (used by "clear visible shifts", admin-only in the UI).
router.post("/bulk-delete", requireAuth, async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.filter((x) => typeof x === "string") : [];
    if (ids.length === 0) return res.status(400).json({ error: "Nenhum id informado." });
    const { rows } = await pool.query("SELECT * FROM shifts WHERE id = ANY($1)", [ids]);
    for (const shift of rows) {
      const group = await personGroupFor(shift.person_name);
      if (!canManageShift(req.user, shift, group)) {
        return res.status(403).json({ error: "Você não tem permissão para excluir alguns destes turnos." });
      }
    }
    await pool.query("DELETE FROM shifts WHERE id = ANY($1)", [ids]);
    res.json({ ok: true, count: rows.length });
  } catch (err) { next(err); }
});

module.exports = router;
