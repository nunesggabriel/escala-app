const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in (see README.md).");
  process.exit(1);
}

// Railway's internal DATABASE_URL (the one you get via a reference variable,
// hostname ending in .railway.internal) does NOT support SSL at all - asking
// for it fails with "The server does not support SSL connections". Most
// external/public Postgres URLs (Railway's public TCP proxy included) do
// require it. So: only turn SSL on when explicitly asked for (PGSSL=true) or
// when the connection string itself says sslmode=require - never infer it
// from NODE_ENV, since NODE_ENV=production says nothing about which
// DATABASE_URL is in use.
const wantsSsl =
  process.env.PGSSL === "true" ||
  /sslmode=require/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: wantsSsl ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error", err);
});

module.exports = { pool };
