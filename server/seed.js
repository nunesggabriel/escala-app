require("dotenv").config();
const { pool } = require("./db");
const { runSeed } = require("./lib/runSeed");

// Manual CLI entry point ("npm run seed"). The server also runs this
// automatically on every boot (see server/index.js) - this file stays
// around for local use and for manually re-running against a database
// without starting the whole app.
runSeed(pool)
  .then(() => pool.end())
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
