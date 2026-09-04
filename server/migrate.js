require("dotenv").config();
const { pool } = require("./db");
const { runMigrations } = require("./lib/runMigrations");

// Manual CLI entry point ("npm run migrate"). The server also runs this
// automatically on every boot (see server/index.js) - this file stays
// around for local use and for manually re-running against a database
// without starting the whole app.
runMigrations(pool)
  .then(() => pool.end())
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
