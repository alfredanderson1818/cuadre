/* ============================================================
   CUADRE — Backend multi-cliente
   Node + Express. Auth con bcrypt + JWT. Datos por usuario
   aislados, persistidos en db.json (un blob de estado por cuenta).
   ============================================================ */
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "db.json");
const JWT_SECRET = process.env.CUADRE_SECRET || "cuadre-dev-secret-change-in-prod";
const PORT = process.env.PORT || 8788;

/* ---- "DB" en archivo JSON --------------------------------- */
function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, "utf8")); }
  catch (e) { return { users: {}, data: {} }; }
}
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
let db = loadDB();

/* ---- Estado inicial de una cuenta nueva ------------------- */
function seedState() {
  return {
    rate: 760,
    rates: { bcv: 563.29, euro: 654.87, binance: 758.76, updatedAt: null },
    accounts: [
      { id: "a1", kind: "cash", name: "Efectivo $", currency: "USD", balance: 1850 },
      { id: "a2", kind: "usdt", name: "Binance USDT", currency: "USDT", balance: 3120 },
      { id: "a3", kind: "zelle", name: "Zelle", currency: "USD", balance: 980 },
      { id: "a4", kind: "bs", name: "Banco de Venezuela", currency: "BS", balance: 1520000 },
      { id: "a5", kind: "bs", name: "Banesco", currency: "BS", balance: 760000 },
    ],
    clients: [
      { id: "c1", name: "Ferretería La Económica", phone: "0414-1234567", note: "Paga IVA mensual" },
      { id: "c2", name: "José Mendoza", phone: "0424-9876543", note: "" },
    ],
    ops: [],
  };
}

/* ---- Helpers ---------------------------------------------- */
function makeToken(user) {
  return jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: "30d" });
}
function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, business: u.business || "", phone: u.phone || "" };
}
function findByEmail(email) {
  const e = (email || "").trim().toLowerCase();
  return Object.values(db.users).find((u) => u.email === e);
}

/* ---- App -------------------------------------------------- */
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autenticado" });
  try {
    const { uid } = jwt.verify(token, JWT_SECRET);
    const user = db.users[uid];
    if (!user) return res.status(401).json({ error: "Sesión inválida" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Sesión expirada" });
  }
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/register", async (req, res) => {
  const { email, password, name } = req.body || {};
  const clean = (email || "").trim().toLowerCase();
  if (!clean || !password || password.length < 4)
    return res.status(400).json({ error: "Correo y contraseña (mín. 4) requeridos" });
  if (findByEmail(clean)) return res.status(409).json({ error: "Ese correo ya está registrado" });

  const id = "u" + Date.now() + Math.random().toString(36).slice(2, 7);
  const passHash = await bcrypt.hash(password, 10);
  const user = { id, email: clean, name: (name || clean.split("@")[0]).trim(), business: "", phone: "", passHash, createdAt: new Date().toISOString() };
  db.users[id] = user;
  db.data[id] = seedState();
  saveDB(db);
  res.json({ token: makeToken(user), user: publicUser(user) });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = findByEmail(email);
  if (!user) return res.status(401).json({ error: "Correo o contraseña incorrectos" });
  const ok = await bcrypt.compare(password || "", user.passHash);
  if (!ok) return res.status(401).json({ error: "Correo o contraseña incorrectos" });
  res.json({ token: makeToken(user), user: publicUser(user) });
});

app.get("/api/me", auth, (req, res) => res.json(publicUser(req.user)));

app.put("/api/profile", auth, (req, res) => {
  const { name, business, phone } = req.body || {};
  const u = req.user;
  if (name !== undefined) u.name = name;
  if (business !== undefined) u.business = business;
  if (phone !== undefined) u.phone = phone;
  saveDB(db);
  res.json(publicUser(u));
});

app.put("/api/password", auth, async (req, res) => {
  const { current, next } = req.body || {};
  const ok = await bcrypt.compare(current || "", req.user.passHash);
  if (!ok) return res.status(400).json({ error: "Contraseña actual incorrecta" });
  if (!next || next.length < 4) return res.status(400).json({ error: "La nueva debe tener mín. 4 caracteres" });
  req.user.passHash = await bcrypt.hash(next, 10);
  saveDB(db);
  res.json({ ok: true });
});

app.get("/api/state", auth, (req, res) => {
  res.json(db.data[req.user.id] || seedState());
});

app.put("/api/state", auth, (req, res) => {
  const { state } = req.body || {};
  if (!state || typeof state !== "object") return res.status(400).json({ error: "Estado inválido" });
  db.data[req.user.id] = state;
  saveDB(db);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Cuadre backend en http://localhost:${PORT}`));
