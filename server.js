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
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
app.post("/register", async (req, res) => {
  const { username, password, name } = req.body;

  if (!username || !password || !name) {
    return res.json({ ok: false, msg: "All fields are required." });
  }

  const key = username.toLowerCase().trim();

  const { data: existing, error: findError } = await supabase
    .from("users")
    .select("username")
    .eq("username", key)
    .maybeSingle();

  if (findError) {
    return res.json({ ok: false, msg: findError.message });
  }

  if (existing) {
    return res.json({ ok: false, msg: "Username already taken. Please sign in." });
  }

  const user = {
    username: key,
    name: name.trim(),
    hash: simpleHash(password),
    created: new Date().toISOString()
  };

  const { error } = await supabase.from("users").insert(user);

  if (error) {
    return res.json({ ok: false, msg: error.message });
  }

  res.json({ ok: true, user: { username: key, name: name.trim() } });
});


// ── LOGIN ──
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ ok: false, msg: "Please fill in all fields." });
  }

  const key = username.toLowerCase().trim();

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", key)
    .maybeSingle();

  if (error) {
    return res.json({ ok: false, msg: error.message });
  }

  if (!user) {
    return res.json({ ok: false, msg: "No account found. Please register first." });
  }

  if (user.hash !== simpleHash(password)) {
    return res.json({ ok: false, msg: "Incorrect password." });
  }

  res.json({ ok: true, user: { username: user.username, name: user.name } });
});


// ── GET NOTES ──
app.post("/notes/:username", async (req, res) => {
  const key = req.params.username.toLowerCase();
  const notes = req.body.notes || [];

  const { error: deleteError } = await supabase
    .from("notes")
    .delete()
    .eq("username", key);

  if (deleteError) {
    return res.json({ ok: false, msg: deleteError.message });
  }

  if (notes.length > 0) {
    const rows = notes.map((note) => ({
      ...note,
      username: key
    }));

    const { error: insertError } = await supabase
      .from("notes")
      .insert(rows);

    if (insertError) {
      return res.json({ ok: false, msg: insertError.message });
    }
  }

  res.json({ ok: true });
});



// ── LIST ALL USERS (for debugging) ──
app.get("/users", async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("username, name, created");

  if (error) {
    return res.json({ count: 0, users: [], error: error.message });
  }

  res.json({ count: data.length, users: data });
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

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

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

