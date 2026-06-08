import { useEffect, useMemo, useState } from "react";
import {
  CHANNELS, useStore, addOp, addClient, addAccount, setRate,
  accountById, clientById, totalUSD, balanceByKind, profitTotalBs, profitByDay,
  fmt, fmtUSD, fmtBs, fmtCur, relTime, toUSD,
  getToken, getSession, login, register, logout, bootstrap, getProfile, saveProfile, fetchLiveRates,
} from "./store";
import { sendWhatsApp, downloadPDF } from "./receipt";

/* ============================== BRAND MARK ============================== */
function BrandMark({ size = 40 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <defs>
          <linearGradient id="cuadre-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c8fa5c" />
            <stop offset="1" stopColor="#69c12c" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="40" height="40" rx="13" fill="url(#cuadre-grad)" />
        <g stroke="#0c1407" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M13 17 H29" />
          <path d="M25.5 13.5 L29 17 L25.5 20.5" />
          <path d="M31 27 H15" />
          <path d="M18.5 23.5 L15 27 L18.5 30.5" />
        </g>
      </svg>
    </span>
  );
}

/* ============================== ICONS ============================== */
const I = {
  home: <path d="M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5" />,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1.4" /><circle cx="3.5" cy="12" r="1.4" /><circle cx="3.5" cy="18" r="1.4" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18M16 14h2" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.6M17 20a5.2 5.2 0 0 0-2.5-4.3" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
};
function Icon({ d, ...p }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" {...p}>{d}</svg>
  );
}

/* ============================== APP =============================== */
export default function App() {
  const [session, setSession] = useState(() => (getToken() ? "loading" : null));
  const [tab, setTab] = useState("home");
  const [sheet, setSheet] = useState(null); // 'op' | 'client' | 'rate' | 'account' | 'profile' | null
  const [detailId, setDetailId] = useState(null);
  const [group, setGroup] = useState(null);
  const [clientDetailId, setClientDetailId] = useState(null);
  const s = useStore();

  // Restaura sesión guardada al abrir
  useEffect(() => {
    if (session === "loading") {
      bootstrap().then((u) => setSession(u || null)).catch(() => { logout(); setSession(null); });
    }
  }, []);

  // Trae tasas en vivo una vez con sesión activa
  useEffect(() => { if (session && session !== "loading") fetchLiveRates(); }, [session && session !== "loading"]);

  if (session === "loading") return <Splash />;
  if (!session) return <Login onLogin={setSession} />;

  function doLogout() { logout(); setSession(null); }
  const detailOp = detailId ? s.ops.find((o) => o.id === detailId) : null;

  return (
    <div className="shell">
      <main className="screen" key={tab}>
        {tab === "home" && <Home s={s} session={session} go={setTab} openSheet={setSheet} openDetail={setDetailId} />}
        {tab === "ops" && <Ops s={s} openDetail={setDetailId} />}
        {tab === "wallets" && <Wallets s={s} openSheet={setSheet} />}
        {tab === "clients" && <Clients s={s} openSheet={setSheet} openClient={setClientDetailId} />}
        {tab === "reports" && <Reports s={s} openGroup={setGroup} />}
      </main>

      <Nav tab={tab} setTab={setTab} onAdd={() => setSheet("op")} />

      {sheet === "op" && <OpSheet s={s} onClose={() => setSheet(null)} />}
      {sheet === "client" && <ClientSheet onClose={() => setSheet(null)} />}
      {sheet === "rate" && <RateSheet s={s} onClose={() => setSheet(null)} />}
      {sheet === "account" && <AccountSheet onClose={() => setSheet(null)} />}
      {sheet === "profile" && <ProfileSheet session={session} onClose={() => setSheet(null)} onLogout={doLogout} />}
      {group && <GroupSheet group={group} s={s} onClose={() => setGroup(null)} openDetail={(id) => { setGroup(null); setDetailId(id); }} />}
      {clientDetailId && <ClientDetailSheet client={s.clients.find((c) => c.id === clientDetailId)} s={s} onClose={() => setClientDetailId(null)} openDetail={(id) => { setClientDetailId(null); setDetailId(id); }} />}
      {detailOp && <OpDetailSheet op={detailOp} s={s} onClose={() => setDetailId(null)} />}
    </div>
  );
}

/* ============================== CLIENT DETAIL ============================== */
function ClientDetailSheet({ client, s, onClose, openDetail }) {
  if (!client) return null;
  const ops = s.ops.filter((o) => o.clientId === client.id);
  const vol = ops.reduce((t, o) => t + o.inAmt, 0);
  const profit = ops.reduce((t, o) => t + (o.profitBs || 0), 0);
  return (
    <Sheet onClose={onClose} title={client.name} lead={client.note || "Cliente registrado"}>
      <div className="dt-client" style={{ marginBottom: 16 }}>
        <div className="row-ic" style={{ width: 52, height: 52, fontSize: 22, background: "var(--surface-hi)", color: "var(--green)", fontFamily: "var(--font-display)", fontWeight: 700, borderRadius: 16 }}>
          {client.name.charAt(0)}
        </div>
        <div>
          <div className="dt-client-name">{client.name}</div>
          <div className="dt-client-sub">{client.phone || "Sin teléfono"}</div>
        </div>
        {client.phone && (
          <a className="wa-mini" href={`https://wa.me/${vePhoneJS(client.phone)}`} target="_blank" rel="noreferrer" title="WhatsApp">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z"/></svg>
          </a>
        )}
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="mini-stat"><div className="ms-k">Operaciones</div><div className="ms-v">{ops.length}</div></div>
        <div className="mini-stat"><div className="ms-k">Volumen</div><div className="ms-v">${fmt(vol, 0)}</div></div>
        <div className="mini-stat"><div className="ms-k">Ganancia generada</div><div className="ms-v" style={{ color: "var(--green)" }}>+{fmt(profit, 0)} Bs</div><div className="ms-sub">para ti</div></div>
        <div className="mini-stat"><div className="ms-k">Ticket promedio</div><div className="ms-v">${fmt(ops.length ? vol / ops.length : 0, 0)}</div></div>
      </div>

      <div className="section-head" style={{ margin: "2px 2px 10px" }}><h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>Historial</h3></div>
      <div className="card">
        {ops.length === 0
          ? <Empty icon="💱" text="Este cliente aún no tiene operaciones." />
          : ops.map((o) => <OpRow key={o.id} o={o} s={s} onClick={openDetail} />)}
      </div>
    </Sheet>
  );
}
// Normaliza teléfono venezolano para enlaces de WhatsApp
function vePhoneJS(raw) {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("58")) return d;
  if (d.startsWith("0")) return "58" + d.slice(1);
  return "58" + d;
}

