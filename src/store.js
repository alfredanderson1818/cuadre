/* ============================================================
   CUADRE — capa de datos (estado en la nube por usuario, vía backend)
   ============================================================ */
import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

/* ---- Metadatos de canales --------------------------------- */
export const CHANNELS = {
  cash: { label: "USD efectivo", short: "Efectivo", icon: "$", color: "var(--c-cash)", currency: "USD" },
  usdt: { label: "USDT / cripto", short: "USDT", icon: "₮", color: "var(--c-usdt)", currency: "USDT" },
  zelle: { label: "Zelle / Transfer", short: "Zelle", icon: "🇺🇸", color: "var(--c-zelle)", currency: "USD" },
  bs: { label: "Bolívares", short: "Bs", icon: "🇻🇪", color: "var(--c-bs)", currency: "BS" },
};

const baseTime = 1749330000000; // referencia para ordenar/relativizar tiempos

/* ---- Sesión: "supa" (Supabase) o "local" (admin/admin) ---- */
const D_SESSION = "cuadre.local.session"; // sólo para el modo admin local
const D_STATE = "cuadre.local.state";
let token = null;        // "supa" | "local" | null
let supaUser = null;     // usuario de Supabase
let profile = null;      // { email, name, business, phone }
let access = null;       // { active, plan, paid_until } — control de acceso (pago)

function emptyState() {
  return { rate: 0, rates: { bcv: null, euro: null, binance: null, updatedAt: null }, accounts: [], clients: [], ops: [] };
}
let state = emptyState();

/* ---- Estado reactivo + guardado en la nube ---------------- */
const listeners = new Set();
let saveTimer = null;
function emit(persist = true) {
  listeners.forEach((l) => l());
  if (!persist || !token) return;
  if (token === "local") {
    localStorage.setItem(D_STATE, JSON.stringify(state));
    return;
  }
  // Supabase: guarda el blob del usuario (debounced)
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!supaUser) return;
    supabase.from("app_state")
      .upsert({ user_id: supaUser.id, data: state, updated_at: new Date().toISOString() })
      .then(() => {}, () => {});
  }, 600);
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

/* ---- Estado inicial para una cuenta nueva (real) ---------- */
// Cuentas base en cero (listas para usar); sin clientes ni operaciones.
function seedFresh() {
  return {
    rate: 0,
    rates: { bcv: null, euro: null, binance: null, updatedAt: null },
    accounts: [
      { id: "a1", kind: "cash", name: "Efectivo $", currency: "USD", balance: 0 },
      { id: "a2", kind: "usdt", name: "Binance USDT", currency: "USDT", balance: 0 },
      { id: "a3", kind: "zelle", name: "Zelle", currency: "USD", balance: 0 },
      { id: "a4", kind: "bs", name: "Banco de Venezuela", currency: "BS", balance: 0 },
    ],
    clients: [],
    ops: [],
    profile: { name: "", business: "", phone: "" },
  };
}

/* ---- Estado demo (modo admin/admin local) ----------------- */
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

/* ---- Sesión / multi-cliente (Supabase + admin local) ------ */
function isAdmin(email, password) {
  return (email || "").trim().toLowerCase() === "admin" && (password || "") === "admin";
}
// Traduce errores comunes de Supabase al español
function traduce(msg) {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ese correo ya está registrado";
  if (m.includes("email not confirmed")) return "Confirma tu correo antes de entrar (revisa tu bandeja)";
  if (m.includes("password should be")) return "La contraseña debe tener al menos 6 caracteres";
  if (m.includes("unable to validate email")) return "Correo inválido";
  if (m.includes("fetch")) return "Sin conexión. Revisa tu internet.";
  return msg || "Ocurrió un error";
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
  if (isAdmin(email, password)) return localEnter("admin@cuadre.com", "Admin");
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name } } });
  if (error) throw new Error(traduce(error.message));
  if (!data.session) {
    // Confirmación de correo activada: aún no hay sesión
    throw new Error("Te enviamos un correo para confirmar tu cuenta. Confírmalo y luego inicia sesión.");
  }
  supaUser = data.user; token = "supa";
  state = { ...seedFresh(), profile: { name: name || "", business: "", phone: "" } };
  await supabase.from("app_state").upsert({ user_id: supaUser.id, data: state });
  setProfileFromState();
  emit(false);
  return profile;
}

export async function login(email, password) {
  if (isAdmin(email, password)) return localEnter("admin@cuadre.com", "Admin");
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(traduce(error.message));
  supaUser = data.user; token = "supa";
  await loadSupaState();
  return profile;
}

export async function logout() {
  if (token === "supa") { try { await supabase.auth.signOut(); } catch (e) { /* ignore */ } }
  localStorage.removeItem(D_SESSION); localStorage.removeItem(D_STATE);
  token = null; profile = null; supaUser = null; access = null; state = emptyState();
  emit(false);
}

