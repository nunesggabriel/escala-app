const fs = require("fs");
const path = require("path");

// Applies every .sql file under /migrations, in filename order. Every
// migration in this project is written to be safe to run again (CREATE
// TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING, DROP CONSTRAINT IF EXISTS),
// so this can run every time the server boots without risk to existing data.
async function runMigrations(pool) {
  const dir = path.join(__dirname, "..", "..", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    console.log("Running migration:", file);
    await pool.query(sql);
  }
  console.log("Migrations complete.");
}

module.exports = { runMigrations };
