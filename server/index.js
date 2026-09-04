require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { pool } = require("./db");
const { attachUser } = require("./middleware/auth");
const { runMigrations } = require("./lib/runMigrations");
const { runSeed } = require("./lib/runSeed");

const authRoutes = require("./routes/auth");
const peopleRoutes = require("./routes/people");
const usersRoutes = require("./routes/users");
const shiftsRoutes = require("./routes/shifts");
const categoriesRoutes = require("./routes/categories");

async function main() {
  // Every migration and the seed are written to be safe to run again
  // (CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING, DROP CONSTRAINT IF
  // EXISTS) - so instead of asking you to run them by hand against Railway's
  // database (which runs into its own headaches: internal-vs-public URLs,
  // SSL, whatever shell you happen to run it from), the server just does it
  // itself on every boot, from inside Railway's own network where the
  // database is always reachable correctly. Safe locally too.
  console.log("Applying database migrations...");
  await runMigrations(pool);
  console.log("Applying seed data (only inserts rows that don't exist yet)...");
  await runSeed(pool);

  const app = express();
  app.set("trust proxy", 1); // needed behind Railway's proxy for secure cookies to work

  app.use(express.json());

  app.use(
    session({
      store: new pgSession({ pool, tableName: "session", createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || "dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        // Persist the login "until the user explicitly logs out", as requested -
        // a long-lived cookie rather than a session-only one.
        maxAge: 1000 * 60 * 60 * 24 * 365,
      },
    })
  );

  app.use(attachUser);

  app.use("/api/auth", authRoutes);
  app.use("/api/people", peopleRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/shifts", shiftsRoutes);
  app.use("/api/categories", categoriesRoutes);

  app.use(express.static(path.join(__dirname, "..", "public")));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Erro interno. Tente novamente." });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Escala de Trabalho rodando em http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
