/**
 * Memory Assistant — Database Server
 * Reads and writes all user accounts and notes to db.json
 * Run with: node server.js  (or npm run server)
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;
const DB_FILE = path.join(__dirname, "db.json");

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.use(express.static(path.join(__dirname, "dist")));


/* ── Load / Save db.json ── */
function readDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { users: {}, notes: {} };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

/* ── Simple password hash (same as frontend) ── */
function simpleHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/* ────────────────────────────────────────
   ROUTES
──────────────────────────────────────── */

// Health check
app.get("/ping", (req, res) => res.json({ ok: true }));

// ── REGISTER ──
app.post("/register", (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name)
    return res.json({ ok: false, msg: "All fields are required." });

  const db = readDB();
  const key = username.toLowerCase().trim();

  if (db.users[key])
    return res.json({ ok: false, msg: "Username already taken. Please sign in." });

  db.users[key] = {
    username: key,
    name: name.trim(),
    hash: simpleHash(password),
    created: new Date().toISOString(),
  };

  db.notes[key] = [];   // empty notes array for new user
  writeDB(db);

  console.log(`✅ Registered: ${key}`);
  res.json({ ok: true, user: { username: key, name: name.trim() } });
});

// ── LOGIN ──
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ ok: false, msg: "Please fill in all fields." });

  const db = readDB();
  const key = username.toLowerCase().trim();
  const u = db.users[key];

  if (!u)
    return res.json({ ok: false, msg: "No account found. Please register first." });

  if (u.hash !== simpleHash(password))
    return res.json({ ok: false, msg: "Incorrect password." });

  console.log(`🔑 Logged in: ${key}`);
  res.json({ ok: true, user: { username: u.username, name: u.name } });
});

// ── GET NOTES ──
app.get("/notes/:username", (req, res) => {
  const db = readDB();
  const key = req.params.username.toLowerCase();
  res.json({ notes: db.notes[key] || [] });
});

// ── SAVE NOTES ──
app.post("/notes/:username", (req, res) => {
  const db = readDB();
  const key = req.params.username.toLowerCase();
  db.notes[key] = req.body.notes || [];
  writeDB(db);
  res.json({ ok: true });
});

// ── LIST ALL USERS (for debugging) ──
app.get("/users", (req, res) => {
  const db = readDB();
  const safeUsers = Object.values(db.users).map(u => ({
    username: u.username,
    name: u.name,
    created: u.created,
    noteCount: (db.notes[u.username] || []).length,
  }));
  res.json({ count: safeUsers.length, users: safeUsers });
});

const os = require("os");
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

app.listen(PORT, "0.0.0.0", () => {
  const ip = getLocalIP();
  console.log(`\n🧠 Memory Assistant Database Server`);
  console.log(`📦 Database file : db.json`);
  console.log(`🖥  PC access     : http://localhost:${PORT}`);
  console.log(`📱 Phone access   : http://${ip}:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /register     — create account`);
  console.log(`  POST /login        — sign in`);
  console.log(`  GET  /notes/:user  — load notes`);
  console.log(`  POST /notes/:user  — save notes`);
  console.log(`  GET  /users        — list all registered users`);
  console.log(`\n✅ Ready! Open http://localhost:3000 in your browser\n`);
});


app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});