// Restaura sesión al abrir la app
export async function bootstrap() {
  // 1) sesión local (admin) tiene prioridad
  const ds = localStorage.getItem(D_SESSION);
  if (ds) {
    token = "local"; profile = JSON.parse(ds);
    try { state = { ...emptyState(), ...JSON.parse(localStorage.getItem(D_STATE)) }; }
    catch (e) { state = seedDemoState(); localStorage.setItem(D_STATE, JSON.stringify(state)); }
    emit(false);
    return profile;
  }
  // 2) sesión de Supabase
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    supaUser = data.session.user; token = "supa";
    await loadSupaState();
    return profile;
  }
  return null;
}

// Carga (o inicializa) el estado del usuario desde Supabase
async function loadSupaState() {
  const { data: row } = await supabase.from("app_state").select("data").eq("user_id", supaUser.id).maybeSingle();
  if (row && row.data && Object.keys(row.data).length) {
    state = { ...emptyState(), ...row.data };
  } else {
    const meta = supaUser.user_metadata || {};
    state = { ...seedFresh(), profile: { name: meta.name || "", business: "", phone: "" } };
    await supabase.from("app_state").upsert({ user_id: supaUser.id, data: state });
  }
  setProfileFromState();
  await refreshAccess();
  emit(false);
}

// Consulta el estado de acceso (pago) del usuario. Fail-open si la tabla no existe aún.
export async function refreshAccess() {
  if (token !== "supa" || !supaUser) { access = { active: true }; return access; }
  const { data, error } = await supabase.from("access")
    .select("active,plan,paid_until").eq("user_id", supaUser.id).maybeSingle();
  if (error) { access = { active: true, _nogate: true }; } // tabla no creada aún → no bloquear
  else access = data || { active: false };
  return access;
}
export function getAccess() {
  if (token === "local") return { active: true };
  return access || { active: false };
}

function setProfileFromState() {
  const p = state.profile || {};
  const meta = supaUser?.user_metadata || {};
  profile = {
    email: supaUser?.email || "",
    name: p.name || meta.name || meta.full_name || (supaUser?.email || "").split("@")[0],
    business: p.business || "",
    phone: p.phone || "",
  };
}

/* ---- Inicio con Google (OAuth) ---------------------------- */
export async function loginWithGoogle() {
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error) throw new Error(traduce(error.message));
}

/* ---- Exportar datos (CSV por período) --------------------- */
export function filterOpsByRange(s, range) {
  if (range === "all") return s.ops.slice();
  const now = new Date();
  return s.ops.filter((o) => {
    const d = o.date ? new Date(o.date) : null;
    if (!d) return range === "all";
    if (range === "day") return d.toDateString() === now.toDateString();
    if (range === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (range === "year") return d.getFullYear() === now.getFullYear();
    return true;
  });
}

export function opsToCSV(s, range) {
  const ops = filterOpsByRange(s, range);
  const head = ["Fecha", "Cliente", "Tipo", "Recibí", "Canal entra", "Entregué", "Canal sale", "Tasa", "%", "Ganancia Bs", "Ganancia USD"];
  const rows = ops.map((o) => {
    const cli = clientById(s, o.clientId);
    const inA = accountById(s, o.inId);
    const outA = accountById(s, o.outId);
    const fecha = o.date ? new Date(o.date).toLocaleString("es-VE") : "";
    const pct = o.pct != null ? o.pct : (o.costRate ? ((o.rate / o.costRate) - 1) * 100 : 0);
    const gUSD = o.cross ? (o.inAmt - o.outAmt) : (o.rate ? o.profitBs / o.rate : 0);
    return [
      fecha, cli?.name || "", o.cross ? "divisa-divisa" : "con bolívares",
      o.inAmt, inA?.name || "", o.outAmt, outA?.name || "",
      o.cross ? "" : o.rate, (+pct).toFixed(2), o.profitBs, (+gUSD).toFixed(2),
    ];
  });
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  return [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

// Respaldo completo (JSON) de todo el estado
export function fullBackupJSON(s) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), ...s }, null, 2);
}

// Crea/entra a la sesión local de prueba (admin/admin)
function localEnter(email, name) {
  const existing = localStorage.getItem(D_STATE);
  const sess = { email, name, business: "", phone: "" };
  localStorage.setItem(D_SESSION, JSON.stringify(sess));
  token = "local"; profile = sess;
  state = existing ? { ...emptyState(), ...JSON.parse(existing) } : seedDemoState();
  localStorage.setItem(D_STATE, JSON.stringify(state));
  emit(false);
  return sess;
}

/* ---- Perfil del usuario ----------------------------------- */
export function getProfile() { return profile; }
export async function saveProfile(patch) {
  profile = { ...(profile || {}), ...patch };
  if (token === "local") {
    localStorage.setItem(D_SESSION, JSON.stringify(profile));
    emit(false);
  } else {
    // guarda los campos de perfil dentro del blob del usuario
    state = { ...state, profile: { name: profile.name, business: profile.business, phone: profile.phone } };
    emit(true);
  }
  return profile;
}
export async function changePassword(current, next) {
  if (token === "local") return true;
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw new Error(traduce(error.message));
  return true;
}
