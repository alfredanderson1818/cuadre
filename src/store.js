/* ============================================================
   CUADRE — capa de datos (estado en la nube por usuario, vía backend)
   ============================================================ */
import { useSyncExternalStore } from "react";

/* ---- Metadatos de canales --------------------------------- */
export const CHANNELS = {
  cash: { label: "USD efectivo", short: "Efectivo", icon: "$", color: "var(--c-cash)", currency: "USD" },
  usdt: { label: "USDT / cripto", short: "USDT", icon: "₮", color: "var(--c-usdt)", currency: "USDT" },
  zelle: { label: "Zelle / Transfer", short: "Zelle", icon: "🇺🇸", color: "var(--c-zelle)", currency: "USD" },
  bs: { label: "Bolívares", short: "Bs", icon: "🇻🇪", color: "var(--c-bs)", currency: "BS" },
};

const baseTime = 1749330000000; // referencia para ordenar/relativizar tiempos

/* ---- Modo demo (GitHub Pages, sin backend) ---------------- */
// En github.io no hay servidor: la app guarda todo en el navegador.
// En local (u otro host con backend) usa la API real.
export const DEMO = typeof location !== "undefined" &&
  (location.hostname.endsWith("github.io") || location.search.includes("demo=1") || import.meta.env.VITE_DEMO === "1");
const D_SESSION = "cuadre.demo.session";
const D_STATE = "cuadre.demo.state";

/* ---- Cliente del backend ---------------------------------- */
const API = "/api";
const TOKEN_KEY = "cuadre.token";
let token = localStorage.getItem(TOKEN_KEY) || null;
let profile = null;

function emptyState() {
  return { rate: 0, rates: { bcv: null, euro: null, binance: null, updatedAt: null }, accounts: [], clients: [], ops: [] };
}
let state = emptyState();

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let msg = "Error de conexión con el servidor";
    try { msg = (await res.json()).error || msg; } catch (e) { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

/* ---- Estado reactivo + guardado en la nube ---------------- */
const listeners = new Set();
let saveTimer = null;
function emit(persist = true) {
  listeners.forEach((l) => l());
  if (!persist || !token) return;
  if (DEMO || token === "local") {
    localStorage.setItem(D_STATE, JSON.stringify(state));
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { api("/state", { method: "PUT", body: { state } }).catch(() => {}); }, 450);
}
function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }
function snapshot() { return state; }

export function useStore() {
  return useSyncExternalStore(subscribe, snapshot);
}

/* ---- Acciones --------------------------------------------- */
export function setRate(rate) {
  state = { ...state, rate: +rate || state.rate };
  emit();
}

export function setRates(patch) {
  state = { ...state, rates: { ...state.rates, ...patch } };
  emit();
}

// Trae tasas reales de Venezuela (BCV, Euro, Binance/paralelo). Falla en silencio.
export async function fetchLiveRates() {
  try {
    const [usd, eur] = await Promise.all([
      fetch("https://ve.dolarapi.com/v1/dolares").then((r) => r.json()),
      fetch("https://ve.dolarapi.com/v1/euros").then((r) => r.json()),
    ]);
    const bcv = usd.find((x) => x.fuente === "oficial")?.promedio;
    const binance = usd.find((x) => x.fuente === "paralelo")?.promedio;
    const euro = eur.find((x) => x.fuente === "oficial")?.promedio;
    const patch = { updatedAt: new Date().toISOString() };
    if (bcv) patch.bcv = +(+bcv).toFixed(2);
    if (binance) patch.binance = +(+binance).toFixed(2);
    if (euro) patch.euro = +(+euro).toFixed(2);
    setRates(patch);
    return true;
  } catch (e) {
    return false;
  }
}