/* ============================== GROUP SHEET ============================== */
function GroupSheet({ group, s, onClose, openDetail }) {
  const ops = group.ops || [];
  const totalProfit = ops.reduce((t, o) => t + (o.profitBs || 0), 0);
  const vol = ops.reduce((t, o) => t + o.inAmt, 0);
  return (
    <Sheet onClose={onClose} title={group.title} lead={`${ops.length} operaciones · vol $${fmt(vol, 0)} · +${fmt(totalProfit)} Bs`}>
      <div className="card" style={{ marginBottom: 4 }}>
        {ops.length === 0
          ? <Empty icon="💱" text="Sin operaciones en este grupo." />
          : ops.map((o) => <OpRow key={o.id} o={o} s={s} onClick={openDetail} />)}
      </div>
    </Sheet>
  );
}

/* ============================== SPLASH ============================== */
function Splash() {
  return (
    <div className="shell auth">
      <div className="auth-glow" />
      <div className="splash">
        <BrandMark size={64} />
        <div className="brand-name" style={{ fontSize: 26, marginTop: 14 }}>Cua<b>dre</b></div>
        <div className="splash-dots"><span /><span /><span /></div>
      </div>
    </div>
  );
}

/* ============================== LOGIN ============================== */
function Login({ onLogin }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const isReg = mode === "register";
  const valid = email.trim().length > 2 && pass.length >= 4 && (!isReg || name.trim().length > 0);

  async function submit(e) {
    e?.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setErr("");
    try {
      const user = isReg
        ? await register({ email, password: pass, name })
        : await login(email, pass);
      onLogin(user);
    } catch (e2) {
      setErr(e2.message || "No se pudo conectar");
      setBusy(false);
    }
  }

  return (
    <div className="shell auth">
      <div className="auth-glow" />
      <form className="auth-card stagger" onSubmit={submit} noValidate>
        <div className="auth-brand">
          <BrandMark size={44} />
          <div className="brand-name">Cua<b>dre</b></div>
        </div>
        <h1 className="auth-title">{isReg ? "Crea tu cuenta" : "Bienvenido de vuelta"}</h1>
        <p className="auth-lead">{isReg ? "Empieza a controlar tus cambios en minutos." : "Entra a tu cuenta para controlar tus cambios."}</p>

        {isReg && (
          <div className="field">
            <label>Nombre o negocio</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Cambios JM" />
          </div>
        )}
        <div className="field">
          <label>Correo o usuario</label>
          <input className="input" type="text" inputMode="email" autoCapitalize="off" placeholder="tucorreo@ejemplo.com"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input className="input" type="password" placeholder="••••••••"
            value={pass} onChange={(e) => setPass(e.target.value)} />
        </div>

        {err && <p className="auth-err">{err}</p>}

        <button className={`btn ${valid && !busy ? "btn-primary" : "btn-ghost"}`} type="submit" disabled={!valid || busy}>
          {busy ? "Un momento…" : isReg ? "Crear cuenta" : "Iniciar sesión"}
        </button>

        {!isReg && (
          <button type="button" className="auth-quick" onClick={() => { setEmail("admin"); setPass("admin"); }}>
            Probar con <b>admin / admin</b>
          </button>
        )}

        <div className="auth-foot">
          {isReg ? (
            <span>¿Ya tienes cuenta? <b className="auth-link" onClick={() => { setMode("login"); setErr(""); }}>Inicia sesión</b></span>
          ) : (
            <span>¿Sin cuenta? <b className="auth-link" onClick={() => { setMode("register"); setErr(""); }}>Créala aquí</b></span>
          )}
        </div>
      </form>
      <div className="auth-badge">Maben Software Development · 2018</div>
    </div>
  );
}

