// Seed data: the real team roster this app was built around (not just
// placeholder examples) - this is how the first admin accounts get into
// the `users` table at all, since there's no "become the first admin"
// flow other than an email already existing in the table.
//
// Every insert here uses ON CONFLICT DO NOTHING, so this is always safe to
// run again: it only ever adds rows that are missing, never touches or
// overwrites data that's already there.

function pad(n) { return n < 10 ? "0" + n : "" + n; }
function toISO(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d) {
  const r = new Date(d);
  const wd = r.getDay();
  const diff = wd === 0 ? -6 : 1 - wd;
  return addDays(r, diff);
}
function todayDate() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

const TODAY = todayDate();
const MON = startOfWeek(TODAY);
function d(offset) { return toISO(addDays(MON, offset)); }

const SEED_SHIFTS_RAW = [
  { id: "s01", personName: "Iasmin", category: "ferias", date: d(0) }, { id: "s02", personName: "Anna", category: "ferias", date: d(0) },
  { id: "s03", personName: "Essam", category: "chat", date: d(0) }, { id: "s04", personName: "Pablo", category: "chat", date: d(0) }, { id: "s05", personName: "Rafaela", category: "chat", date: d(0) },
  { id: "s06", personName: "Michel", category: "h22", date: d(0) }, { id: "s07", personName: "Juliano", category: "h22", date: d(0) }, { id: "s08", personName: "Yan", category: "h22", date: d(0) }, { id: "s09", personName: "Gui Dorneles", category: "h22", date: d(0) },
  { id: "s10", personName: "Gabriel Moraes", category: "homeoffice", date: d(0) }, { id: "s11", personName: "Luan", category: "homeoffice", date: d(0) }, { id: "s12", personName: "Davi", category: "homeoffice", date: d(0) },
  { id: "s13", personName: "Iasmin", category: "ferias", date: d(1) }, { id: "s14", personName: "Anna", category: "ferias", date: d(1) },
  { id: "s15", personName: "Marcos", category: "chat", date: d(1) }, { id: "s16", personName: "Lazaro", category: "chat", date: d(1) }, { id: "s17", personName: "Gabriel Moraes", category: "chat", date: d(1) },
  { id: "s18", personName: "Caio", category: "h22", date: d(1) }, { id: "s19", personName: "Roger", category: "h22", date: d(1) }, { id: "s20", personName: "Gabriel Ponciano", category: "h22", date: d(1) }, { id: "s21", personName: "Davi", category: "h22", date: d(1) }, { id: "s22", personName: "Paulo", category: "h22", date: d(1) },
  { id: "s23", personName: "Yan", category: "homeoffice", date: d(1) }, { id: "s24", personName: "Michel", category: "homeoffice", date: d(1) },
  { id: "s25", personName: "Iasmin", category: "ferias", date: d(2) },
  { id: "s26", personName: "Yan", category: "chat", date: d(2) }, { id: "s27", personName: "Gui Dorneles", category: "chat", date: d(2) }, { id: "s28", personName: "Luan", category: "chat", date: d(2) },
  { id: "s29", personName: "Lazaro", category: "h22", date: d(2) }, { id: "s30", personName: "Marcos", category: "h22", date: d(2) }, { id: "s31", personName: "Pablo", category: "h22", date: d(2) }, { id: "s32", personName: "Essam", category: "h22", date: d(2) },
  { id: "s33", personName: "Caio", category: "homeoffice", date: d(2) }, { id: "s34", personName: "Paulo", category: "homeoffice", date: d(2) }, { id: "s35", personName: "Roger", category: "homeoffice", date: d(2) },
  { id: "s36", personName: "Iasmin", category: "ferias", date: d(3) },
  { id: "s37", personName: "Roger", category: "chat", date: d(3) }, { id: "s38", personName: "Paulo", category: "chat", date: d(3) }, { id: "s39", personName: "Michel", category: "chat", date: d(3) },
  { id: "s40", personName: "Vitor", category: "h22", date: d(3) }, { id: "s41", personName: "Yan", category: "h22", date: d(3) }, { id: "s42", personName: "Luan", category: "h22", date: d(3) }, { id: "s43", personName: "Rafaela", category: "h22", date: d(3) }, { id: "s44", personName: "Gabriel Moraes", category: "h22", date: d(3) },
  { id: "s45", personName: "Davi", category: "homeoffice", date: d(3) }, { id: "s46", personName: "Lazaro", category: "homeoffice", date: d(3) },
  { id: "s47", personName: "Iasmin", category: "ferias", date: d(4) },
  { id: "s48", personName: "Gabriel Ponciano", category: "chat", date: d(4) }, { id: "s49", personName: "Anna", category: "chat", date: d(4) }, { id: "s50", personName: "Caio", category: "chat", date: d(4) },
  { id: "s51", personName: "Roger", category: "h22", date: d(4) }, { id: "s52", personName: "Essam", category: "h22", date: d(4) }, { id: "s53", personName: "Vitor", category: "h22", date: d(4) }, { id: "s54", personName: "Juliano", category: "h22", date: d(4) }, { id: "s55", personName: "Michel", category: "h22", date: d(4) },
  { id: "s56", personName: "Davi", category: "homeoffice", date: d(4) }, { id: "s57", personName: "Yan", category: "homeoffice", date: d(4) }, { id: "s58", personName: "Marcos", category: "homeoffice", date: d(4) },
  { id: "s59", personName: "Iasmin", category: "ferias", date: d(5) }, { id: "s60", personName: "Paulo", category: "plantao", date: d(5) },
  { id: "s61", personName: "Iasmin", category: "ferias", date: d(6) },
];

