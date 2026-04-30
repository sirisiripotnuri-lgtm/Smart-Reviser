import { useState, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

/* ─── Constants ─── */
const INTERVALS = [1, 3, 7, 15];
const VIEWS = { DASHBOARD: "dashboard", ADD: "add", REVIEW: "review", PROGRESS: "progress", ALARMS: "alarms" };

/* ─── Helpers ─── */
const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
const toDateStr = (d) => new Date(d).toISOString().split("T")[0];
const todayStr = () => toDateStr(new Date());
const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtDateFull = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const uid = () => Math.random().toString(36).slice(2, 10);

/* ─── Storage (localStorage — truly permanent across all refreshes) ─── */
function loadData(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
function saveData(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function deleteKey(key) {
  try { localStorage.removeItem(key); } catch {}
}

/* ─── Auth Helpers ─── */
function simpleHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}
const USERS_KEY = "ma_users";
const SESSION_KEY = "ma_session";
function getUsers() { return loadData(USERS_KEY) || {}; }
function saveUsers(u) { saveData(USERS_KEY, u); }
function registerUser(username, password, name) {
  const users = getUsers();
  if (users[username.toLowerCase()]) return { ok: false, msg: "Username already taken." };
  users[username.toLowerCase()] = { username: username.toLowerCase(), name, hash: simpleHash(password), created: new Date().toISOString() };
  saveUsers(users);
  return { ok: true, user: users[username.toLowerCase()] };
}
function loginUser(username, password) {
  const users = getUsers();
  const u = users[username.toLowerCase()];
  if (!u) return { ok: false, msg: "No account found. Please register." };
  if (u.hash !== simpleHash(password)) return { ok: false, msg: "Incorrect password." };
  return { ok: true, user: u };
}
function notesKey(username) { return `ma_notes_${username}`; }

/* ─── Colors / Design Tokens ─── */
const C = {
  bg: "#0d1117",
  bgCard: "#161b22",
  bgHover: "#1c2230",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",
  teal: "#2dd4bf",
  tealDark: "#0f766e",
  tealSoft: "rgba(45,212,191,0.12)",
  amber: "#f59e0b",
  amberSoft: "rgba(245,158,11,0.12)",
  red: "#f87171",
  redSoft: "rgba(248,113,113,0.12)",
  green: "#4ade80",
  greenSoft: "rgba(74,222,128,0.12)",
  purple: "#a78bfa",
  purpleSoft: "rgba(167,139,250,0.12)",
  text1: "#e6edf3",
  text2: "#8b949e",
  text3: "#484f58",
};

/* ─── Micro Components ─── */
const Badge = ({ children, color = C.teal, bg }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", padding: "2px 8px",
    borderRadius: 99, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
    color, background: bg || color + "22", border: `1px solid ${color}44`,
  }}>{children}</span>
);

const Btn = ({ children, onClick, primary, danger, small, full, disabled, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: small ? "6px 14px" : "10px 20px",
    borderRadius: 8, fontWeight: 600, fontSize: small ? 12 : 14, cursor: disabled ? "not-allowed" : "pointer",
    border: primary ? "none" : danger ? `1px solid ${C.red}44` : `1px solid ${C.borderStrong}`,
    background: primary ? `linear-gradient(135deg, ${C.teal}, ${C.tealDark})` : danger ? C.redSoft : "transparent",
    color: primary ? "#0d1117" : danger ? C.red : C.text1,
    width: full ? "100%" : "auto", opacity: disabled ? 0.5 : 1,
    transition: "all 0.15s", ...style,
  }}>{children}</button>
);

const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{
    background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: "20px", cursor: onClick ? "pointer" : "default",
    transition: "border-color 0.2s", ...style,
  }}
    onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = C.borderStrong)}
    onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = C.border)}
  >{children}</div>
);

const StatCard = ({ label, value, color = C.teal, icon }) => (
  <Card style={{ textAlign: "center", padding: "16px 12px" }}>
    <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
    <div style={{ fontSize: 12, color: C.text2, marginTop: 4, fontWeight: 500 }}>{label}</div>
  </Card>
);

const Chip = ({ label, onRemove }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
    borderRadius: 99, background: C.tealSoft, color: C.teal,
    fontSize: 12, fontWeight: 600, border: `1px solid ${C.teal}33`,
  }}>
    {label}
    {onRemove && <span style={{ cursor: "pointer", opacity: 0.7 }} onClick={onRemove}>×</span>}
  </span>
);

const ProgressBar = ({ value, max, color = C.teal, height = 6 }) => (
  <div style={{ height, background: C.border, borderRadius: 99, overflow: "hidden" }}>
    <div style={{
      height: "100%", width: `${Math.min(100, (value / Math.max(max, 1)) * 100)}%`,
      background: color, borderRadius: 99, transition: "width 0.5s ease",
    }} />
  </div>
);