/* ============================== NAV ============================== */
function Nav({ tab, setTab, onAdd }) {
  const items = [
    { id: "home", label: "Inicio", d: I.home },
    { id: "wallets", label: "Cuentas", d: I.wallet },
  ];
  const items2 = [
    { id: "clients", label: "Clientes", d: I.users },
    { id: "reports", label: "Reportes", d: I.chart },
  ];
  return (
    <nav className="nav">
      <div className="nav-inner">
        {items.map((it) => (
          <button key={it.id} className={`nav-item ${tab === it.id ? "active" : ""}`} onClick={() => setTab(it.id)}>
            <Icon d={it.d} /><span>{it.label}</span>
          </button>
        ))}
        <button className="nav-fab" onClick={onAdd} aria-label="Nueva operación"><Icon d={I.plus} /></button>
        {items2.map((it) => (
          <button key={it.id} className={`nav-item ${tab === it.id ? "active" : ""}`} onClick={() => setTab(it.id)}>
            <Icon d={it.d} /><span>{it.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ============================== HOME ============================== */
function Home({ s, session, go, openSheet, openDetail }) {
  const total = totalUSD(s);
  const profitBs = profitTotalBs(s);
  const profitUSD = profitBs / s.rate;
  const initial = (getProfile()?.name || session?.name || "U").charAt(0).toUpperCase();

  return (
    <div className="stagger">
      <div className="appbar">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">Cua<b>dre</b></div>
            <div className="brand-sub">control de cambios</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <button className="pill-rate" onClick={() => openSheet("rate")}>
            <span className="dot" /> {fmt(s.rate, 2)} Bs/$
          </button>
          <button className="avatar" onClick={() => openSheet("profile")} title="Perfil">
            {initial}
          </button>
        </div>
      </div>

      <div className="hero">
        <div className="hero-label"><span className="hero-dot" /> Patrimonio total · equiv. USD</div>
        <div className="hero-amount"><span className="cur">$</span>{fmt(total, 2)}</div>
        <div className="hero-sub">
          <div className="hero-stat">
            <div className="k">Ganancia acumulada</div>
            <div className="v up">+{fmtBs(profitBs)}</div>
          </div>
          <div className="hero-stat">
            <div className="k">≈ en USD</div>
            <div className="v up">+{fmtUSD(profitUSD)}</div>
          </div>
        </div>
      </div>

      <RatesStrip s={s} />

      <div className="channels">
        {Object.keys(CHANNELS).map((kind) => {
          const meta = CHANNELS[kind];
          const bal = balanceByKind(s, kind);
          const suffix = meta.currency === "BS" ? "Bs" : meta.currency === "USDT" ? "₮" : "$";
          return (
            <div className="chan" key={kind}>
              <div className="chan-top">
                <div className="chan-ic" style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}>{meta.icon}</div>
                <div className="chan-name">{meta.short}</div>
              </div>
              <div className="chan-bal">{fmt(bal, meta.currency === "BS" ? 0 : 2)}<span className="chan-cur"> {suffix}</span></div>
            </div>
          );
        })}
      </div>

      <div className="section-head">
        <h3>Últimos cambios</h3>
        <button className="link-btn" onClick={() => go("ops")}>Ver todo</button>
      </div>
      <div className="card">
        {s.ops.slice(0, 4).map((o) => <OpRow key={o.id} o={o} s={s} onClick={openDetail} />)}
      </div>
    </div>
  );
}

/* ============================== RATES STRIP ============================== */
function RatesStrip({ s }) {
  const r = s.rates || {};
  const [loading, setLoading] = useState(false);
  const when = r.updatedAt
    ? new Date(r.updatedAt).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
    : null;
  async function refresh() { setLoading(true); await fetchLiveRates(); setLoading(false); }
  return (
    <>
      <div className="rates-head">
        <div className="t"><h3>Tasas de referencia</h3></div>
        <div className="rates-when">
          {loading ? "Actualizando…" : when ? `Hoy ${when}` : "En vivo"}
          <button className="rates-refresh" onClick={refresh} aria-label="Actualizar tasas">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={loading ? { animation: "spin 1s linear infinite" } : {}}>
              <path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </div>
      <div className="rates">
        <RateCard cls="bcv" label="BCV" sub="Dólar oficial" value={r.bcv} unit="Bs" />
        <RateCard cls="euro" label="Euro" sub="BCV" value={r.euro} unit="Bs" />
        <RateCard cls="bin" label="Binance" sub="USDT" value={r.binance} unit="Bs" />
      </div>
    </>
  );
}
function RateCard({ cls, label, sub, value, unit }) {
  return (
    <div className={`rate-card ${cls}`}>
      <div className="rl"><span className="rdot" /> {label}</div>
      <div className="rs">{sub}</div>
      <div className="rv">{value ? fmt(value, 2) : "—"} <span className="ru">{unit}</span></div>
    </div>
  );
}

/* ============================== OP ROW ============================== */
function OpRow({ o, s, onClick }) {
  const cli = clientById(s, o.clientId);
  const inAcc = accountById(s, o.inId);
  const outAcc = accountById(s, o.outId);
  const inMeta = CHANNELS[inAcc?.kind];
  const outMeta = CHANNELS[outAcc?.kind];
  return (
    <div className={`row ${onClick ? "row-tap" : ""}`} onClick={onClick ? () => onClick(o.id) : undefined}>
      <div className="row-ic" style={{ background: `color-mix(in srgb, ${inMeta?.color} 16%, transparent)`, color: inMeta?.color }}>
        {inMeta?.icon}
      </div>
      <div className="row-main">
        <div className="row-title">{cli?.name || "Sin cliente"}</div>
        <div className="row-sub">
          <span className="tag in">+{inMeta?.short}</span>
          <span className="tag out">−{outMeta?.short}</span>
          <span>· {relTime(o.ts, s)}</span>
        </div>
      </div>
      <div className="row-amt">
        <div className="a">{fmtCur(o.inAmt, inAcc?.currency)}</div>
        <div className="b" style={{ color: o.profitBs < 0 ? "var(--coral)" : "var(--green)" }}>{o.profitBs >= 0 ? "+" : ""}{fmt(o.profitBs)} Bs</div>
      </div>
    </div>
  );
}

/* ============================== OPS LIST ============================== */
function Ops({ s, openDetail }) {
  return (
    <div className="stagger">
      <div className="eyebrow">Historial</div>
      <h1 className="screen-title">Cambios <span className="accent">realizados</span></h1>
      <p className="screen-lead">{s.ops.length} operaciones · ganancia total +{fmtBs(profitTotalBs(s))}</p>
      <div style={{ height: 18 }} />
      <div className="card">
        {s.ops.length === 0
          ? <Empty icon="💱" text="Aún no has registrado cambios. Toca el botón + para empezar." />
          : s.ops.map((o) => <OpRow key={o.id} o={o} s={s} onClick={openDetail} />)}
      </div>
    </div>
  );
}

/* ============================== WALLETS ============================== */
function Wallets({ s, openSheet }) {
  return (
    <div className="stagger">
      <div className="eyebrow">Inventario</div>
      <h1 className="screen-title">Mis <span className="accent">cuentas</span></h1>
      <p className="screen-lead">Saldo por canal y por cuenta. Equiv. total ${fmt(totalUSD(s))}.</p>
      <div style={{ height: 16 }} />
      <button className="btn btn-ghost" onClick={() => openSheet("account")} style={{ marginBottom: 18 }}>+ Nueva cuenta</button>
      {Object.keys(CHANNELS).map((kind) => {
        const meta = CHANNELS[kind];
        const accs = s.accounts.filter((a) => a.kind === kind);
        if (!accs.length) return null;
        const sub = balanceByKind(s, kind);
        return (
          <div className="card" key={kind}>
            <div className="section-head" style={{ margin: "0 0 6px" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: meta.color }}>{meta.icon}</span> {meta.label}
              </h3>
              <span className="pill-rate" style={{ padding: "5px 10px" }}>{fmtCur(sub, meta.currency)}</span>
            </div>
            {accs.map((a) => (
              <div className="row" key={a.id}>
                <div className="row-ic" style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}>{meta.icon}</div>
                <div className="row-main">
                  <div className="row-title">{a.name}</div>
                  <div className="row-sub">≈ ${fmt(toUSD(a.balance, a.currency, s.rate))}</div>
                </div>
                <div className="row-amt"><div className="a">{fmtCur(a.balance, a.currency)}</div></div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ============================== CLIENTS ============================== */
function Clients({ s, openSheet, openClient }) {
  return (
    <div className="stagger">
      <div className="eyebrow">Cartera</div>
      <h1 className="screen-title">Mis <span className="accent">clientes</span></h1>
      <p className="screen-lead">{s.clients.length} registrados · toca uno para ver su ficha.</p>
      <div style={{ height: 16 }} />
      <button className="btn btn-ghost" onClick={() => openSheet("client")} style={{ marginBottom: 16 }}>+ Nuevo cliente</button>
      <div className="card">
        {s.clients.map((c) => {
          const ops = s.ops.filter((o) => o.clientId === c.id);
          const vol = ops.reduce((t, o) => t + o.inAmt, 0);
          return (
            <div className="row row-tap" key={c.id} onClick={() => openClient(c.id)}>
              <div className="row-ic" style={{ background: "var(--surface-hi)", color: "var(--green)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                {c.name.charAt(0)}
              </div>
              <div className="row-main">
                <div className="row-title">{c.name}</div>
                <div className="row-sub">{c.phone || "Sin teléfono"}{c.note ? ` · ${c.note}` : ""}</div>
              </div>
              <div className="row-amt">
                <div className="a">{ops.length} ops</div>
                <div className="b">vol ${fmt(vol, 0)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== REPORTS ============================== */
function Reports({ s, openGroup }) {
  const days = profitByDay(s, 7);
  const max = Math.max(...days, 1);
  const totalBs = profitTotalBs(s);
  const labels = ["L", "M", "M", "J", "V", "S", "D"];
  const ops = s.ops;
  const volUSD = ops.reduce((t, o) => t + o.inAmt, 0);
  const n = ops.length || 1;
  const ticket = volUSD / n;                          // ticket promedio en $
  const spreadProm = volUSD ? totalBs / volUSD : 0;    // Bs ganados por cada $ movido
  const biggest = ops.reduce((m, o) => (o.profitBs > (m?.profitBs || 0) ? o : m), null);
  const activeClients = new Set(ops.map((o) => o.clientId)).size;
  const chans = channelMargins(s);
  const tops = topClients(s).slice(0, 4);

  return (
    <div className="stagger">
      <div className="eyebrow">Resultados</div>
      <h1 className="screen-title">Tu <span className="accent">ganancia</span></h1>
      <p className="screen-lead">El negocio vive del spread. Aquí lo ves claro.</p>
      <div style={{ height: 18 }} />

      <div className="hero" style={{ marginBottom: 14 }}>
        <div className="hero-label">Ganancia acumulada</div>
        <div className="hero-amount" style={{ fontSize: 40 }}>+{fmt(totalBs, 2)}<span className="cur" style={{ marginLeft: 8 }}>Bs</span></div>
        <div className="hero-sub">
          <div className="hero-stat"><div className="k">≈ USD</div><div className="v up">+{fmtUSD(totalBs / s.rate)}</div></div>
          <div className="hero-stat"><div className="k">Volumen</div><div className="v">${fmt(volUSD, 0)}</div></div>
          <div className="hero-stat"><div className="k">Operaciones</div><div className="v">{ops.length}</div></div>
        </div>
      </div>

      <div className="stat-grid">
        <MiniStat k="Ticket promedio" v={`$${fmt(ticket, 0)}`} sub="por operación" />
        <MiniStat k="Spread promedio" v={`${fmt(spreadProm, 2)} Bs`} sub="por cada $1" accent />
        <MiniStat k="Mejor cambio" v={`+${fmt(biggest?.profitBs || 0, 0)} Bs`} sub={clientById(s, biggest?.clientId)?.name || "—"} />
        <MiniStat k="Clientes activos" v={String(activeClients)} sub={`de ${s.clients.length}`} />
      </div>

      <div className="card">
        <div className="section-head" style={{ margin: "0 0 4px" }}>
          <h3>Ganancia por día</h3>
          <span className="link-btn" style={{ pointerEvents: "none", color: "var(--txt-mute)" }}>Bs</span>
        </div>
        <div className="bars">
          {days.map((v, i) => (
            <div className="bar-col" key={i}>
              <div className="bar" style={{ height: `${(v / max) * 100}%` }} title={`${fmt(v)} Bs`} />
              <div className="bar-lbl">{labels[i]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-head" style={{ margin: "0 0 6px" }}><h3>Por canal recibido</h3><span className="link-btn" style={{ pointerEvents: "none" }}>toca para ver</span></div>
        {chans.map((m) => (
          <div className="row row-tap" key={m.kind}
            onClick={() => openGroup({ title: m.label, ops: ops.filter((o) => accountById(s, o.inId)?.kind === m.kind) })}>
            <div className="row-ic" style={{ background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: m.color }}>{m.icon}</div>
            <div className="row-main">
              <div className="row-title">{m.label}</div>
              <div className="row-sub">{m.count} ops · vol ${fmt(m.vol, 0)}</div>
            </div>
            <div className="row-amt"><div className="a up">+{fmt(m.profit)} Bs</div><div className="b">›</div></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-head" style={{ margin: "0 0 6px" }}><h3>Top clientes</h3><span className="link-btn" style={{ pointerEvents: "none" }}>toca para ver</span></div>
        {tops.length === 0 ? <Empty icon="👥" text="Aún sin operaciones por cliente." /> : tops.map((c, i) => (
          <div className="row row-tap" key={c.id}
            onClick={() => openGroup({ title: c.name, ops: ops.filter((o) => o.clientId === c.id) })}>
            <div className="row-ic" style={{ background: "var(--surface-hi)", color: "var(--green)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{i + 1}</div>
            <div className="row-main">
              <div className="row-title">{c.name}</div>
              <div className="row-sub">{c.count} ops · vol ${fmt(c.vol, 0)}</div>
            </div>
            <div className="row-amt"><div className="a up">+{fmt(c.profit)} Bs</div><div className="b">›</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
function MiniStat({ k, v, sub, accent }) {
  return (
    <div className="mini-stat">
      <div className="ms-k">{k}</div>
      <div className="ms-v" style={accent ? { color: "var(--green)" } : {}}>{v}</div>
      <div className="ms-sub">{sub}</div>
    </div>
  );
}
function channelMargins(s) {
  const map = {};
  s.ops.forEach((o) => {
    const acc = accountById(s, o.inId);
    const k = acc?.kind;
    if (!k) return;
    map[k] = map[k] || { kind: k, count: 0, vol: 0, profit: 0, ...CHANNELS[k] };
    map[k].count++; map[k].vol += o.inAmt; map[k].profit += o.profitBs;
  });
  return Object.values(map).sort((a, b) => b.profit - a.profit);
}
function topClients(s) {
  const map = {};
  s.ops.forEach((o) => {
    const c = clientById(s, o.clientId);
    if (!c) return;
    map[c.id] = map[c.id] || { id: c.id, name: c.name, count: 0, vol: 0, profit: 0 };
    map[c.id].count++; map[c.id].vol += o.inAmt; map[c.id].profit += o.profitBs;
  });
  return Object.values(map).sort((a, b) => b.profit - a.profit);
}

/* ============================== EMPTY ============================== */
function Empty({ icon, text }) {
  return <div className="empty"><div className="ic">{icon}</div><p>{text}</p></div>;
}

/* ============================== OP SHEET ============================== */
function OpSheet({ s, onClose }) {
  const [clientId, setClientId] = useState(s.clients[0]?.id || "");
  const [inId, setInId] = useState(s.accounts.find((a) => a.kind !== "bs")?.id || "");
  const [outId, setOutId] = useState(s.accounts.find((a) => a.kind === "bs")?.id || "");
  const [inAmt, setInAmt] = useState("");
  const [costRate, setCostRate] = useState(String(s.rate)); // tasa base / costo
  const [pct, setPct] = useState("");                        // % de ganancia (±)
  const [rate, setRateLocal] = useState(String(s.rate));     // tasa al cliente (derivada)
  const [addingClient, setAddingClient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Sincroniza costo ↔ % ↔ tasa al cliente
  function onPct(v) {
    setPct(v);
    const base = parseFloat(costRate), p = parseFloat(v);
    if (!isNaN(base) && !isNaN(p)) setRateLocal((base * (1 + p / 100)).toFixed(2));
  }
  function onRate(v) {
    setRateLocal(v);
    const base = parseFloat(costRate), r = parseFloat(v);
    if (!isNaN(base) && base !== 0 && !isNaN(r)) setPct((((r / base) - 1) * 100).toFixed(2));
  }
  function onCost(v) {
    setCostRate(v);
    const base = parseFloat(v), p = parseFloat(pct), r = parseFloat(rate);
    if (!isNaN(base) && !isNaN(p)) setRateLocal((base * (1 + p / 100)).toFixed(2));
    else if (!isNaN(base) && base !== 0 && !isNaN(r)) setPct((((r / base) - 1) * 100).toFixed(2));
  }

  function createClient() {
    if (!newName.trim()) return;
    const c = addClient({ name: newName.trim(), phone: newPhone });
    setClientId(c.id);
    setNewName(""); setNewPhone(""); setAddingClient(false);
  }

  const inAcc = accountById(s, inId);
  const outAcc = accountById(s, outId);

  // calcula la pierna USD, el monto de salida y la ganancia
  const calc = useMemo(() => {
    const amt = parseFloat(inAmt) || 0;
    const r = parseFloat(rate) || 0;
    const cr = parseFloat(costRate) || r;
    const inCur = inAcc?.currency;
    const outCur = outAcc?.currency;
    let usd, outAmt;
    if (inCur === "BS") { usd = r ? amt / r : 0; outAmt = usd; }   // recibo Bs → entrego divisa
    else { usd = amt; outAmt = amt * r; }                          // recibo divisa → entrego Bs
    if (outCur !== "BS" && inCur !== "BS") outAmt = amt;           // divisa ↔ divisa 1:1
    const profitBs = +((r - cr) * usd).toFixed(2);
    const pctReal = cr ? +(((r / cr) - 1) * 100).toFixed(2) : 0;
    return { usd, outAmt: +outAmt.toFixed(2), profitBs, outCur, pct: pctReal };
  }, [inAmt, rate, costRate, inAcc, outAcc]);

  const valid = clientId && inId && outId && inId !== outId && parseFloat(inAmt) > 0 && parseFloat(rate) > 0;

  function save() {
    if (!valid) return;
    addOp({ clientId, inId, inAmt, outId, outAmt: calc.outAmt, rate, costRate });
    onClose();
  }

  return (
    <Sheet onClose={onClose} title="Nuevo cambio" lead="Registra qué recibes y qué entregas. La ganancia se calcula sola.">
      <div className="field">
        <div className="label-row">
          <label>Cliente</label>
          <button type="button" className="link-btn" onClick={() => setAddingClient((v) => !v)}>
            {addingClient ? "Cancelar" : "+ Nuevo cliente"}
          </button>
        </div>
        {addingClient ? (
          <div className="inline-add">
            <input className="input" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre o razón social" />
            <input className="input" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Teléfono (opcional)" />
            <button type="button" className={`btn ${newName.trim() ? "btn-primary" : "btn-ghost"}`} onClick={createClient} disabled={!newName.trim()}>
              Agregar cliente
            </button>
          </div>
        ) : (
          <select className="select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div className="field">
        <label>Recibo en (entra a mi inventario)</label>
        <select className="select" value={inId} onChange={(e) => setInId(e.target.value)}>
          {s.accounts.map((a) => <option key={a.id} value={a.id}>{CHANNELS[a.kind].icon} {a.name} · {fmtCur(a.balance, a.currency)}</option>)}
        </select>
      </div>

      <div className="field">
        <label>Monto recibido ({inAcc?.currency === "BS" ? "Bs" : inAcc?.currency === "USDT" ? "USDT" : "USD"})</label>
        <div className="input-money">
          <span className="pfx">{inAcc?.currency === "BS" ? "Bs" : inAcc?.currency === "USDT" ? "₮" : "$"}</span>
          <input className="input" inputMode="decimal" placeholder="0.00" value={inAmt} onChange={(e) => setInAmt(e.target.value)} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Tasa costo / base (Bs/$)</label>
          <input className="input" inputMode="decimal" value={costRate} onChange={(e) => onCost(e.target.value)} />
        </div>
        <div className="field">
          <label>% ganancia</label>
          <div className="input-money">
            <span className="pfx" style={{ left: "auto", right: 15 }}>%</span>
            <input className="input" inputMode="text" placeholder="0" value={pct}
              onChange={(e) => onPct(e.target.value)} style={{ paddingLeft: 15, paddingRight: 34 }} />
          </div>
        </div>
      </div>
      <div className="field">
        <label>Tasa al cliente (Bs/$)</label>
        <input className="input" inputMode="decimal" value={rate} onChange={(e) => onRate(e.target.value)} />
      </div>

      <div className="field">
        <label>Entrego desde (sale de mi inventario)</label>
        <select className="select" value={outId} onChange={(e) => setOutId(e.target.value)}>
          {s.accounts.map((a) => <option key={a.id} value={a.id}>{CHANNELS[a.kind].icon} {a.name} · {fmtCur(a.balance, a.currency)}</option>)}
        </select>
      </div>

      <div className="calc">
        <div className="calc-row">
          <span className="k">Equivalente en divisa</span>
          <span className="v">${fmt(calc.usd)}</span>
        </div>
        <div className="calc-row">
          <span className="k">Entregas al cliente</span>
          <span className="v down">{fmtCur(calc.outAmt, calc.outCur)}</span>
        </div>
        <div className="calc-row">
          <span className="k">% de ganancia</span>
          <span className="v" style={{ color: calc.pct < 0 ? "var(--coral)" : "var(--green)" }}>
            {calc.pct > 0 ? "+" : ""}{fmt(calc.pct, 2)}%
          </span>
        </div>
        <div className="calc-row big">
          <span className="k">Tu ganancia</span>
          <span className="v" style={calc.profitBs < 0 ? { color: "var(--coral)" } : {}}>
            {calc.profitBs >= 0 ? "+" : ""}{fmt(calc.profitBs)} Bs
          </span>
        </div>
      </div>

      {inId === outId && <p style={{ color: "var(--coral)", fontSize: 12, marginBottom: 12 }}>El canal que recibes y el que entregas deben ser distintos.</p>}

      <button className={`btn ${valid ? "btn-primary" : "btn-ghost"}`} onClick={save} disabled={!valid}>
        Registrar cambio
      </button>
    </Sheet>
  );
}

/* ============================== CLIENT SHEET ============================== */
function ClientSheet({ onClose }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  function save() { if (!name.trim()) return; addClient({ name: name.trim(), phone, note }); onClose(); }
  return (
    <Sheet onClose={onClose} title="Nuevo cliente" lead="Lleva el historial de cada quien.">
      <div className="field"><label>Nombre o razón social</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Ferretería La Económica" /></div>
      <div className="field"><label>Teléfono</label>
        <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0414-0000000" /></div>
      <div className="field"><label>Nota (opcional)</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: paga IVA mensual" /></div>
      <button className={`btn ${name.trim() ? "btn-primary" : "btn-ghost"}`} onClick={save} disabled={!name.trim()}>Guardar cliente</button>
    </Sheet>
  );
}

/* ============================== ACCOUNT SHEET ============================== */
function AccountSheet({ onClose }) {
  const [kind, setKind] = useState("bs");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const meta = CHANNELS[kind];
  const valid = name.trim().length > 0;
  function save() {
    if (!valid) return;
    addAccount({ kind, name: name.trim(), balance: parseFloat(balance) || 0 });
    onClose();
  }
  const suffix = meta.currency === "BS" ? "Bs" : meta.currency === "USDT" ? "₮" : "$";
  return (
    <Sheet onClose={onClose} title="Nueva cuenta" lead="Agrega un banco, billetera o canal a tu inventario.">
      <div className="field">
        <label>Tipo de canal</label>
        <div className="kind-grid">
          {Object.keys(CHANNELS).map((k) => (
            <button key={k} type="button" className={`kind-chip ${kind === k ? "on" : ""}`}
              style={kind === k ? { borderColor: CHANNELS[k].color, color: CHANNELS[k].color } : {}}
              onClick={() => setKind(k)}>
              <span className="kind-ic">{CHANNELS[k].icon}</span>
              <span>{CHANNELS[k].short}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Nombre de la cuenta</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)}
          placeholder={kind === "bs" ? "Ej: Banesco" : kind === "usdt" ? "Ej: Binance USDT" : kind === "zelle" ? "Ej: Zelle · BofA" : "Ej: Efectivo $"} />
      </div>
      <div className="field">
        <label>Saldo inicial ({suffix})</label>
        <div className="input-money">
          <span className="pfx">{suffix}</span>
          <input className="input" inputMode="decimal" placeholder="0.00" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </div>
      </div>
      <button className={`btn ${valid ? "btn-primary" : "btn-ghost"}`} onClick={save} disabled={!valid}>Guardar cuenta</button>
    </Sheet>
  );
}

/* ============================== RATE SHEET ============================== */
function RateSheet({ s, onClose }) {
  const [r, setR] = useState(String(s.rate));
  function save() { setRate(r); onClose(); }
  return (
    <Sheet onClose={onClose} title="Tasa del día" lead="Tu tasa de referencia Bs por dólar.">
      <div className="field"><label>Bs por USD</label>
        <input className="input" inputMode="decimal" value={r} onChange={(e) => setR(e.target.value)} /></div>
      <button className="btn btn-primary" onClick={save}>Actualizar tasa</button>
    </Sheet>
  );
}

/* ============================== OP DETAIL ============================== */
function OpDetailSheet({ op, s, onClose }) {
  const cli = clientById(s, op.clientId);
  const inAcc = accountById(s, op.inId);
  const outAcc = accountById(s, op.outId);
  const inMeta = CHANNELS[inAcc?.kind];
  const outMeta = CHANNELS[outAcc?.kind];
  const usd = toUSD(op.inAmt, inAcc?.currency, op.rate);
  const pctOp = op.costRate ? +(((op.rate / op.costRate) - 1) * 100).toFixed(2) : 0;
  const fecha = op.date
    ? new Date(op.date).toLocaleString("es-VE", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : relTime(op.ts, s);
  const folio = "CMB-" + String(op.id).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8);

  return (
    <Sheet onClose={onClose} title="Detalle del cambio" lead={`Folio ${folio} · ${fecha}`}>
      <div className="dt-client">
        <div className="row-ic" style={{ background: "var(--surface-hi)", color: "var(--green)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
          {(cli?.name || "?").charAt(0)}
        </div>
        <div>
          <div className="dt-client-name">{cli?.name || "Sin cliente"}</div>
          <div className="dt-client-sub">{cli?.phone || "Sin teléfono"}</div>
        </div>
      </div>

      <div className="dt-flow">
        <div className="dt-leg">
          <div className="dt-leg-ic" style={{ background: `color-mix(in srgb, ${inMeta?.color} 16%, transparent)`, color: inMeta?.color }}>{inMeta?.icon}</div>
          <div className="dt-leg-lbl">Recibí</div>
          <div className="dt-leg-amt up">{fmtCur(op.inAmt, inAcc?.currency)}</div>
          <div className="dt-leg-acc">{inAcc?.name}</div>
        </div>
        <div className="dt-arrow">→</div>
        <div className="dt-leg">
          <div className="dt-leg-ic" style={{ background: `color-mix(in srgb, ${outMeta?.color} 16%, transparent)`, color: outMeta?.color }}>{outMeta?.icon}</div>
          <div className="dt-leg-lbl">Entregué</div>
          <div className="dt-leg-amt down">{fmtCur(op.outAmt, outAcc?.currency)}</div>
          <div className="dt-leg-acc">{outAcc?.name}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <DtRow k="Equivalente en divisa" v={`$${fmt(usd)}`} />
        <DtRow k="Tasa al cliente" v={`${fmt(op.rate, 2)} Bs/$`} />
        <DtRow k="Tasa de costo / base" v={`${fmt(op.costRate, 2)} Bs/$`} />
        <DtRow k="% de ganancia" v={`${pctOp > 0 ? "+" : ""}${fmt(pctOp, 2)}%`} accent={pctOp >= 0} coral={pctOp < 0} />
        <DtRow k="Tu ganancia" v={`${op.profitBs >= 0 ? "+" : ""}${fmt(op.profitBs)} Bs`} accent={op.profitBs >= 0} coral={op.profitBs < 0} />
        <DtRow k="≈ ganancia en USD" v={`${op.profitBs >= 0 ? "+" : ""}${fmtUSD(op.profitBs / op.rate)}`} />
      </div>

      <p className="dt-note">El comprobante que compartes con el cliente <b>no incluye</b> tu ganancia ni la tasa de costo.</p>

      <div className="dt-actions">
        <button className="btn btn-primary" onClick={() => sendWhatsApp(op, s)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z"/></svg>
          Enviar por WhatsApp
        </button>
        <button className="btn btn-ghost" onClick={() => downloadPDF(op, s)}>⬇ Descargar PDF</button>
      </div>
    </Sheet>
  );
}
function DtRow({ k, v, accent, coral }) {
  const color = coral ? "var(--coral)" : accent ? "var(--green)" : undefined;
  return (
    <div className="row" style={{ padding: "11px 0" }}>
      <div className="row-main"><div className="row-sub" style={{ fontSize: 13 }}>{k}</div></div>
      <div className={`row-amt`}><div className="a" style={color ? { color, fontSize: 17 } : {}}>{v}</div></div>
    </div>
  );
}

/* ============================== PROFILE ============================== */
function ProfileSheet({ session, onClose, onLogout }) {
  const p = getProfile() || {};
  const [name, setName] = useState(p.name || session?.name || "");
  const [business, setBusiness] = useState(p.business || "");
  const email = p.email || session?.email || "";
  const [phone, setPhone] = useState(p.phone || "");
  const [saved, setSaved] = useState(false);

  const [showPass, setShowPass] = useState(false);
  const [cp, setCp] = useState("");
  const [np, setNp] = useState("");
  const [np2, setNp2] = useState("");
  const [passMsg, setPassMsg] = useState("");

  async function save() {
    try {
      await saveProfile({ name, business, phone });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) { setSaved(false); }
  }
  async function changePass() {
    if (np.length < 4) { setPassMsg("Mínimo 4 caracteres."); return; }
    if (np !== np2) { setPassMsg("Las contraseñas no coinciden."); return; }
    try {
      await changePassword(cp, np);
      setPassMsg("✓ Contraseña actualizada");
      setCp(""); setNp(""); setNp2("");
      setTimeout(() => { setPassMsg(""); setShowPass(false); }, 1500);
    } catch (e) { setPassMsg(e.message || "No se pudo cambiar"); }
  }

  return (
    <Sheet onClose={onClose} title="Mi perfil" lead="Tus datos aparecen en los comprobantes que envías.">
      <div className="dt-client" style={{ marginBottom: 20 }}>
        <div className="avatar" style={{ width: 52, height: 52, fontSize: 20, color: "var(--green)" }}>
          {(name || "U").charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="dt-client-name">{name || "Usuario"}</div>
          <div className="dt-client-sub">{email}</div>
        </div>
      </div>

      <div className="field"><label>Nombre</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" /></div>
      <div className="field"><label>Nombre del negocio</label>
        <input className="input" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Ej: Cambios JM" /></div>
      <div className="field"><label>Correo (no editable)</label>
        <input className="input" type="email" value={email} readOnly disabled style={{ opacity: 0.6 }} /></div>
      <div className="field"><label>Teléfono</label>
        <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0414-0000000" /></div>

      <button className="btn btn-primary" onClick={save}>{saved ? "✓ Guardado" : "Guardar cambios"}</button>

      <div className="divider" />

      {!showPass ? (
        <button className="btn btn-ghost" onClick={() => setShowPass(true)}>🔒 Cambiar contraseña</button>
      ) : (
        <div className="inline-add" style={{ borderStyle: "solid" }}>
          <input className="input" type="password" value={cp} onChange={(e) => setCp(e.target.value)} placeholder="Contraseña actual" />
          <input className="input" type="password" value={np} onChange={(e) => setNp(e.target.value)} placeholder="Nueva contraseña" />
          <input className="input" type="password" value={np2} onChange={(e) => setNp2(e.target.value)} placeholder="Repetir contraseña" />
          {passMsg && <p style={{ fontSize: 12, color: passMsg.startsWith("✓") ? "var(--green)" : "var(--coral)" }}>{passMsg}</p>}
          <button className="btn btn-primary" onClick={changePass}>Actualizar contraseña</button>
        </div>
      )}

      <div className="divider" />
      <button className="btn btn-coral" onClick={() => { if (confirm("¿Cerrar sesión?")) onLogout(); }}>Cerrar sesión</button>
    </Sheet>
  );
}

/* ============================== SHEET SHELL ============================== */
function Sheet({ title, lead, children, onClose }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="sheet-title">{title}</div>
        <div className="sheet-lead">{lead}</div>
        {children}
      </div>
    </div>
  );
}