export function addOp({ clientId, inId, inAmt, outId, outAmt, rate, costRate, profitBs, pct, cross }) {
  const usd = +inAmt;
  const computedProfit = profitBs != null
    ? +(+profitBs).toFixed(2)
    : +(((+rate) - (+costRate || +rate)) * usd).toFixed(2);
  const newOp = {
    id: "o" + (state.ops.length + 1) + "_" + state.ops.length,
    ts: nowOrSeq(),
    date: new Date().toISOString(),
    clientId, inId, inAmt: +inAmt, outId, outAmt: +outAmt,
    rate: +rate, costRate: +costRate || +rate, profitBs: computedProfit,
    pct: pct != null && pct !== "" ? +pct : undefined,
    cross: !!cross,
  };
  const accounts = state.accounts.map((a) => {
    if (a.id === inId) return { ...a, balance: +(a.balance + (+inAmt)).toFixed(2) };
    if (a.id === outId) return { ...a, balance: +(a.balance - (+outAmt)).toFixed(2) };
    return a;
  });
  state = { ...state, ops: [newOp, ...state.ops], accounts };
  emit();
  return newOp;
}

// Limpia cuentas, clientes y operaciones; conserva las tasas (referenciales y del día)
export function clearData() {
  state = { ...state, accounts: [], clients: [], ops: [] };
  emit();
}

export function addClient({ name, phone, note }) {
  const c = { id: "c" + Date.now(), name, phone: phone || "", note: note || "" };
  state = { ...state, clients: [c, ...state.clients] };
  emit();
  return c;
}

export function addAccount({ kind, name, balance }) {
  const meta = CHANNELS[kind];
  const a = { id: "a" + Date.now(), kind, name, currency: meta.currency, balance: +balance || 0 };
  state = { ...state, accounts: [...state.accounts, a] };
  emit();
  return a;
}

// ts incremental para mantener orden sin Date.now determinismo en seed,
// pero en runtime sí usamos un contador creciente basado en el máximo + 1min
function nowOrSeq() {
  const maxTs = state.ops.reduce((m, o) => Math.max(m, o.ts), baseTime);
  return maxTs + 60000;
}

/* ---- Selectores / cálculos -------------------------------- */
export function accountById(s, id) { return s.accounts.find((a) => a.id === id); }
export function clientById(s, id) { return s.clients.find((c) => c.id === id); }

// Valor en USD de un saldo, según moneda y tasa
export function toUSD(amount, currency, rate) {
  if (currency === "BS") return amount / rate;
  return amount; // USD y USDT ~ 1:1
}

// Patrimonio total en USD
export function totalUSD(s) {
  return s.accounts.reduce((sum, a) => sum + toUSD(a.balance, a.currency, s.rate), 0);
}

// Saldo agregado por canal (kind) en su propia moneda
export function balanceByKind(s, kind) {
  return s.accounts.filter((a) => a.kind === kind).reduce((t, a) => t + a.balance, 0);
}

// Ganancia total en Bs (todas las ops) y de "hoy" (las últimas N para demo)
export function profitTotalBs(s) {
  return s.ops.reduce((t, o) => t + (o.profitBs || 0), 0);
}

// Agrupa ganancia por "día relativo" usando ts -> para el mini chart
export function profitByDay(s, days = 7) {
  const DAY = 86400000;
  const maxTs = s.ops.reduce((m, o) => Math.max(m, o.ts), baseTime);
  const buckets = Array.from({ length: days }, () => 0);
  s.ops.forEach((o) => {
    const idx = days - 1 - Math.floor((maxTs - o.ts) / DAY);
    if (idx >= 0 && idx < days) buckets[idx] += o.profitBs || 0;
  });
  return buckets;
}

