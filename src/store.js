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
  if (persist && token) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { api("/state", { method: "PUT", body: { state } }).catch(() => {}); }, 450);
  }
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

export function addOp({ clientId, inId, inAmt, outId, outAmt, rate, costRate }) {
  const usd = +inAmt;
  const profitBs = +(((+rate) - (+costRate || +rate)) * usd).toFixed(2);
  const newOp = {
    id: "o" + (state.ops.length + 1) + "_" + state.ops.length,
    ts: nowOrSeq(),
    date: new Date().toISOString(),
    clientId, inId, inAmt: +inAmt, outId, outAmt: +outAmt,
    rate: +rate, costRate: +costRate || +rate, profitBs,
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

/* ---- Sesión / multi-cliente (backend real) ---------------- */
export function getToken() { return token; }
export function getSession() { return token ? (profile || { name: "", email: "" }) : null; }

export async function register({ email, password, name }) {
  const r = await api("/register", { method: "POST", body: { email, password, name } });
  token = r.token; localStorage.setItem(TOKEN_KEY, token);
  profile = r.user;
  await loadState();
  return r.user;
}
export async function login(email, password) {
  const r = await api("/login", { method: "POST", body: { email, password } });
  token = r.token; localStorage.setItem(TOKEN_KEY, token);
  profile = r.user;
  await loadState();
  return r.user;
}
export function logout() {
  token = null; profile = null;
  localStorage.removeItem(TOKEN_KEY);
  state = emptyState();
  emit(false);
}
// Restaura sesión al abrir la app (si hay token guardado).
export async function bootstrap() {
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

/* ---- Perfil del usuario (backend) ------------------------- */
export function getProfile() { return profile; }
export async function saveProfile(patch) {
  const u = await api("/profile", { method: "PUT", body: patch });
  profile = u;
  emit(false);
  return u;
}
export async function changePassword(current, next) {
  await api("/password", { method: "PUT", body: { current, next } });
  return true;
}
