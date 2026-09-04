require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { pool } = require("./db");
const { attachUser } = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const peopleRoutes = require("./routes/people");
const usersRoutes = require("./routes/users");
const shiftsRoutes = require("./routes/shifts");
const categoriesRoutes = require("./routes/categories");

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