const SEED_PEOPLE_NAMES = ["Anna", "Caio", "Danilo", "Davi", "Essam", "Gabriel Moraes", "Gabriel Nunes", "Gabriel Ponciano", "Gui Braun", "Gui Dorneles", "Iasmin", "Juliano", "Lazaro", "Luan", "Luna", "Marcos", "Michel", "Pablo", "Paulo", "Rafaela", "Roger", "Vitor", "Yan"];
const SEED_PEOPLE = SEED_PEOPLE_NAMES.map((n, i) => ({ id: "p" + (i + 1), name: n, group: "geral", active: true }))
  .concat([
    { id: "pi1", name: "Mariana Alves Dutra", group: "implantacao", active: true },
    { id: "pi2", name: "Leonardo Azevedo", group: "implantacao", active: true },
    { id: "pi3", name: "Guilherme Klippel", group: "implantacao", active: true },
    { id: "pi4", name: "Anderson Costa", group: "implantacao", active: true },
  ]);

const SEED_USERS = [
  { email: "gabriel.nunes@serverinfo.com.br", displayName: "Gabriel Nunes", role: "admin" },
  { email: "gabriel.criabitat@gmail.com", displayName: "Gabriel", role: "admin" },
  { email: "annae.serverinfo@gmail.com", displayName: "Anna E.", role: "usuario" },
  { email: "roger.cassol@serverinfo.com.br", displayName: "Roger Cassol", role: "usuario" },
  { email: "rafaela.silva@serverinfo.com.br", displayName: "Rafaela Silva", role: "usuario" },
  { email: "michel.canabarro@serverinfo.com.br", displayName: "Michel Canabarro", role: "usuario" },
  { email: "yan.rocha@serverinfo.com.br", displayName: "Yan Rocha", role: "usuario" },
  { email: "gabriel.ponciano@serverinfo.com.br", displayName: "Gabriel Ponciano", role: "usuario" },
  { email: "gabriel.moraes@serverinfo.com.br", displayName: "Gabriel Moraes", role: "usuario" },
  { email: "vitor.santos@serverinfo.com.br", displayName: "Vitor Santos", role: "usuario" },
  { email: "luan.duprat@serverinfo.com.br", displayName: "Luan Duprat", role: "usuario" },
  { email: "paulo.maciel@serverinfo.com.br", displayName: "Paulo Maciel", role: "usuario" },
  { email: "juliano.cerveira@serverinfo.com.br", displayName: "Juliano Cerveira", role: "usuario" },
  { email: "caio.oliveira@serverinfo.com.br", displayName: "Caio Oliveira", role: "usuario" },
  { email: "davi.chassot@serverinfo.com.br", displayName: "Davi Chassot", role: "usuario" },
  { email: "pablo.scherer@serverinfo.com.br", displayName: "Pablo Scherer", role: "usuario" },
  { email: "guilherme.dorneles@serverinfo.com.br", displayName: "Guilherme Dorneles", role: "usuario" },
  { email: "essam.borges@serverinfo.com.br", displayName: "Essam Borges", role: "usuario" },
  { email: "marcos.beck@serverinfo.com.br", displayName: "Marcos Beck", role: "usuario" },
  { email: "iasmin.saldanha@serverinfo.com.br", displayName: "Iasmin Saldanha", role: "usuario" },
  { email: "anna.moura@serverinfo.com.br", displayName: "Anna Moura", role: "usuario" },
  { email: "lazaro.freiry@serverinfo.com.br", displayName: "Lazaro Freiry", role: "usuario" },
  { email: "mariana.alv.dutra@gmail.com", displayName: "Mariana Alves Dutra", role: "implantacao" },
  { email: "marianalvesdutra@gmail.com", displayName: "Mariana A. Dutra", role: "implantacao" },
  { email: "leonardo.azevedo@serverinfo.com.br", displayName: "Leonardo Azevedo", role: "implantacao" },
  { email: "guilherme.klippel@serverinfo.com.br", displayName: "Guilherme Klippel", role: "implantacao" },
  { email: "anderson.costa@serverinfo.com.br", displayName: "Anderson Costa", role: "implantacao" },
  { email: "mariana.dutra@serverinfo.com.br", displayName: "Mariana Dutra", role: "implantacao" },
];

async function runSeed(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existingUsers } = await client.query("SELECT count(*)::int AS n FROM users");
    const { rows: existingPeople } = await client.query("SELECT count(*)::int AS n FROM people");
    const { rows: existingShifts } = await client.query("SELECT count(*)::int AS n FROM shifts");

    if (existingUsers[0].n > 0 || existingPeople[0].n > 0 || existingShifts[0].n > 0) {
      console.log("Database already has data (users=%d, people=%d, shifts=%d). Only inserting rows that are still missing.", existingUsers[0].n, existingPeople[0].n, existingShifts[0].n);
    }

    for (const u of SEED_USERS) {
      await client.query(
        `INSERT INTO users (email, display_name, role, active, view_only, password_hash)
         VALUES ($1,$2,$3,true,false,NULL)
         ON CONFLICT (email) DO NOTHING`,
        [u.email, u.displayName, u.role]
      );
    }

    for (const p of SEED_PEOPLE) {
      await client.query(
        `INSERT INTO people (id, name, "group", active) VALUES ($1,$2,$3,true)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.group]
      );
    }

    for (const s of SEED_SHIFTS_RAW) {
      await client.query(
        `INSERT INTO shifts (id, person_name, category, date, note, created_by, group_id, group_type)
         VALUES ($1,$2,$3,$4,'',NULL,NULL,NULL)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.personName, s.category, s.date]
      );
    }

    await client.query("COMMIT");
    console.log("Seed complete: %d users, %d people, %d shifts (existing rows preserved, only missing ones inserted).", SEED_USERS.length, SEED_PEOPLE.length, SEED_SHIFTS_RAW.length);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { runSeed };
