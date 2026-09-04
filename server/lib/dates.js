function pad(n) { return n < 10 ? "0" + n : "" + n; }
function toISO(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parseISO(s) {
  const p = String(s).split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isValidISODate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseISO(s);
  return !isNaN(d.getTime()) && toISO(d) === s;
}

const { MAX_RANGE_DAYS, MAX_RECUR_WEEKS } = require("./permissions");

// Builds the list of ISO date strings for a single shift, a date range, or a
// weekly recurrence, mirroring the client-side logic from the original
// prototype so date-range/recurring registrations behave identically.
function buildDateSeries(startISO, mode, endISO) {
  if (!isValidISODate(startISO)) return { error: "Data inicial inválida." };
  const start = parseISO(startISO);

  if (mode === "range") {
    if (!isValidISODate(endISO)) return { error: "Data final inválida." };
    const end = parseISO(endISO);
    if (end < start) return { error: "A data final deve ser igual ou depois da data inicial." };
    const list = [];
    let cur = start, count = 0;
    while (cur <= end) {
      list.push(toISO(cur));
      cur = addDays(cur, 1);
      count++;
      if (count > MAX_RANGE_DAYS) return { error: `Período muito longo (máx. ${MAX_RANGE_DAYS} dias).` };
    }
    return { dates: list };
  }

  if (mode === "recurring") {
    if (!isValidISODate(endISO)) return { error: "Data limite da recorrência inválida." };
    const until = parseISO(endISO);
    if (until < start) return { error: "A data limite da recorrência deve ser igual ou depois da data inicial." };
    const list = [];
    let cur = start, count = 0;
    while (cur <= until) {
      list.push(toISO(cur));
      cur = addDays(cur, 7);
      count++;
      if (count > MAX_RECUR_WEEKS) return { error: `Recorrência muito longa (máx. ${MAX_RECUR_WEEKS} semanas).` };
    }
    return { dates: list };
  }

  return { dates: [startISO] };
}

module.exports = { pad, toISO, parseISO, addDays, isValidISODate, buildDateSeries };