/* ---- Formato ---------------------------------------------- */
export function fmt(n, dec = 2) {
  return (n || 0).toLocaleString("es-VE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export function fmtUSD(n) { return "$" + fmt(n, 2); }
export function fmtBs(n) { return fmt(n, 2) + " Bs"; }
export function fmtCur(n, currency) {
  if (currency === "BS") return fmt(n, 2) + " Bs";
  if (currency === "USDT") return fmt(n, 2) + " ₮";
  return "$" + fmt(n, 2);
}
export function relTime(ts, s) {
  const maxTs = s.ops.reduce((m, o) => Math.max(m, o.ts), ts);
  const diff = Math.max(0, maxTs - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

/* ---- Estado demo inicial (solo modo Pages) ---------------- */
function seedDemoState() {
  const mk = (id, clientId, inId, inAmt, outId, outAmt, rate, costRate) => ({
    id, ts: baseTime, date: new Date().toISOString(),
    clientId, inId, inAmt, outId, outAmt, rate, costRate,
    profitBs: +((rate - costRate) * inAmt).toFixed(2),
  });
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
      { id: "c3", name: "Inversiones RM C.A.", phone: "0212-5550101", note: "Cliente fijo, alto volumen" },
    ],
    ops: [
      mk("o1", "c1", "a3", 500, "a4", 381000, 762, 750),
      mk("o2", "c3", "a2", 1200, "a5", 910800, 759, 748),
      mk("o3", "c2", "a1", 80, "a4", 60880, 761, 752),
    ],
  };
}

/* ---- Sesión / multi-cliente ------------------------------- */
// Acceso rápido temporal (mientras montamos Firebase)
function isAdmin(email, password) {
  return (email || "").trim().toLowerCase() === "admin" && (password || "") === "admin";
}

export function getToken() {
  return token || (localStorage.getItem(D_SESSION) ? "local" : null);
}
export function getSession() {
  if (profile) return profile;
  try { const ds = localStorage.getItem(D_SESSION); if (ds) return JSON.parse(ds); } catch (e) { /* ignore */ }
  return token ? { name: "", email: "" } : null;
}

export async function register({ email, password, name }) {
  if (DEMO || isAdmin(email, password)) return localEnter(email, name, true);
  const r = await api("/register", { method: "POST", body: { email, password, name } });
  token = r.token; localStorage.setItem(TOKEN_KEY, token);
  profile = r.user;
  await loadState();
  return r.user;
}
export async function login(email, password) {
  if (isAdmin(email, password)) return localEnter("admin@cuadre.com", "Admin", false);
  if (DEMO) return localEnter(email, null, false);
  const r = await api("/login", { method: "POST", body: { email, password } });
  token = r.token; localStorage.setItem(TOKEN_KEY, token);
  profile = r.user;
  await loadState();
  return r.user;
}
export function logout() {
  localStorage.removeItem(D_SESSION); localStorage.removeItem(D_STATE); localStorage.removeItem(TOKEN_KEY);
  token = null; profile = null; state = emptyState(); emit(false);
}
// Restaura sesión al abrir la app
export async function bootstrap() {
  // sesión local (admin / demo) tiene prioridad
  const ds = localStorage.getItem(D_SESSION);
  if (ds && (!token || token === "local")) {
    token = "local"; profile = JSON.parse(ds);
    try { state = { ...emptyState(), ...JSON.parse(localStorage.getItem(D_STATE)) }; }
    catch (e) { state = seedDemoState(); localStorage.setItem(D_STATE, JSON.stringify(state)); }
    emit(false);
    return profile;
  }
  if (!token) return null;
  const me = await api("/me");
  profile = me;
  await loadState();
  return me;
}
async function loadState() {
  const data = await api("/state");
  state = { ...emptyState(), ...data };
  emit(false);
}

// Crea/entra a una sesión local (admin o demo), guardada en el navegador
function localEnter(email, name, isNew) {
  const clean = (email || "demo@cuadre.com").trim();
  const existing = localStorage.getItem(D_STATE);
  const sess = { email: clean, name: (name || clean.split("@")[0]).trim(), business: "", phone: "" };
  localStorage.setItem(D_SESSION, JSON.stringify(sess));
  token = "local"; profile = sess;
  state = (isNew || !existing) ? seedDemoState() : { ...emptyState(), ...JSON.parse(existing) };
  localStorage.setItem(D_STATE, JSON.stringify(state));
  emit(false);
  return sess;
}

/* ---- Perfil del usuario ----------------------------------- */
export function getProfile() { return profile; }
export async function saveProfile(patch) {
  if (DEMO) {
    profile = { ...(profile || {}), ...patch };
    localStorage.setItem(D_SESSION, JSON.stringify(profile));
    emit(false);
    return profile;
  }
  const u = await api("/profile", { method: "PUT", body: patch });
  profile = u;
  emit(false);
  return u;
}
export async function changePassword(current, next) {
  if (DEMO) return true; // sin backend, sólo demostración
  await api("/password", { method: "PUT", body: { current, next } });
  return true;
}