/* ─── Delete Button with inline confirm ─── */
const DeleteBtn = ({ onConfirm }) => {
  const [confirming, setConfirming] = useState(false);
  if (confirming) return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={e => e.stopPropagation()}>
      <span style={{ fontSize: 11, color: C.text2, whiteSpace: "nowrap" }}>Delete?</span>
      <button onClick={() => { onConfirm(); setConfirming(false); }} style={{
        padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
        background: C.redSoft, border: `1px solid ${C.red}44`, color: C.red, cursor: "pointer",
      }}>Yes</button>
      <button onClick={() => setConfirming(false)} style={{
        padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
        background: "transparent", border: `1px solid ${C.border}`, color: C.text2, cursor: "pointer",
      }}>No</button>
    </div>
  );
  return (
    <button onClick={e => { e.stopPropagation(); setConfirming(true); }} title="Delete note" style={{
      background: "transparent", border: "1px solid transparent", borderRadius: 6,
      color: C.text3, cursor: "pointer", padding: "4px 7px", fontSize: 14, lineHeight: 1,
      transition: "all 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.color = C.red; e.currentTarget.style.borderColor = C.red + "44"; e.currentTarget.style.background = C.redSoft; }}
      onMouseLeave={e => { e.currentTarget.style.color = C.text3; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; }}
    >✕</button>
  );
};

/* ─── Auth Screen ─── */
const AuthScreen = ({ onAuth }) => {
  const [tab, setTab] = useState("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
    borderRadius: 10, padding: "12px 16px", color: C.text1, fontSize: 14,
    outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.2s",
  };

  const handleSubmit = () => {
    setError(""); setLoading(true);
    if (!username.trim() || !password.trim()) { setError("Please fill in all fields."); setLoading(false); return; }
    if (tab === "register" && !name.trim()) { setError("Please enter your name."); setLoading(false); return; }
    if (tab === "register" && password.length < 6) { setError("Password must be at least 6 characters."); setLoading(false); return; }
    const result = tab === "login"
      ? loginUser(username.trim(), password)
      : registerUser(username.trim(), password, name.trim());
    if (!result.ok) { setError(result.msg); setLoading(false); return; }
    // ✅ Save session key — permanent in localStorage
    saveData(SESSION_KEY, result.user.username);
    onAuth(result.user);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', -apple-system, sans-serif", padding: 20,
    }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        input::placeholder { color: ${C.text3}; }
      `}</style>

      {/* Background blobs */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${C.teal}18 0%, transparent 70%)` }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${C.purple}15 0%, transparent 70%)` }} />
      </div>

      <div style={{ width: "100%", maxWidth: 420, animation: "fadeIn 0.5s ease", position: "relative" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${C.teal}, ${C.purple})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, boxShadow: `0 0 40px ${C.teal}44`,
            animation: "float 3s ease-in-out infinite",
          }}>◈</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text1, letterSpacing: "-0.5px" }}>Memory Assistant</div>
          <div style={{ fontSize: 13, color: C.text2, marginTop: 6 }}>Your personal spaced repetition system</div>
        </div>

        {/* Card */}
        <div style={{
          background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 20,
          padding: "32px", boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
        }}>
          {/* Tabs */}
          <div style={{ display: "flex", background: C.bg, borderRadius: 10, padding: 4, marginBottom: 28 }}>
            {[["login","Sign In"], ["register","Create Account"]].map(([id, label]) => (
              <button key={id} onClick={() => { setTab(id); setError(""); }} style={{
                flex: 1, padding: "9px", borderRadius: 7, fontWeight: 600, fontSize: 13,
                cursor: "pointer", border: "none", transition: "all 0.2s",
                background: tab === id ? C.bgCard : "transparent",
                color: tab === id ? C.text1 : C.text2,
                boxShadow: tab === id ? "0 1px 8px rgba(0,0,0,0.3)" : "none",
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {tab === "register" && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6, letterSpacing: "0.06em" }}>FULL NAME</label>
                <input style={inputStyle} placeholder="e.g. Alex Kumar" value={name}
                  onChange={e => setName(e.target.value)}
                  onFocus={e => e.target.style.borderColor = C.teal}
                  onBlur={e => e.target.style.borderColor = C.border} />
              </div>
            )}

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6, letterSpacing: "0.06em" }}>USERNAME</label>
              <input style={inputStyle} placeholder="e.g. alexkumar" value={username}
                onChange={e => setUsername(e.target.value)}
                onFocus={e => e.target.style.borderColor = C.teal}
                onBlur={e => e.target.style.borderColor = C.border}
                onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6, letterSpacing: "0.06em" }}>PASSWORD</label>
              <div style={{ position: "relative" }}>
                <input style={{ ...inputStyle, paddingRight: 44 }} placeholder={tab === "register" ? "Min. 6 characters" : "Your password"}
                  type={showPass ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={e => e.target.style.borderColor = C.teal}
                  onBlur={e => e.target.style.borderColor = C.border}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()} />
                <button onClick={() => setShowPass(s => !s)} style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: C.text3, fontSize: 16,
                }}>{showPass ? "🙈" : "👁"}</button>
              </div>
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 14, padding: "10px 14px", borderRadius: 8,
              background: C.redSoft, border: `1px solid ${C.red}44`,
              color: C.red, fontSize: 13, fontWeight: 500,
            }}>⚠ {error}</div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{
            marginTop: 22, width: "100%", padding: "13px",
            borderRadius: 10, border: "none", cursor: loading ? "wait" : "pointer",
            background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`,
            color: "#0d1117", fontWeight: 700, fontSize: 15, letterSpacing: "0.02em",
            boxShadow: `0 4px 24px ${C.teal}44`, transition: "opacity 0.2s",
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "Please wait…" : tab === "login" ? "Sign In →" : "Create Account →"}
          </button>

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: C.text2 }}>
            {tab === "login" ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setTab(tab === "login" ? "register" : "login"); setError(""); }} style={{
              background: "none", border: "none", color: C.teal, cursor: "pointer", fontWeight: 600, fontSize: 13,
            }}>{tab === "login" ? "Register" : "Sign In"}</button>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: C.text3 }}>
          Your data is stored locally on this device only.
        </div>
      </div>
    </div>
  );
};

