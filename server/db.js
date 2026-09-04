const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in (see README.md).");
  process.exit(1);
}

// Railway's internal DATABASE_URL normally does not need SSL; most external
// / public Postgres URLs (Railway's public proxy included) do. PGSSL=true
// forces it on; otherwise we guess from sslmode=require in the URL.
const wantsSsl =
  process.env.PGSSL === "true" ||
  /sslmode=require/.test(connectionString) ||
  process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString,
  ssl: wantsSsl ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error", err);
});

module.exports = { pool };