/* ─── Note Detail Modal ─── */
const NoteDetailModal = ({ note, onClose }) => {
  if (!note) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.bgCard, border: `1px solid ${C.borderStrong}`, borderRadius: 16,
        padding: 28, maxWidth: 620, width: "100%", maxHeight: "80vh",
        overflowY: "auto", animation: "fadeIn 0.2s ease",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text1, marginBottom: 6, lineHeight: 1.3 }}>
              {note.title || "Untitled Note"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {note.tags?.map(t => <Chip key={t} label={t} />)}
              <Badge color={C.purple}>Level {note.interval_level + 1}/4</Badge>
              {note.status === "mastered" && <Badge color={C.green}>Mastered ✓</Badge>}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.text2, cursor: "pointer", padding: "6px 12px", fontSize: 18, lineHeight: 1, flexShrink: 0,
          }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
          Created {fmtDateFull(note.created_at)} · Next review: {note.status === "mastered" ? "Mastered!" : fmtDate(note.next_review)}
        </div>
        <div style={{
          background: C.bgHover, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18,
          fontSize: 14, color: C.text1, lineHeight: 1.75, whiteSpace: "pre-wrap",
        }}>{note.content}</div>
        {note.voiceNote && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 8, letterSpacing: "0.05em" }}>🎤 VOICE NOTE</div>
            <audio controls src={note.voiceNote} style={{ width: "100%", accentColor: C.teal }} />
          </div>
        )}
        {note.review_history?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 8, letterSpacing: "0.05em" }}>REVIEW HISTORY ({note.review_history.length})</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {note.review_history.map((r, i) => (
                <div key={i} style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: r.remembered ? C.greenSoft : C.redSoft,
                  color: r.remembered ? C.green : C.red,
                  border: `1px solid ${r.remembered ? C.green : C.red}33`,
                }}>
                  {r.remembered ? "✓" : "✗"} {fmtDate(r.date)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Sidebar ─── */
const NAV_ITEMS = [
  { id: VIEWS.DASHBOARD, icon: "⬡", label: "Dashboard" },
  { id: VIEWS.ADD, icon: "✦", label: "Add Note" },
  { id: VIEWS.REVIEW, icon: "↻", label: "Review" },
  { id: VIEWS.PROGRESS, icon: "▲", label: "Progress" },
  { id: VIEWS.ALARMS, icon: "🔔", label: "Alarms" },
];

const Sidebar = ({ view, setView, dueCount, user, onLogout, notes }) => {
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState(null);
  const today = todayStr();

  const filteredNotes = notes.filter(n =>
    !noteSearch || (n.title + n.content + (n.tags||[]).join(" ")).toLowerCase().includes(noteSearch.toLowerCase())
  ).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <>
      {selectedNote && <NoteDetailModal note={selectedNote} onClose={() => setSelectedNote(null)} />}
      <nav style={{
        width: notesOpen ? 280 : 220, minHeight: "100vh", background: C.bgCard,
        borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column",
        padding: "0 0 24px", flexShrink: 0, transition: "width 0.25s ease",
      }}>
        <div style={{ padding: "28px 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${C.teal}, ${C.purple})`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>◈</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text1 }}>Memory</div>
              <div style={{ fontWeight: 400, fontSize: 11, color: C.text2 }}>Assistant</div>
            </div>
          </div>
        </div>

        {/* User card */}
        {user && (
          <div style={{ margin: "0 12px 16px", padding: "12px", borderRadius: 10, background: C.bgHover, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 99, flexShrink: 0,
                background: `linear-gradient(135deg, ${C.purple}, ${C.teal})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700, color: "#0d1117",
              }}>{(user.name || user.username)[0].toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.name || user.username}
                </div>
                <div style={{ fontSize: 11, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  @{user.username}
                </div>
              </div>
            </div>
            <button onClick={onLogout} style={{
              marginTop: 10, width: "100%", padding: "6px", borderRadius: 7, fontSize: 11, fontWeight: 600,
              cursor: "pointer", background: "transparent", border: `1px solid ${C.border}`, color: C.text2,
              transition: "all 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.red + "55"; e.currentTarget.style.color = C.red; e.currentTarget.style.background = C.redSoft; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text2; e.currentTarget.style.background = "transparent"; }}
            >Sign Out</button>
          </div>
        )}

        <div style={{ flex: 1, padding: "0 12px", overflowY: "auto", minHeight: 0 }}>
          {NAV_ITEMS.map(item => {
            const active = view === item.id;
            return (
              <div key={item.id} onClick={() => setView(item.id)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 8, cursor: "pointer", marginBottom: 2,
                background: active ? C.tealSoft : "transparent",
                color: active ? C.teal : C.text2,
                fontWeight: active ? 600 : 400, fontSize: 14,
                transition: "all 0.15s",
              }}
                onMouseEnter={e => !active && (e.currentTarget.style.background = C.bgHover)}
                onMouseLeave={e => !active && (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
                {item.label}
                {item.id === VIEWS.REVIEW && dueCount > 0 && (
                  <span style={{
                    marginLeft: "auto", background: C.amber, color: "#0d1117",
                    borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "2px 7px",
                  }}>{dueCount}</span>
                )}
              </div>
            );
          })}

          {/* ── Notes List section ── */}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setNotesOpen(o => !o)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 8, cursor: "pointer", width: "100%", border: "none",
              background: notesOpen ? C.purpleSoft : "transparent",
              color: notesOpen ? C.purple : C.text2,
              fontWeight: notesOpen ? 600 : 400, fontSize: 14,
              transition: "all 0.15s",
            }}
              onMouseEnter={e => !notesOpen && (e.currentTarget.style.background = C.bgHover)}
              onMouseLeave={e => !notesOpen && (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>📚</span>
              All Notes
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  background: notesOpen ? C.purple : C.border, color: notesOpen ? "#0d1117" : C.text2,
                  borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "2px 7px",
                }}>{notes.length}</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>{notesOpen ? "▲" : "▼"}</span>
              </span>
            </button>

            {notesOpen && (
              <div style={{ marginTop: 4, animation: "fadeIn 0.2s ease" }}>
                <input
                  value={noteSearch}
                  onChange={e => setNoteSearch(e.target.value)}
                  placeholder="Search notes..."
                  style={{
                    width: "100%", background: C.bgHover, border: `1px solid ${C.border}`,
                    borderRadius: 7, padding: "7px 10px", color: C.text1, fontSize: 12,
                    outline: "none", marginBottom: 6, boxSizing: "border-box", fontFamily: "inherit",
                  }}
                  onFocus={e => e.target.style.borderColor = C.purple}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {filteredNotes.length === 0 && (
                    <div style={{ padding: "12px 8px", fontSize: 12, color: C.text3, textAlign: "center" }}>
                      {notes.length === 0 ? "No notes yet" : "No matches"}
                    </div>
                  )}
                  {filteredNotes.map(n => {
                    const isDue = n.status !== "mastered" && toDateStr(n.next_review) <= today;
                    const isMastered = n.status === "mastered";
                    const dotColor = isMastered ? C.green : isDue ? C.amber : C.text3;
                    return (
                      <div key={n.id} onClick={() => setSelectedNote(n)} style={{
                        display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px",
                        borderRadius: 7, cursor: "pointer", transition: "all 0.12s",
                        marginBottom: 2,
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = C.bgHover}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <div style={{
                          width: 7, height: 7, borderRadius: 99, background: dotColor,
                          marginTop: 5, flexShrink: 0,
                        }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: 12, fontWeight: 600, color: C.text1,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            maxWidth: notesOpen ? 200 : 150,
                          }}>
                            {n.title || n.content.slice(0, 40)}
                          </div>
                          <div style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>
                            {fmtDate(n.created_at)}
                            {n.voiceNote && " · 🎤"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "12px 12px 0" }}>
          <div style={{
            background: `linear-gradient(135deg, ${C.purpleSoft}, ${C.tealSoft})`,
            border: `1px solid ${C.purple}33`, borderRadius: 10, padding: "14px",
            fontSize: 12, color: C.text2, lineHeight: 1.6,
          }}>
            <div style={{ color: C.purple, fontWeight: 700, marginBottom: 4 }}>💡 Tip</div>
            Review daily to encode memories into long-term storage.
          </div>
        </div>
      </nav>
    </>
  );
};

/* ─── Calendar Component ─── */
const MiniCalendar = ({ notes, onDateClick }) => {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  now.setMonth(now.getMonth() + offset);
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todaySt = todayStr();

  const calMap = {};
  notes.forEach(n => {
    const d = toDateStr(n.created_at);
    if (!calMap[d]) calMap[d] = { learned: 0, due: 0, missed: 0 };
    calMap[d].learned++;
  });
  notes.forEach(n => {
    if (n.status === "mastered") return;
    const d = toDateStr(n.next_review);
    if (!calMap[d]) calMap[d] = { learned: 0, due: 0, missed: 0 };
    if (d < todaySt) calMap[d].missed++;
    else calMap[d].due++;
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }

  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: C.text1 }}>{monthLabel}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setOffset(o => o - 1)} style={{
            background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6,
            color: C.text2, cursor: "pointer", padding: "4px 10px", fontSize: 12,
          }}>‹</button>
          <button onClick={() => setOffset(0)} style={{
            background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6,
            color: C.text2, cursor: "pointer", padding: "4px 10px", fontSize: 12,
          }}>Today</button>
          <button onClick={() => setOffset(o => o + 1)} style={{
            background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6,
            color: C.text2, cursor: "pointer", padding: "4px 10px", fontSize: 12,
          }}>›</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 8 }}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, color: C.text3, fontWeight: 600, padding: "4px 0" }}>{d}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const ds = toDateStr(date);
          const info = calMap[ds];
          const isToday = ds === todaySt;
          const isFuture = ds > todaySt;
          let dotColor = null;
          if (info) {
            if (info.missed > 0) dotColor = C.red;
            else if (info.due > 0) dotColor = C.amber;
            else if (info.learned > 0) dotColor = C.green;
          }
          return (
            <div key={i} onClick={() => onDateClick && onDateClick(date)} style={{
              textAlign: "center", padding: "6px 2px", borderRadius: 6, cursor: "pointer",
              background: isToday ? C.tealSoft : "transparent",
              border: isToday ? `1px solid ${C.teal}44` : "1px solid transparent",
              position: "relative",
            }}
              onMouseEnter={e => !isToday && (e.currentTarget.style.background = C.bgHover)}
              onMouseLeave={e => !isToday && (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 12, color: isToday ? C.teal : isFuture ? C.text3 : C.text2, fontWeight: isToday ? 700 : 400 }}>
                {date.getDate()}
              </span>
              {dotColor && (
                <div style={{
                  width: 4, height: 4, borderRadius: 99, background: dotColor,
                  margin: "2px auto 0",
                }} />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { color: C.green, label: "Learned" },
          { color: C.amber, label: "Due" },
          { color: C.red, label: "Missed" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.text2 }}>
            <div style={{ width: 8, height: 8, borderRadius: 99, background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Review Card ─── */
const ReviewCard = ({ note, onAnswer, index, total }) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Badge color={C.amber}>{fmtDateFull(note.next_review)}</Badge>
        <span style={{ fontSize: 13, color: C.text2 }}>{index + 1} / {total}</span>
      </div>

      <Card style={{ minHeight: 240, position: "relative", marginBottom: 16 }}>
        <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {note.tags?.map(t => <Chip key={t} label={t} />)}
          <Badge color={C.purple}>Level {note.interval_level + 1}/4</Badge>
        </div>

        <div style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>Created {fmtDate(note.created_at)}</div>

        {note.title && (
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text1, marginBottom: 12 }}>{note.title}</div>
        )}

        {!revealed ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ color: C.text3, fontSize: 14, marginBottom: 16 }}>Think about what you learned...</div>
            <Btn primary onClick={() => setRevealed(true)}>Reveal Content</Btn>
          </div>
        ) : (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{
              background: C.bgHover, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16,
              fontSize: 14, color: C.text1, lineHeight: 1.7, whiteSpace: "pre-wrap",
              marginBottom: note.voiceNote ? 14 : 0,
            }}>{note.content}</div>
            {note.voiceNote && (
              <div style={{
                background: `linear-gradient(135deg, ${C.tealSoft}, ${C.purpleSoft})`,
                border: `1px solid ${C.teal}33`, borderRadius: 10, padding: "12px 16px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, marginBottom: 8, letterSpacing: "0.06em" }}>
                  🎤 YOUR VOICE NOTE — Play to reinforce memory!
                </div>
                <audio controls src={note.voiceNote} autoPlay={false} style={{ width: "100%", accentColor: C.teal }} />
              </div>
            )}
          </div>
        )}
      </Card>

      {revealed && (
        <div style={{ display: "flex", gap: 12, animation: "fadeIn 0.3s ease" }}>
          <Btn full primary onClick={() => { onAnswer(true); setRevealed(false); }} style={{ background: `linear-gradient(135deg, #22c55e, #16a34a)` }}>
            ✓ Remembered
          </Btn>
          <Btn full danger onClick={() => { onAnswer(false); setRevealed(false); }}>
            ✗ Forgot
          </Btn>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <ProgressBar value={index} max={total} color={C.teal} height={3} />
      </div>
    </div>
  );
};

/* ─── Voice Recorder Component ─── */
const VoiceRecorder = ({ voiceNote, onVoiceNote }) => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => onVoiceNote(reader.result);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (e) {
      setError("Microphone access denied. Please allow mic permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const deleteVoice = () => { onVoiceNote(null); setDuration(0); };

  const fmt = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.text2, display: "block", marginBottom: 8, letterSpacing: "0.05em" }}>
        🎤 VOICE NOTE <span style={{ color: C.text3, fontWeight: 400 }}>(optional)</span>
      </label>

      {error && (
        <div style={{ padding: "8px 12px", borderRadius: 7, background: C.redSoft, color: C.red, fontSize: 12, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {voiceNote ? (
        <div style={{
          background: C.bgHover, border: `1px solid ${C.teal}44`, borderRadius: 10,
          padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>🎤</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.teal }}>Voice note recorded</span>
            <button onClick={deleteVoice} style={{
              marginLeft: "auto", background: C.redSoft, border: `1px solid ${C.red}44`,
              borderRadius: 6, color: C.red, cursor: "pointer", padding: "4px 10px", fontSize: 11, fontWeight: 600,
            }}>Delete</button>
          </div>
          <audio controls src={voiceNote} style={{ width: "100%", accentColor: C.teal }} />
        </div>
      ) : (
        <div style={{
          background: C.bgHover, border: `1px solid ${recording ? C.red + "66" : C.border}`,
          borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14,
          transition: "border-color 0.2s",
        }}>
          {recording ? (
            <>
              <div style={{ display: "flex", align: "center", gap: 6 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: 99, background: C.red,
                  animation: "pulse 1s infinite",
                }} />
              </div>
              <span style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>Recording... {fmt(duration)}</span>
              <button onClick={stopRecording} style={{
                marginLeft: "auto", background: C.redSoft, border: `1px solid ${C.red}55`,
                borderRadius: 8, color: C.red, cursor: "pointer", padding: "8px 16px",
                fontSize: 13, fontWeight: 700,
              }}>■ Stop</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 28 }}>🎙</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Record your explanation</div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>Hear your own voice during review — great for students!</div>
              </div>
              <button onClick={startRecording} style={{
                marginLeft: "auto", background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`,
                border: "none", borderRadius: 8, color: "#0d1117", cursor: "pointer",
                padding: "8px 16px", fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>⏺ Record</button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Add Note View ─── */
const AddNoteView = ({ onSave }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const [saved, setSaved] = useState(false);
  const [voiceNote, setVoiceNote] = useState(null);

  const inputStyle = {
    width: "100%", background: C.bgHover, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "10px 14px", color: C.text1, fontSize: 14,
    outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
    fontFamily: "inherit",
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(""); }
  };

  const handleSave = () => {
    if (!content.trim()) return;
    const now = new Date().toISOString();
    const note = {
      id: uid(), title: title.trim(), content: content.trim(), tags,
      type: "learning", created_at: now,
      next_review: addDays(now, INTERVALS[0]).toISOString(),
      status: "active", interval_level: 0,
      review_history: [],
      voiceNote: voiceNote || null,
    };
    onSave(note);
    setTitle(""); setContent(""); setTags([]); setVoiceNote(null); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text1, margin: "0 0 6px" }}>Capture New Knowledge</h1>
        <p style={{ color: C.text2, fontSize: 14 }}>What did you learn today? First review in 1 day.</p>
      </div>

      {saved && (
        <div style={{
          background: C.greenSoft, border: `1px solid ${C.green}44`, borderRadius: 10,
          padding: "14px 18px", color: C.green, fontWeight: 600, marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10, animation: "fadeIn 0.3s",
        }}>
          ✓ Saved! Review scheduled for tomorrow.
        </div>
      )}

      <Card>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>TITLE (optional)</label>
          <input
            style={inputStyle} value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Brief headline for this concept..."
            onFocus={e => e.target.style.borderColor = C.teal}
            onBlur={e => e.target.style.borderColor = C.border}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>CONTENT *</label>
          <textarea
            style={{ ...inputStyle, minHeight: 180, resize: "vertical", lineHeight: 1.7 }}
            value={content} onChange={e => setContent(e.target.value)}
            placeholder="Paste or type what you learned. Be detailed — your future self will thank you..."
            onFocus={e => e.target.style.borderColor = C.teal}
            onBlur={e => e.target.style.borderColor = C.border}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <VoiceRecorder voiceNote={voiceNote} onVoiceNote={setVoiceNote} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>TAGS</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {tags.map(t => <Chip key={t} label={t} onRemove={() => setTags(tags.filter(x => x !== t))} />)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }} value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTag()}
              placeholder="e.g. python, biology, history..."
              onFocus={e => e.target.style.borderColor = C.teal}
              onBlur={e => e.target.style.borderColor = C.border}
            />
            <Btn small onClick={addTag}>Add</Btn>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Btn primary full onClick={handleSave} disabled={!content.trim()}>
            ✦ Save & Schedule
          </Btn>
        </div>
      </Card>

      <Card style={{ marginTop: 16, background: C.bgHover }}>
        <div style={{ fontSize: 13, color: C.text2, fontWeight: 600, marginBottom: 12 }}>Spaced Repetition Schedule</div>
        <div style={{ display: "flex", gap: 0 }}>
          {["Today", "+1 day", "+3 days", "+7 days", "+15 days", "Mastered"].map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{
                width: 28, height: 28, borderRadius: 99,
                background: i === 0 ? C.teal : C.border,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                color: i === 0 ? "#0d1117" : C.text3,
                margin: "0 auto 6px",
              }}>{i + 1}</div>
              <div style={{ fontSize: 10, color: i === 0 ? C.teal : C.text3 }}>{label}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

/* ─── Dashboard View ─── */
const DashboardView = ({ notes, setView, onLeisureMode, onDeleteNote, user }) => {
  const today = todayStr();
  const todayNotes = notes.filter(n => toDateStr(n.created_at) === today);
  const dueToday = notes.filter(n => n.status !== "mastered" && toDateStr(n.next_review) <= today);
  const overdue = notes.filter(n => n.status !== "mastered" && toDateStr(n.next_review) < today);
  const mastered = notes.filter(n => n.status === "mastered");
  const streak = calcStreak(notes);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text1, margin: "0 0 6px" }}>
              Good {getGreeting()}, {user ? (user.name || user.username).split(" ")[0] : "Learner"} 👋
            </h1>
            <p style={{ color: C.text2, fontSize: 14 }}>{fmtDateFull(new Date())}</p>
          </div>
          <Btn primary onClick={onLeisureMode} style={{ background: `linear-gradient(135deg, ${C.purple}, #7c3aed)` }}>
            ✦ I'm Free Now
          </Btn>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Notes" value={notes.length} color={C.teal} icon="◈" />
        <StatCard label="Due Today" value={dueToday.length} color={dueToday.length > 0 ? C.amber : C.green} icon="↻" />
        <StatCard label="Mastered" value={mastered.length} color={C.green} icon="✓" />
        <StatCard label="Day Streak" value={streak} color={C.purple} icon="▲" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.text1, marginBottom: 16 }}>📅 Calendar</div>
          <MiniCalendar notes={notes} />
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.text1, marginBottom: 14 }}>📋 Today's Tasks</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 99, background: todayNotes.length > 0 ? C.green : C.border }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Learn something new</span>
                {todayNotes.length > 0 && <Badge color={C.green}>Done ✓</Badge>}
              </div>
              {todayNotes.length === 0 ? (
                <Btn small primary onClick={() => setView(VIEWS.ADD)}>✦ Add Today's Note</Btn>
              ) : (
                <div style={{ fontSize: 12, color: C.text2 }}>You've added {todayNotes.length} note{todayNotes.length > 1 ? "s" : ""} today!</div>
              )}
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 99, background: dueToday.length > 0 ? C.amber : C.green }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Review pending</span>
                {dueToday.length === 0 && <Badge color={C.green}>All clear ✓</Badge>}
              </div>
              {dueToday.length > 0 ? (
                <div>
                  <div style={{ fontSize: 12, color: C.text2, marginBottom: 8 }}>{dueToday.length} card{dueToday.length > 1 ? "s" : ""} waiting</div>
                  <Btn small primary onClick={() => setView(VIEWS.REVIEW)}>Start Review →</Btn>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.text2 }}>No reviews due today.</div>
              )}
            </div>
          </Card>

          {overdue.length > 0 && (
            <Card style={{ borderColor: `${C.red}44` }}>
              <div style={{ display: "flex", align: "center", gap: 8, marginBottom: 10 }}>
                <Badge color={C.red}>⚠ {overdue.length} Overdue</Badge>
              </div>
              <div style={{ fontSize: 13, color: C.text2, marginBottom: 12 }}>
                You have missed reviews. Don't let them pile up!
              </div>
              <Btn small danger onClick={() => setView(VIEWS.REVIEW)}>Review Now</Btn>
            </Card>
          )}
        </div>
      </div>

      {notes.length > 0 && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.text1, marginBottom: 16 }}>Recent Notes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notes.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5).map(n => (
              <div key={n.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                background: C.bgHover, borderRadius: 8, border: `1px solid ${C.border}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.title || n.content.slice(0, 50)}
                  </div>
                  <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{fmtDate(n.created_at)} · Next: {fmtDate(n.next_review)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {n.status === "mastered" ? <Badge color={C.green}>Mastered</Badge> :
                    toDateStr(n.next_review) < todayStr() ? <Badge color={C.red}>Overdue</Badge> :
                      toDateStr(n.next_review) === todayStr() ? <Badge color={C.amber}>Due Today</Badge> :
                        <Badge color={C.text2}>Level {n.interval_level + 1}</Badge>}
                  <DeleteBtn onConfirm={() => onDeleteNote(n.id)} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {notes.length === 0 && (
        <Card style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>◈</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text1, marginBottom: 8 }}>Start Your Learning Journey</div>
          <div style={{ fontSize: 14, color: C.text2, marginBottom: 24 }}>
            Add your first note and the system will automatically schedule reviews for optimal retention.
          </div>
          <Btn primary onClick={() => setView(VIEWS.ADD)}>✦ Add First Note</Btn>
        </Card>
      )}
    </div>
  );
};

/* ─── Practice Mode: Note Picker ─── */
const NotePicker = ({ notes, onStart, onDeleteNote }) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const today = todayStr();

  const filtered = notes.filter(n => {
    const matchSearch = !search || (n.title + n.content + (n.tags || []).join(" ")).toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ? true :
      filter === "due" ? toDateStr(n.next_review) <= today && n.status !== "mastered" :
      filter === "mastered" ? n.status === "mastered" :
      filter === "upcoming" ? toDateStr(n.next_review) > today && n.status !== "mastered" : true;
    return matchSearch && matchFilter;
  });

  const toggle = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = filtered.length > 0 && filtered.every(n => selected.has(n.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(n => n.id)));

  const inputStyle = {
    background: C.bgHover, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "8px 14px", color: C.text1, fontSize: 13, outline: "none",
    fontFamily: "inherit",
  };

  const pickedNotes = notes.filter(n => selected.has(n.id));

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          placeholder="Search notes..."
          value={search} onChange={e => setSearch(e.target.value)}
          onFocus={e => e.target.style.borderColor = C.teal}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {[["all","All"], ["due","Due"], ["upcoming","Upcoming"], ["mastered","Mastered"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              cursor: "pointer", border: `1px solid ${filter === val ? C.teal : C.border}`,
              background: filter === val ? C.tealSoft : "transparent",
              color: filter === val ? C.teal : C.text2,
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: C.text2 }}>
          {selected.size > 0 ? `${selected.size} selected` : `${filtered.length} notes`}
        </div>
        <button onClick={toggleAll} style={{
          background: "transparent", border: "none", color: C.teal,
          fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>{allSelected ? "Deselect all" : "Select all"}</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto", marginBottom: 16 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: C.text3, fontSize: 13 }}>No notes match</div>
        )}
        {filtered.map(n => {
          const sel = selected.has(n.id);
          const isDue = n.status !== "mastered" && toDateStr(n.next_review) <= todayStr();
          return (
            <div key={n.id} onClick={() => toggle(n.id)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              borderRadius: 8, cursor: "pointer",
              background: sel ? C.tealSoft : C.bgHover,
              border: `1px solid ${sel ? C.teal + "55" : C.border}`,
              transition: "all 0.15s",
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                border: `2px solid ${sel ? C.teal : C.text3}`,
                background: sel ? C.teal : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {sel && <span style={{ color: "#0d1117", fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {n.title || n.content.slice(0, 55) + "..."}
                </div>
                <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>
                  {fmtDate(n.created_at)} · {n.review_history?.length || 0} reviews
                  {n.tags?.length > 0 && " · " + n.tags.join(", ")}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {n.status === "mastered" ? <Badge color={C.green}>Mastered</Badge> :
                  isDue ? <Badge color={C.amber}>Due</Badge> :
                  <Badge color={C.text2}>L{n.interval_level + 1}</Badge>}
                <DeleteBtn onConfirm={() => { onDeleteNote(n.id); setSelected(s => { const ns = new Set(s); ns.delete(n.id); return ns; }); }} />
              </div>
            </div>
          );
        })}
      </div>

      <Btn primary full disabled={selected.size === 0} onClick={() => onStart(pickedNotes)}>
        ↻ Practice {selected.size > 0 ? `${selected.size} note${selected.size > 1 ? "s" : ""}` : "Selected Notes"}
      </Btn>
    </div>
  );
};

/* ─── Review View ─── */
const ReviewView = ({ notes, onUpdateNote, onDeleteNote, leisureMode, setLeisureMode }) => {
  const today = todayStr();
  const due = notes.filter(n => n.status !== "mastered" && toDateStr(n.next_review) <= today);
  const [tab, setTab] = useState("due");
  const [sessionNotes, setSessionNotes] = useState(null);
  const [idx, setIdx] = useState(0);
  const [completed, setCompleted] = useState([]);

  const activePool = sessionNotes || (leisureMode
    ? notes.filter(n => n.status !== "mastered" && toDateStr(n.next_review) <= today)
    : due);

  const handleAnswer = (remembered) => {
    const note = activePool[idx];
    const newLevel = remembered ? Math.min(note.interval_level + 1, INTERVALS.length) : 0;
    const isNowMastered = newLevel >= INTERVALS.length;
    const updated = {
      ...note,
      interval_level: newLevel,
      status: isNowMastered ? "mastered" : "active",
      next_review: isNowMastered ? null : addDays(new Date(), INTERVALS[newLevel]).toISOString(),
      review_history: [...(note.review_history || []), { date: new Date().toISOString(), remembered }],
    };
    onUpdateNote(updated);
    setCompleted(c => [...c, { id: note.id, remembered }]);
    setIdx(i => i + 1);
  };

  const resetSession = () => { setIdx(0); setCompleted([]); setSessionNotes(null); setLeisureMode(false); };
  const startPractice = (picked) => { setSessionNotes(picked); setIdx(0); setCompleted([]); };

  /* ── Active session (due, leisure, or practice) ── */
  if (sessionNotes || leisureMode) {
    const modeLabel = leisureMode ? "✦ Leisure Mode" : "↻ Practice Mode";
    const modeColor = leisureMode ? `linear-gradient(135deg, ${C.purple}, #7c3aed)` : `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`;
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ background: modeColor, borderRadius: 10, padding: "8px 16px", color: "#0d1117", fontWeight: 700, fontSize: 14 }}>
            {modeLabel}
          </div>
          <Btn small onClick={resetSession}>← Exit</Btn>
        </div>
        {activePool.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text1 }}>All caught up!</div>
            <div style={{ color: C.text2, marginTop: 8 }}>No pending reviews. Great work!</div>
          </Card>
        ) : idx < activePool.length ? (
          <ReviewCard note={activePool[idx]} onAnswer={handleAnswer} index={idx} total={activePool.length} />
        ) : (
          <CompletionScreen completed={completed} onReset={resetSession} />
        )}
      </div>
    );
  }

  /* ── Tab header ── */
  const TabBtn = ({ id, label, count }) => (
    <button onClick={() => setTab(id)} style={{
      padding: "8px 18px", borderRadius: 8, fontWeight: 600, fontSize: 13,
      cursor: "pointer", border: `1px solid ${tab === id ? C.teal : C.border}`,
      background: tab === id ? C.tealSoft : "transparent",
      color: tab === id ? C.teal : C.text2, display: "flex", alignItems: "center", gap: 7,
    }}>
      {label}
      {count != null && (
        <span style={{
          background: tab === id ? C.teal : C.border, color: tab === id ? "#0d1117" : C.text2,
          borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 6px",
        }}>{count}</span>
      )}
    </button>
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text1, margin: "0 0 16px" }}>Review</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <TabBtn id="due" label="Due Reviews" count={due.length} />
          <TabBtn id="practice" label="Practice Any Note" count={notes.length} />
        </div>
      </div>

      {/* Due Reviews tab */}
      {tab === "due" && (
        due.length === 0 ? (
          <Card style={{ textAlign: "center", padding: "50px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.green, marginBottom: 8 }}>All Reviews Complete!</div>
            <div style={{ fontSize: 14, color: C.text2, marginBottom: 24 }}>
              No scheduled reviews today. Want to practice anyway?
            </div>
            <Btn onClick={() => setTab("practice")} style={{ borderColor: C.teal + "55", color: C.teal }}>
              Switch to Practice Mode →
            </Btn>
          </Card>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 14, color: C.text2 }}>
                {due.length} card{due.length !== 1 ? "s" : ""} scheduled for today
              </span>
              <Btn primary onClick={() => { setIdx(0); setCompleted([]); setSessionNotes(due); }}>
                Start Review →
              </Btn>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {due.map(n => (
                <Card key={n.id} style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {n.title || n.content.slice(0, 55) + "..."}
                      </div>
                      <div style={{ fontSize: 11, color: C.text2, marginTop: 3 }}>
                        {fmtDate(n.created_at)} · Level {n.interval_level + 1} · {n.review_history?.length || 0} reviews
                      </div>
                    </div>
                    <Btn small onClick={() => { setSessionNotes([n]); setIdx(0); setCompleted([]); }}>
                      Review
                    </Btn>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )
      )}

      {/* Practice Mode tab */}
      {tab === "practice" && (
        <Card>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.text1, marginBottom: 4 }}>Practice Any Note — Anytime</div>
            <div style={{ fontSize: 13, color: C.text2 }}>
              Select notes below and start a practice session. Results still update your spaced repetition schedule.
            </div>
          </div>
          {notes.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: C.text3, fontSize: 13 }}>
              No notes yet. Add your first note to get started.
            </div>
          ) : (
            <NotePicker notes={notes} onStart={startPractice} onDeleteNote={onDeleteNote} />
          )}
        </Card>
      )}
    </div>
  );
};

const CompletionScreen = ({ completed, onReset }) => {
  const remembered = completed.filter(c => c.remembered).length;
  const pct = Math.round((remembered / Math.max(completed.length, 1)) * 100);
  return (
    <Card style={{ textAlign: "center", padding: "60px 24px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🧠</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text1, marginBottom: 8 }}>Session Complete!</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 24, margin: "24px 0" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: C.green }}>{remembered}</div>
          <div style={{ fontSize: 12, color: C.text2 }}>Remembered</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: C.red }}>{completed.length - remembered}</div>
          <div style={{ fontSize: 12, color: C.text2 }}>Forgot</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: C.teal }}>{pct}%</div>
          <div style={{ fontSize: 12, color: C.text2 }}>Accuracy</div>
        </div>
      </div>
      <Btn primary onClick={onReset}>Done</Btn>
    </Card>
  );
};

/* ─── Progress View ─── */
const ProgressView = ({ notes, onDeleteNote }) => {
  const mastered = notes.filter(n => n.status === "mastered");
  const active = notes.filter(n => n.status !== "mastered");
  const totalReviews = notes.reduce((s, n) => s + (n.review_history?.length || 0), 0);
  const totalRemembered = notes.reduce((s, n) => s + (n.review_history?.filter(r => r.remembered).length || 0), 0);
  const accuracy = totalReviews > 0 ? Math.round((totalRemembered / totalReviews) * 100) : 0;

  const levelDist = [0, 1, 2, 3].map(lvl => ({
    name: `L${lvl + 1} (${["1d", "3d", "7d", "15d"][lvl]})`,
    count: active.filter(n => n.interval_level === lvl).length,
  }));

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = toDateStr(d);
    return {
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      added: notes.filter(n => toDateStr(n.created_at) === ds).length,
      reviewed: notes.reduce((s, n) => s + (n.review_history?.filter(r => toDateStr(r.date) === ds).length || 0), 0),
    };
  });

  const tagCounts = {};
  notes.forEach(n => (n.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text1, margin: "0 0 24px" }}>Progress</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Notes" value={notes.length} color={C.teal} icon="◈" />
        <StatCard label="Mastered" value={mastered.length} color={C.green} icon="✓" />
        <StatCard label="Total Reviews" value={totalReviews} color={C.purple} icon="↻" />
        <StatCard label="Accuracy" value={`${accuracy}%`} color={accuracy > 70 ? C.green : C.amber} icon="▲" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text1, marginBottom: 16 }}>Activity — Last 7 Days</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={last7Days} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="day" tick={{ fill: C.text3, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.text3, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text1, fontSize: 12 }} />
              <Bar dataKey="added" fill={C.teal} radius={[3, 3, 0, 0]} name="Added" />
              <Bar dataKey="reviewed" fill={C.purple} radius={[3, 3, 0, 0]} name="Reviewed" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text1, marginBottom: 16 }}>Level Distribution</div>
          {notes.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: C.text3, fontSize: 13 }}>No notes yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {levelDist.map((l, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.text2 }}>{l.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text1 }}>{l.count}</span>
                  </div>
                  <ProgressBar value={l.count} max={notes.length} color={[C.red, C.amber, C.teal, C.green][i]} />
                </div>
              ))}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.text2 }}>Mastered</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>{mastered.length}</span>
                </div>
                <ProgressBar value={mastered.length} max={notes.length} color={C.green} />
              </div>
            </div>
          )}
        </Card>
      </div>

      {topTags.length > 0 && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text1, marginBottom: 16 }}>Top Topics</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {topTags.map(([tag, count]) => (
              <div key={tag} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                background: C.tealSoft, border: `1px solid ${C.teal}33`,
                borderRadius: 99, fontSize: 13, color: C.teal, fontWeight: 600,
              }}>
                {tag}
                <span style={{ background: C.teal, color: "#0d1117", borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>{count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {notes.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text1, marginBottom: 16 }}>All Notes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notes.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(n => (
              <div key={n.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                background: C.bgHover, borderRadius: 8, border: `1px solid ${C.border}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.title || n.content.slice(0, 60)}
                  </div>
                  <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>
                    Added {fmtDate(n.created_at)} · {n.review_history?.length || 0} reviews · {n.tags?.join(", ")}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {n.status === "mastered" ? <Badge color={C.green}>Mastered</Badge> :
                    <Badge color={[C.red, C.amber, C.teal, C.green][n.interval_level] || C.text2}>L{n.interval_level + 1}</Badge>}
                  <DeleteBtn onConfirm={() => onDeleteNote(n.id)} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

/* ─── Helpers ─── */
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function calcStreak(notes) {
  const days = new Set(notes.map(n => toDateStr(n.created_at)));
  let streak = 0;
  let d = new Date();
  while (days.has(toDateStr(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/* ─── Alarm Settings View ─── */
const ALARM_KEY = (username) => `ma_alarms_${username}`;

const AlarmView = ({ username }) => {
  const [alarms, setAlarms] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [time, setTime] = useState("08:00");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState([1,2,3,4,5]); // Mon-Fri default
  const [saved, setSaved] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState(null);
  const intervalRef = useRef(null);

  const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  useEffect(() => {
    loadData(ALARM_KEY(username)).then(data => {
      if (data) setAlarms(data);
      setLoaded(true);
    });
  }, [username]);

  useEffect(() => {
    if (loaded) saveData(ALARM_KEY(username), alarms);
  }, [alarms, loaded, username]);

  // Check alarms every 30 seconds
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const hhmm = now.getHours().toString().padStart(2,"0") + ":" + now.getMinutes().toString().padStart(2,"0");
      const dayOfWeek = now.getDay();
      alarms.forEach(a => {
        if (a.enabled && a.time === hhmm && a.days.includes(dayOfWeek)) {
          setActiveAlarm(a);
        }
      });
    };
    intervalRef.current = setInterval(check, 30000);
    return () => clearInterval(intervalRef.current);
  }, [alarms]);

  const toggleDay = (d) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());

  const addAlarm = () => {
    if (!time) return;
    const alarm = { id: uid(), time, label: label.trim() || "Revision Reminder", days, enabled: true, created: new Date().toISOString() };
    setAlarms(prev => [...prev, alarm]);
    setLabel(""); setTime("08:00"); setDays([1,2,3,4,5]);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  const toggleAlarm = (id) => setAlarms(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  const deleteAlarm = (id) => setAlarms(prev => prev.filter(a => a.id !== id));

  const inputStyle = {
    background: C.bgHover, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "10px 14px", color: C.text1, fontSize: 14, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s", fontFamily: "inherit",
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Active alarm modal */}
      {activeAlarm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: C.bgCard, border: `2px solid ${C.amber}`, borderRadius: 20,
            padding: "40px 48px", textAlign: "center", maxWidth: 380,
            boxShadow: `0 0 60px ${C.amber}44`, animation: "fadeIn 0.3s ease",
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🔔</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.amber, marginBottom: 8 }}>Time to Revise!</div>
            <div style={{ fontSize: 15, color: C.text1, marginBottom: 6, fontWeight: 600 }}>{activeAlarm.label}</div>
            <div style={{ fontSize: 13, color: C.text2, marginBottom: 28 }}>
              Don't let your hard work fade — open your notes and do a quick review session now!
            </div>
            <Btn primary full onClick={() => setActiveAlarm(null)}>
              Got it, I'll review now! ✓
            </Btn>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text1, margin: "0 0 6px" }}>🔔 Alarm Settings</h1>
        <p style={{ color: C.text2, fontSize: 14 }}>Set daily reminders so you never forget to revise your notes.</p>
      </div>

      {saved && (
        <div style={{
          background: C.greenSoft, border: `1px solid ${C.green}44`, borderRadius: 10,
          padding: "14px 18px", color: C.green, fontWeight: 600, marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10, animation: "fadeIn 0.3s",
        }}>✓ Alarm set! You'll be notified when it's time to revise.</div>
      )}

      {/* Add new alarm card */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.text1, marginBottom: 18 }}>Add New Reminder</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>TIME</label>
            <input type="time" style={{ ...inputStyle, width: "100%" }} value={time}
              onChange={e => setTime(e.target.value)}
              onFocus={e => e.target.style.borderColor = C.teal}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>LABEL (optional)</label>
            <input style={{ ...inputStyle, width: "100%" }} value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Morning review"
              onFocus={e => e.target.style.borderColor = C.teal}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, display: "block", marginBottom: 10, letterSpacing: "0.05em" }}>REPEAT DAYS</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DAY_LABELS.map((d, i) => {
              const active = days.includes(i);
              return (
                <button key={i} onClick={() => toggleDay(i)} style={{
                  width: 44, height: 44, borderRadius: 10, fontWeight: 600, fontSize: 12, cursor: "pointer",
                  border: `1px solid ${active ? C.teal : C.border}`,
                  background: active ? C.tealSoft : "transparent",
                  color: active ? C.teal : C.text3,
                  transition: "all 0.15s",
                }}>{d}</button>
              );
            })}
          </div>
        </div>

        <Btn primary full onClick={addAlarm}>
          🔔 Set Reminder
        </Btn>
      </Card>

      {/* Existing alarms */}
      {alarms.length > 0 && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.text1, marginBottom: 16 }}>Your Reminders</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alarms.slice().sort((a, b) => a.time.localeCompare(b.time)).map(alarm => (
              <div key={alarm.id} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                background: C.bgHover, borderRadius: 10,
                border: `1px solid ${alarm.enabled ? C.teal + "33" : C.border}`,
                opacity: alarm.enabled ? 1 : 0.5, transition: "all 0.2s",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: alarm.enabled ? C.teal : C.text2, fontFamily: "monospace" }}>
                      {alarm.time}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>{alarm.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.text2, marginTop: 4 }}>
                    {alarm.days.length === 7 ? "Every day" :
                     alarm.days.length === 0 ? "No days selected" :
                     alarm.days.map(d => DAY_LABELS[d]).join(", ")}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {/* Toggle switch */}
                  <button onClick={() => toggleAlarm(alarm.id)} style={{
                    width: 44, height: 24, borderRadius: 99, cursor: "pointer", border: "none",
                    background: alarm.enabled ? C.teal : C.border, position: "relative",
                    transition: "background 0.2s", flexShrink: 0,
                  }}>
                    <div style={{
                      position: "absolute", top: 3, left: alarm.enabled ? 23 : 3,
                      width: 18, height: 18, borderRadius: 99,
                      background: alarm.enabled ? "#0d1117" : C.text2,
                      transition: "left 0.2s",
                    }} />
                  </button>
                  <DeleteBtn onConfirm={() => deleteAlarm(alarm.id)} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {alarms.length === 0 && !saved && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: C.text3, fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔕</div>
          No reminders set yet. Add one above to stay on track!
        </div>
      )}

      <Card style={{ marginTop: 16, background: C.amberSoft, border: `1px solid ${C.amber}33` }}>
        <div style={{ fontSize: 13, color: C.amber, fontWeight: 600, marginBottom: 6 }}>⚡ How It Works</div>
        <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>
          Alarms check in real-time while you have this app open. A notification popup will appear at the set time reminding you to review your notes. For best results, keep the app open in a browser tab.
        </div>
      </Card>
    </div>
  );
};

/* ─── Main App ─── */
export default function App() {
  // ✅ Boot: synchronously read localStorage BEFORE first render
  const [user, setUser] = useState(() => {
    const savedUsername = loadData(SESSION_KEY);
    if (!savedUsername) return null;
    const users = getUsers();
    return users[savedUsername] || null;
  });
  const [notes, setNotes] = useState(() => {
    const savedUsername = loadData(SESSION_KEY);
    if (!savedUsername) return [];
    return loadData(notesKey(savedUsername)) || [];
  });
  const [view, setView] = useState(VIEWS.DASHBOARD);
  const [appLoaded, setAppLoaded] = useState(true);   // sync — no async needed
  const [notesLoaded, setNotesLoaded] = useState(() => !!loadData(SESSION_KEY));
  const [leisureMode, setLeisureMode] = useState(false);

  // ✅ Save notes to localStorage whenever they change (per-user)
  useEffect(() => {
    if (notesLoaded && user) saveData(notesKey(user.username), notes);
  }, [notes, notesLoaded, user]);

  // ✅ On login/register: save session + load that user's notes
  const handleAuth = useCallback((authedUser) => {
    saveData(SESSION_KEY, authedUser.username);       // persist session
    setUser(authedUser);
    const data = loadData(notesKey(authedUser.username));
    setNotes(data || []);
    setNotesLoaded(true);
  }, []);

  // ✅ On logout: clear session only — account & notes stay in localStorage
  const handleLogout = useCallback(() => {
    deleteKey(SESSION_KEY);
    setUser(null); setNotes([]); setNotesLoaded(false); setView(VIEWS.DASHBOARD);
  }, []);

  const addNote = useCallback((note) => setNotes(prev => [note, ...prev]), []);
  const updateNote = useCallback((updated) => setNotes(prev => prev.map(n => n.id === updated.id ? updated : n)), []);
  const deleteNote = useCallback((id) => setNotes(prev => prev.filter(n => n.id !== id)), []);

  const today = todayStr();
  const dueCount = notes.filter(n => n.status !== "mastered" && toDateStr(n.next_review) <= today).length;

  if (!appLoaded) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.text2, fontSize: 14 }}>Loading...</div>
    </div>
  );

  if (!user) return <AuthScreen onAuth={handleAuth} />;

  const handleLeisureMode = () => { setLeisureMode(true); setView(VIEWS.REVIEW); };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", fontFamily: "'Inter', -apple-system, sans-serif", color: C.text1 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 99px; }
        input::placeholder, textarea::placeholder { color: ${C.text3}; }
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
      `}</style>

      <Sidebar view={view} setView={v => { setView(v); setLeisureMode(false); }} dueCount={dueCount} user={user} onLogout={handleLogout} notes={notes} />

      <main style={{ flex: 1, padding: "40px 36px", overflowY: "auto", maxHeight: "100vh" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", animation: "fadeIn 0.3s ease" }} key={view}>
          {view === VIEWS.DASHBOARD && (
            <DashboardView notes={notes} setView={setView} onLeisureMode={handleLeisureMode} onDeleteNote={deleteNote} user={user} />
          )}
          {view === VIEWS.ADD && <AddNoteView onSave={addNote} />}
          {view === VIEWS.REVIEW && (
            <ReviewView notes={notes} onUpdateNote={updateNote} onDeleteNote={deleteNote} leisureMode={leisureMode} setLeisureMode={setLeisureMode} />
          )}
          {view === VIEWS.PROGRESS && <ProgressView notes={notes} onDeleteNote={deleteNote} />}
          {view === VIEWS.ALARMS && <AlarmView username={user.username} />}
        </div>
      </main>
    </div>
  );
}
