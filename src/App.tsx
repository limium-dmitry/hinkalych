// @ts-nocheck
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  LayoutDashboard, Store, Users, AlertTriangle, Upload, LogOut,
  ChevronLeft, ChevronRight, Menu,
  TrendingUp, ShoppingCart, CreditCard, Package, Utensils,
  Calendar, Clock, RefreshCw, AlertCircle, CheckCircle2, Info,
  Paperclip, Download, MapPin, BadgeAlert,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
//  API LAYER + CLIENT CACHE
// ═══════════════════════════════════════════════════════════
const API_BASE = window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1")
  ? "http://localhost:8000"
  : "https://80be-2-133-69-178.ngrok-free.app";

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// Клиентский кэш — живёт пока открыта вкладка
const _cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 мин

const getCached  = (k) => { const e = _cache.get(k); return e && Date.now() - e.ts < CACHE_TTL ? e.data : null; };
const setCached  = (k, d) => _cache.set(k, { data: d, ts: Date.now() });
const clearCached = (k) => k ? _cache.delete(k) : _cache.clear();
const cacheAge   = (k) => { const e = _cache.get(k); return e ? Math.round((Date.now() - e.ts) / 60000) : null; };

// Хук мобильного детектора
function useIsMobile() {
  const [mob, setMob] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMob(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mob;
}

// ═══════════════════════════════════════════════════════════
//  UTILITY COMPONENTS
// ═══════════════════════════════════════════════════════════
const fmt = (n) => n != null ? n.toLocaleString("ru-RU") : "—";
const fmtPct = (n) => n != null ? `${n}%` : "—";
const fmtCur = (n) => n != null ? `${n.toLocaleString("ru-RU")} ₽` : "—";

const SHIMMER_STYLE: React.CSSProperties = {
  background: "linear-gradient(90deg,#f1f5f9 25%,#e9eef5 50%,#f1f5f9 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.4s infinite",
  borderRadius: 10,
};

/** Мерцающий плейсхолдер нужного размера */
function Skeleton({ width = "100%", height = 20, style = {} }: { width?: number|string, height?: number, style?: React.CSSProperties }) {
  return <div style={{ width, height, ...SHIMMER_STYLE, ...style }} />;
}

/** Скелетон одной стат-карточки */
function StatCardSkeleton() {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 10 }}>
      <Skeleton width={80} height={11} />
      <Skeleton width={140} height={28} />
      <Skeleton width={100} height={11} />
    </div>
  );
}

/** Блок с оверлеем при рефреше (данные уже есть, но обновляются) */
function BlockLoader({ loading, children, radius = 16 }: { loading: boolean, children: React.ReactNode, radius?: number }) {
  return (
    <div style={{ position: "relative" }}>
      {children}
      {loading && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: radius,
          background: "rgba(255,255,255,0.65)",
          backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            border: "3px solid #e2e8f0", borderTopColor: "#2563eb",
            animation: "spin 0.75s linear infinite",
          }} />
        </div>
      )}
    </div>
  );
}

// keep for fallback
function LoadingSpinner({ text = "Загрузка…" }: { text?: string }) {
  return (
    <div style={{ padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#2563eb", animation: "spin 0.75s linear infinite" }} />
      <span style={{ fontSize: 14, color: "#94a3b8" }}>{text}</span>
    </div>
  );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RefreshOverlay() { return null; }

function ErrorBanner({ message }) {
  return (
    <div style={{
      margin: "24px 0", padding: "16px 20px", borderRadius: 12,
      background: "#fef2f2", border: "1px solid #fecaca",
      display: "flex", alignItems: "flex-start", gap: 12,
    }}>
      <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#991b1b", marginBottom: 4 }}>
          Ошибка загрузки
        </div>
        <div style={{ fontSize: 13, color: "#b91c1c" }}>{message}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
          Убедитесь, что сервер запущен: <code>uvicorn main:app --reload --port 8000</code>
        </div>
      </div>
    </div>
  );
}

function RefreshBar({ onRefresh, loading, cacheKey }) {
  const age = cacheKey ? cacheAge(cacheKey) : null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginBottom: 14 }}>
      {age !== null && !loading && (
        <span style={{ fontSize: 11, color: "#94a3b8" }}>
          Данные загружены {age === 0 ? "только что" : `${age} мин назад`}
        </span>
      )}
      <button
        onClick={onRefresh}
        disabled={loading}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0",
          background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569",
          cursor: loading ? "default" : "pointer", fontFamily: "inherit",
          opacity: loading ? 0.5 : 1, transition: "all 0.15s",
        }}
      >
        <RefreshCw size={13} style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }} />
        Перезапросить
      </button>
    </div>
  );
}

function MiniChart({ data, color = "#2563eb", height = 40, width = 120 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

function Badge({ children, variant = "default" }) {
  const colors = {
    default: { bg: "#f1f5f9", color: "#475569" },
    success: { bg: "#dcfce7", color: "#166534" },
    warning: { bg: "#fef3c7", color: "#92400e" },
    danger: { bg: "#fee2e2", color: "#991b1b" },
    info: { bg: "#dbeafe", color: "#1e40af" },
  };
  const c = colors[variant] || colors.default;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 8px",
      borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.color, letterSpacing: "0.02em",
    }}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, trend, Icon, color = "#2563eb" }) {
  const trendColor = trend > 0 ? "#16a34a" : trend < 0 ? "#dc2626" : "#94a3b8";
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: "20px 24px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
      border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 8,
      minWidth: 0, flex: "1 1 0",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        {Icon && <Icon size={18} strokeWidth={1.5} color={color} style={{ opacity: 0.6 }} />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em", fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {trend != null && (
          <span style={{ fontSize: 12, fontWeight: 600, color: trendColor }}>
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend)}%
          </span>
        )}
        {sub && <span style={{ fontSize: 12, color: "#94a3b8" }}>{sub}</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CHARTS (Canvas-based)
// ═══════════════════════════════════════════════════════════
function HBarChart({ data, labels, title, color = "#2563eb", barColors = null, valuePrefix = "", valueSuffix = "", secondaryData = null, secondaryLabel = "" }) {
  const canvasRef = useRef(null);
  const ROW_H = 32;
  const GAP = 7;
  const PAD_TOP = 32;
  const PAD_BOTTOM = 12;
  const canvasH = PAD_TOP + data.length * (ROW_H + GAP) - GAP + PAD_BOTTOM;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    // Адаптивные отступы: на узких экранах уменьшаем
    const PAD_LEFT  = Math.min(140, Math.max(70, rect.width * 0.30));
    const PAD_RIGHT = Math.min(90,  Math.max(50, rect.width * 0.18));
    canvas.width = rect.width * dpr;
    canvas.height = canvasH * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, canvasH);

    const w = rect.width - PAD_LEFT - PAD_RIGHT;
    const allVals = secondaryData ? [...data, ...secondaryData] : data;
    const max = Math.max(...allVals) * 1.05 || 1;

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 14px 'DM Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(title, 0, 20);

    const truncate = (text, maxW) => {
      if (ctx.measureText(text).width <= maxW) return text;
      let t = text;
      while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
      return t + "…";
    };

    data.forEach((v, i) => {
      const y = PAD_TOP + i * (ROW_H + GAP);
      const barW = Math.max(0, (v / max) * w);
      const bc = barColors ? barColors[i] : color;

      // track
      ctx.fillStyle = "#f1f5f9";
      ctx.beginPath();
      ctx.roundRect(PAD_LEFT, y + 1, w, ROW_H - 2, 5);
      ctx.fill();

      // secondary bar (plan)
      if (secondaryData && secondaryData[i] > 0) {
        const sw = Math.max(0, (secondaryData[i] / max) * w);
        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.roundRect(PAD_LEFT, y + 1, sw, ROW_H - 2, 5);
        ctx.fill();
      }

      // main bar
      if (barW > 0) {
        const grad = ctx.createLinearGradient(PAD_LEFT, 0, PAD_LEFT + barW, 0);
        grad.addColorStop(0, bc + "bb");
        grad.addColorStop(1, bc);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(PAD_LEFT, y + 1, barW, ROW_H - 2, 5);
        ctx.fill();
      }

      // label
      ctx.fillStyle = "#475569";
      ctx.font = "12px 'DM Sans', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(truncate(labels[i] || "", PAD_LEFT - 12), PAD_LEFT - 8, y + ROW_H / 2 + 4);

      // value
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 12px 'DM Sans', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(valuePrefix + (typeof v === "number" ? v.toLocaleString("ru-RU") : v) + valueSuffix, PAD_LEFT + barW + 7, y + ROW_H / 2 + 4);
    });
  }, [data, labels, title, color, barColors, secondaryData, secondaryLabel, canvasH]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: canvasH, display: "block" }} />;
}

function BarChart({ data, labels, title, color = "#2563eb", height = 220, valuePrefix = "", valueSuffix = "" }) {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const pad = { top: 30, right: 16, bottom: 40, left: 60 };
    const w = rect.width - pad.left - pad.right;
    const h = rect.height - pad.top - pad.bottom;
    const max = Math.max(...data) * 1.1 || 1;
    const barW = Math.min(28, (w / data.length) * 0.6);
    const gap = w / data.length;

    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + w, y);
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px 'DM Sans', sans-serif";
      ctx.textAlign = "right";
      const val = Math.round(max - (max / 4) * i);
      ctx.fillText(valuePrefix + val.toLocaleString("ru-RU") + valueSuffix, pad.left - 8, y + 4);
    }

    data.forEach((v, i) => {
      const x = pad.left + gap * i + (gap - barW) / 2;
      const barH = (v / max) * h;
      const y = pad.top + h - barH;
      const gradient = ctx.createLinearGradient(x, y, x, pad.top + h);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + "44");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();

      if (labels && labels[i] && data.length <= 31) {
        ctx.fillStyle = "#64748b";
        ctx.font = "11px 'DM Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(labels[i], x + barW / 2, pad.top + h + 16);
      }
    });

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px 'DM Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(title, pad.left, 18);
  }, [data, labels, title, color, height]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  return <canvas ref={canvasRef} style={{ width: "100%", height, display: "block" }} />;
}

function LineChart({ datasets, labels, title, height = 220, valueSuffix = "" }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !datasets.length) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const pad = { top: 30, right: 16, bottom: 40, left: 60 };
    const w = rect.width - pad.left - pad.right;
    const h = rect.height - pad.top - pad.bottom;
    const allVals = datasets.flatMap((d) => d.data);
    const max = Math.max(...allVals) * 1.1 || 1;
    const min = 0;
    const range = max - min || 1;

    // Grid
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + w, y);
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px 'DM Sans', sans-serif";
      ctx.textAlign = "right";
      const val = Math.round(max - (range / 4) * i);
      ctx.fillText(val.toLocaleString("ru-RU") + valueSuffix, pad.left - 8, y + 4);
    }

    // Lines
    datasets.forEach((ds) => {
      ctx.strokeStyle = ds.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ds.data.forEach((v, j) => {
        const x = pad.left + (j / (ds.data.length - 1 || 1)) * w;
        const y = pad.top + h - ((v - min) / range) * h;
        j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Fill
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = ds.color;
      ctx.lineTo(pad.left + w, pad.top + h);
      ctx.lineTo(pad.left, pad.top + h);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // X Labels
    if (labels) {
      const step = Math.max(1, Math.floor(labels.length / 10));
      labels.forEach((l, i) => {
        if (i % step !== 0 && i !== labels.length - 1) return;
        const x = pad.left + (i / (labels.length - 1 || 1)) * w;
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px 'DM Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(l, x, pad.top + h + 16);
      });
    }

    // Title
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px 'DM Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(title, pad.left, 18);

    // Legend — переносим на новую строку если не влезает в строку с заголовком
    const titleW = ctx.measureText(title).width;
    const availW = rect.width - pad.left - pad.right;
    let legendX = pad.left + titleW + 20;
    let legendY = 18;
    // если легенда не помещается — переходим на вторую строку
    const totalLegendW = datasets.reduce((acc, ds) => {
      ctx.font = "11px 'DM Sans', sans-serif";
      return acc + ctx.measureText(ds.label).width + 24;
    }, 0);
    if (titleW + 20 + totalLegendW > availW) { legendX = pad.left; legendY = 30; }
    datasets.forEach((ds) => {
      ctx.fillStyle = ds.color;
      ctx.beginPath();
      ctx.arc(legendX, legendY - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#64748b";
      ctx.font = "11px 'DM Sans', sans-serif";
      ctx.fillText(ds.label, legendX + 8, legendY);
      legendX += ctx.measureText(ds.label).width + 24;
    });
  }, [datasets, labels, title, height]);

  return <canvas ref={canvasRef} style={{ width: "100%", height, display: "block" }} />;
}

function DonutChart({ segments, title, size = 160 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2, cy = size / 2, r = size / 2 - 8, inner = r * 0.6;
    const total = segments.reduce((a, s) => a + s.value, 0) || 1;
    let angle = -Math.PI / 2;

    segments.forEach((s) => {
      const sweep = (s.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, angle, angle + sweep);
      ctx.arc(cx, cy, inner, angle + sweep, angle, true);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      angle += sweep;
    });

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(fmt(total), cx, cy + 2);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px 'DM Sans', sans-serif";
    ctx.fillText("₽", cx, cy + 16);
  }, [segments, size]);

  return (
    <div style={{ textAlign: "center" }}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
      {title && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontWeight: 500 }}>{title}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#475569" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  LOGIN PAGE
// ═══════════════════════════════════════════════════════════
function LoginPage({ onLogin }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!login || !password) {
      setError("Введите логин и пароль");
      return;
    }
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok) {
          const u = { login, name: d.name || "Управляющий" };
          localStorage.setItem("kpf_user", JSON.stringify(u));
          onLogin(u);
        } else {
          setError(d.detail || "Неверный логин или пароль");
        }
      })
      .catch(() => setError("Не удалось подключиться к серверу"))
      .finally(() => setLoading(false));
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    }}>
      <div style={{
        width: "min(400px, calc(100vw - 32px))", padding: "clamp(24px, 5vw, 40px)",
        background: "#fff", borderRadius: 24,
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03)",
        boxSizing: "border-box",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/images/Хинкалыч.svg" alt="Старик Хинкалыч" style={{ height: 52, marginBottom: 14 }} />
          <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>КПФ Аналитика</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Логин</label>
            <input
              value={login} onChange={(e) => setLogin(e.target.value)}
              placeholder="nkleopa"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                fontSize: 14, outline: "none", background: "#f8fafc", transition: "border 0.2s",
                boxSizing: "border-box", fontFamily: "inherit",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
              onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Пароль</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                fontSize: 14, outline: "none", background: "#f8fafc", transition: "border 0.2s",
                boxSizing: "border-box", fontFamily: "inherit",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
              onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          {error && <div style={{ color: "#dc2626", fontSize: 13, textAlign: "center" }}>{error}</div>}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              marginTop: 6, padding: "13px 0", borderRadius: 10, border: "none",
              background: loading ? "#94a3b8" : "linear-gradient(135deg, #1e293b, #334155)",
              color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "default" : "pointer",
              transition: "all 0.2s", fontFamily: "inherit", letterSpacing: "0.02em",
            }}
          >
            {loading ? "Авторизация..." : "Войти"}
          </button>
        </div>

        <p style={{ marginTop: 20, fontSize: 11, color: "#cbd5e1", textAlign: "center" }}>
          Подключение к iiko API • v2.0
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  PLAN ADMIN PAGE
// ═══════════════════════════════════════════════════════════
function PlanAdmin() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState([]);
  const [templateFrom, setTemplateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [templateTo, setTemplateTo] = useState(() => {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return last.toISOString().slice(0, 10);
  });

  const handleDownloadTemplate = () => {
    window.open(`${API_BASE}/api/plan/template?date_from=${templateFrom}&date_to=${templateTo}`, "_blank");
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/api/plan/upload`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Ошибка загрузки");
      setResult(json);
      setPreview(json.preview || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Загрузка плана</h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "#94a3b8" }}>
        Excel-файл с планом по выручке для всех ресторанов
      </p>

      {/* Скачать шаблон */}
      <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "16px 20px", marginBottom: 20, border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#15803d", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><Download size={15} />Скачать шаблон</div>
          <div style={{ fontSize: 12, color: "#166534" }}>Готовый файл с нужным форматом и всеми ресторанами</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input type="date" value={templateFrom} onChange={(e) => setTemplateFrom(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #86efac", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
          <span style={{ color: "#86efac", fontSize: 13 }}>→</span>
          <input type="date" value={templateTo} onChange={(e) => setTemplateTo(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #86efac", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
          <button
            onClick={handleDownloadTemplate}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #16a34a, #15803d)",
              color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Выгрузить шаблон
          </button>
        </div>
      </div>

      {/* Формат */}
      <div style={{ background: "#f0f9ff", borderRadius: 12, padding: "14px 18px", marginBottom: 20, border: "1px solid #bfdbfe" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", marginBottom: 8 }}>Поддерживаемые форматы Excel</div>
        <div style={{ fontSize: 12, color: "#1e40af", lineHeight: 1.7 }}>
          <b>Широкий (рекомендуется):</b> строка 1 — заголовки: «Дата», «СХ Воронеж Никитинская», «СХ Москва Арбат», …<br/>
          Строки 2+ — дата (ДД.ММ.ГГГГ) и планы по каждому ресторану.<br/><br/>
          <b>Многолистовой:</b> каждый лист = ресторан (имя листа = точное название), колонки A=Дата, B=План.
        </div>
      </div>

      {/* Загрузчик */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <label style={{
          padding: "10px 18px", borderRadius: 10, border: "1.5px dashed #cbd5e1",
          background: "#f8fafc", fontSize: 13, color: "#64748b", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
          maxWidth: "100%", minWidth: 0, overflow: "hidden",
        }}>
          <Paperclip size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file ? file.name : "Выбрать файл .xlsx"}</span>
          <input type="file" accept=".xlsx" style={{ display: "none" }}
            onChange={(e) => { setFile(e.target.files[0]); setResult(null); setPreview([]); }} />
        </label>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{
            padding: "10px 22px", borderRadius: 10, border: "none",
            background: !file || uploading ? "#94a3b8" : "linear-gradient(135deg, #1e293b, #334155)",
            color: "#fff", fontSize: 13, fontWeight: 600, cursor: !file || uploading ? "default" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {uploading ? "Загружаем…" : "Загрузить"}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div style={{ padding: "14px 18px", borderRadius: 12, background: "#dcfce7", border: "1px solid #86efac", marginBottom: 20 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#166534" }}>
            ✓ Сохранено {result.saved} записей
          </span>
        </div>
      )}

      {preview.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid #f1f5f9" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              Загружено (первые {preview.length} строк)
            </h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Дата", "Ресторан", "План"].map((h) => (
                    <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "8px 14px", color: "#64748b" }}>{r.date}</td>
                    <td style={{ padding: "8px 14px", fontWeight: 500 }}>{r.dept}</td>
                    <td style={{ padding: "8px 14px", fontWeight: 600 }}>{fmtCur(r.plan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  SIDEBAR
// ═══════════════════════════════════════════════════════════
function Sidebar({ currentView, onNavigate, selectedDept, onSelectDept, departments, user, onLogout, mobileOpen, onMobileClose, expanded, onToggleExpanded }) {
  const isMobile = useIsMobile();

  const navItems = [
    { id: "overview",   label: "Сводка",         Icon: LayoutDashboard },
    { id: "department", label: "По ресторану",    Icon: Store },
    { id: "labor",      label: "ФОТ / LC",        Icon: Users },
    { id: "alerts",     label: "Внимание",        Icon: AlertTriangle },
    { id: "plan-admin", label: "Загрузка плана",  Icon: Upload },
  ];

  const handleNav = (id) => { onNavigate(id); if (isMobile) onMobileClose(); };

  if (isMobile && !mobileOpen) return null;

  return (
    <>
      {isMobile && mobileOpen && (
        <div onClick={onMobileClose} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99,
        }} />
      )}
    <div style={{
      position: "fixed", top: 0, left: 0, bottom: 0,
      width: isMobile ? 260 : expanded ? 260 : 64,
      background: "#fff",
      borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column",
      transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)", overflow: "visible",
      zIndex: isMobile ? 100 : 50,
      boxShadow: isMobile ? "4px 0 20px rgba(0,0,0,0.15)" : "none",
    }}>
      {/* Кнопка сворачивания — выступает за правый край */}
      {!isMobile && (
        <button
          onClick={onToggleExpanded}
          style={{
            position: "absolute", right: -13, top: "50%", transform: "translateY(-50%)",
            width: 26, height: 52, borderRadius: 13,
            border: "1px solid #e2e8f0", background: "#fff",
            boxShadow: "2px 0 8px rgba(0,0,0,0.08)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#94a3b8", fontSize: 12, zIndex: 10,
            transition: "all 0.2s", padding: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#2563eb"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#2563eb"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0"; }}
          title={expanded ? "Свернуть" : "Развернуть"}
        >
          {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      )}
      {/* Header — лого на всю ширину, по центру */}
      <div
        style={{
          padding: expanded ? "12px 16px" : "10px 8px",
          display: "flex", alignItems: "center", justifyContent: "center",
          borderBottom: "1px solid #f1f5f9",
          flexShrink: 0, overflow: "hidden",
        }}
      >
        <img
          src="/images/Хинкалыч.svg"
          alt="Старик Хинкалыч"
          style={{
            width: expanded ? "calc(100% - 8px)" : "40px",
            height: "auto", objectFit: "contain",
            transition: "width 0.2s",
          }}
        />
      </div>

      {/* Nav items — фиксированная часть */}
      <div style={{ padding: "8px 8px 0", flexShrink: 0 }}>
        {navItems.map((item) => (
          <div
            key={item.id}
            onClick={() => handleNav(item.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: (expanded || isMobile) ? "8px 12px" : "8px 0",
              justifyContent: (expanded || isMobile) ? "flex-start" : "center",
              borderRadius: 10, cursor: "pointer", marginBottom: 2,
              background: currentView === item.id ? "#eff6ff" : "transparent",
              color: currentView === item.id ? "#2563eb" : "#64748b",
              fontWeight: currentView === item.id ? 600 : 400,
              fontSize: 13, transition: "all 0.15s", whiteSpace: "nowrap",
            }}
          >
            <item.Icon size={18} strokeWidth={currentView === item.id ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
            {(expanded || isMobile) && item.label}
          </div>
        ))}
      </div>

      {/* Список ресторанов — скроллится только эта часть */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 8px 8px" }}>
        {(expanded || isMobile) && (
          <>
            <div style={{ margin: "10px 12px 4px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Рестораны
            </div>
            {departments.map((d) => (
              <div
                key={d}
                onClick={() => { onSelectDept(d); handleNav("department"); }}
                style={{
                  padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                  background: selectedDept === d ? "#eff6ff" : "transparent",
                  color: selectedDept === d ? "#2563eb" : "#64748b",
                  fontWeight: selectedDept === d ? 600 : 400,
                  transition: "all 0.15s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {d.replace("СХ ", "")}
              </div>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div style={{
        padding: expanded ? "12px 16px" : "12px 8px",
        borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10,
        justifyContent: expanded ? "flex-start" : "center",
      }}>
        <div
          title={!expanded ? `${user?.name} · Выйти` : undefined}
          onClick={!expanded ? onLogout : undefined}
          style={{
            width: 32, height: 32, borderRadius: 8, background: "#f1f5f9",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 600, color: "#64748b", flexShrink: 0,
            cursor: !expanded ? "pointer" : "default",
          }}
        >
          {user?.name?.[0] || "U"}
        </div>
        {expanded && (
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>{user?.name}</div>
            <div
              onClick={onLogout}
              style={{ fontSize: 11, color: "#94a3b8", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}
            >
              <LogOut size={11} />
              Выйти
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
//  DATE PICKER
// ═══════════════════════════════════════════════════════════
function DateRange({ dateFrom, dateTo, onChange, isMobile = false }) {
  const inputStyle: React.CSSProperties = {
    padding: isMobile ? "7px 8px" : "8px 12px",
    borderRadius: 8, border: "1.5px solid #e2e8f0",
    fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff",
    minWidth: 0, width: isMobile ? "140px" : "auto",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: isMobile ? "wrap" : "nowrap" }}>
      <input type="date" value={dateFrom} onChange={(e) => onChange(e.target.value, dateTo)} style={inputStyle} />
      <span style={{ color: "#94a3b8", fontSize: 13 }}>→</span>
      <input type="date" value={dateTo} onChange={(e) => onChange(dateFrom, e.target.value)} style={inputStyle} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  OVERVIEW (Сводка по всем ресторанам)
// ═══════════════════════════════════════════════════════════
function OverviewPage({ dateFrom, dateTo, departments, refreshSignal }) {
  const cacheKey = `overview:${dateFrom}:${dateTo}`;
  const [summaries, setSummaries] = useState(() => getCached(cacheKey) || []);
  const [loading, setLoading] = useState(() => !getCached(cacheKey));
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<"table"|"chart">("table");
  const [chartMetric, setChartMetric] = useState("revenue");

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    const hit = getCached(cacheKey);
    if (hit) { setSummaries(hit); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(`/api/overview?date_from=${dateFrom}&date_to=${dateTo}`)
      .then((json) => {
        if (cancelled) return;
        const rows = (json.summaries || []).map((s) => ({
          dept: s.dept,
          totalRev: s.revenue || 0,
          totalPlan: s.plan || 0,
          planPct: s.planPct || 0,
          totalOrders: s.orders || 0,
          avgCheck: s.avgCheck || 0,
          lcPct: s.lcPct || 0,
          totalLC: s.lcSum || 0,
          totalWO: s.writeoffs || 0,
          avgFC: s.foodCostPct || 0,
          totalKhinkali: s.khinkali || 0,
        }));
        setCached(cacheKey, rows);
        setSummaries(rows);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cacheKey, tick, refreshSignal]);

  const handleRefresh = useCallback(() => { clearCached(cacheKey); setTick((t) => t + 1); }, [cacheKey]);

  const grandRev = summaries.reduce((a, s) => a + s.totalRev, 0);
  const grandPlan = summaries.reduce((a, s) => a + s.totalPlan, 0);
  const grandOrders = summaries.reduce((a, s) => a + s.totalOrders, 0);
  const grandLC = summaries.reduce((a, s) => a + s.totalLC, 0);

  const CHART_METRICS = [
    {
      id: "revenue", label: "Выручка", getValue: (s) => s.totalRev, fmt: fmtCur,
      getSecondary: (s) => s.totalPlan, secondaryLabel: "План",
      getColor: () => "#2563eb", suffix: "",
    },
    {
      id: "planPct", label: "% Плана", getValue: (s) => s.planPct, fmt: (v) => v + "%",
      getSecondary: null, secondaryLabel: "",
      getColor: (v) => v >= 100 ? "#16a34a" : v >= 90 ? "#d97706" : "#dc2626", suffix: "%",
    },
    {
      id: "lc", label: "LC %", getValue: (s) => s.lcPct, fmt: (v) => v + "%",
      getSecondary: null, secondaryLabel: "",
      getColor: (v) => v <= 22 ? "#16a34a" : v <= 28 ? "#d97706" : "#dc2626", suffix: "%",
    },
    {
      id: "fc", label: "Foodcost", getValue: (s) => s.avgFC, fmt: (v) => v + "%",
      getSecondary: null, secondaryLabel: "",
      getColor: (v) => v <= 28 ? "#16a34a" : v <= 33 ? "#d97706" : "#dc2626", suffix: "%",
    },
    {
      id: "khinkali", label: "Хинкали", getValue: (s) => s.totalKhinkali, fmt: (v) => fmt(v) + " шт",
      getSecondary: null, secondaryLabel: "",
      getColor: () => "#0891b2", suffix: "",
    },
  ];

  const activeMet = CHART_METRICS.find((m) => m.id === chartMetric) || CHART_METRICS[0];
  const sortedForChart = [...summaries].sort((a, b) => activeMet.getValue(b) - activeMet.getValue(a));

  if (error) return <ErrorBanner message={error} />;
  const tabBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setTab(id as "table"|"chart")}
      style={{
        padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
        background: tab === id ? "#2563eb" : "transparent",
        color: tab === id ? "#fff" : "#64748b",
        transition: "all .15s",
      }}
    >{label}</button>
  );

  const isFirstLoad = loading && !summaries.length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>
          Сводка по сети
        </h2>
        <RefreshBar onRefresh={handleRefresh} loading={loading} cacheKey={cacheKey} />
      </div>

      {/* Grand totals */}
      {isFirstLoad ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[0,1,2,3].map(i => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <BlockLoader loading={loading} radius={16}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
            <StatCard label="Общая выручка" value={fmtCur(grandRev)} sub={`План: ${fmtCur(grandPlan)}`} trend={grandPlan ? +((grandRev / grandPlan * 100) - 100).toFixed(1) : null} Icon={TrendingUp} />
            <StatCard label="Заказов" value={fmt(grandOrders)} sub="за период" Icon={ShoppingCart} />
            <StatCard label="Средний чек" value={fmtCur(grandOrders > 0 ? Math.round(grandRev / grandOrders) : 0)} Icon={CreditCard} />
            <StatCard label="LC сети" value={fmtPct(grandRev > 0 ? +((grandLC / grandRev) * 100).toFixed(1) : 0)} sub={fmtCur(grandLC)} Icon={Users} color={grandLC / grandRev > 0.25 ? "#dc2626" : "#2563eb"} />
          </div>
        </BlockLoader>
      )}

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 4, marginBottom: 16, width: "fit-content" }}>
        {tabBtn("table", "Таблица")}
        {tabBtn("chart", "График")}
      </div>

      {/* TABLE VIEW */}
      {tab === "table" && (isFirstLoad ? (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton height={14} width="60%" />
            {[...Array(8)].map((_, i) => <Skeleton key={i} height={36} style={{ borderRadius: 6, opacity: 1 - i * 0.08 }} />)}
          </div>
        </div>
      ) : (
        <BlockLoader loading={loading}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Ресторан", "Выручка", "План", "% Плана", "Заказы", "Ср. чек", "LC %", "LC ₽", "Foodcost", "Списания", "Хинкали"].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                      {s.dept.replace("СХ ", "")}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 600 }}>{fmtCur(s.totalRev)}</td>
                    <td style={{ padding: "12px 14px", color: "#64748b" }}>{fmtCur(s.totalPlan)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <Badge variant={s.planPct >= 100 ? "success" : s.planPct >= 90 ? "warning" : "danger"}>
                        {s.planPct}%
                      </Badge>
                    </td>
                    <td style={{ padding: "12px 14px" }}>{fmt(s.totalOrders)}</td>
                    <td style={{ padding: "12px 14px" }}>{fmtCur(s.avgCheck)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <Badge variant={s.lcPct <= 22 ? "success" : s.lcPct <= 28 ? "warning" : "danger"}>
                        {s.lcPct}%
                      </Badge>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#64748b" }}>{fmtCur(s.totalLC)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <Badge variant={s.avgFC <= 28 ? "success" : s.avgFC <= 33 ? "warning" : "danger"}>
                        {s.avgFC}%
                      </Badge>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#64748b" }}>{fmtCur(s.totalWO)}</td>
                    <td style={{ padding: "12px 14px" }}>{fmt(s.totalKhinkali)} шт</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f0f9ff" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>ИТОГО</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{fmtCur(grandRev)}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "#64748b" }}>{fmtCur(grandPlan)}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <Badge variant={grandPlan && grandRev / grandPlan >= 1 ? "success" : "warning"}>
                      {grandPlan ? ((grandRev / grandPlan) * 100).toFixed(1) : "—"}%
                    </Badge>
                  </td>
                  <td style={{ padding: "12px 14px", fontWeight: 600 }}>{fmt(grandOrders)}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 600 }}>{fmtCur(grandOrders > 0 ? Math.round(grandRev / grandOrders) : 0)}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <Badge variant="info">{grandRev > 0 ? ((grandLC / grandRev) * 100).toFixed(1) : "—"}%</Badge>
                  </td>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "#64748b" }}>{fmtCur(grandLC)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        </BlockLoader>
      ))}

      {/* CHART VIEW */}
      {tab === "chart" && (isFirstLoad ? (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(14)].map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Skeleton width={130} height={14} />
                <Skeleton height={30} style={{ flex: 1, borderRadius: 6, opacity: 0.5 + Math.random() * 0.5 }} />
                <Skeleton width={70} height={14} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <BlockLoader loading={loading}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          {/* Metric picker */}
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CHART_METRICS.map((m) => (
              <button
                key={m.id}
                onClick={() => setChartMetric(m.id)}
                style={{
                  padding: "5px 14px", borderRadius: 20, border: "1.5px solid", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, transition: "all .15s",
                  borderColor: chartMetric === m.id ? "#2563eb" : "#e2e8f0",
                  background: chartMetric === m.id ? "#eff6ff" : "#fff",
                  color: chartMetric === m.id ? "#2563eb" : "#64748b",
                }}
              >{m.label}</button>
            ))}
          </div>

          {/* Legend for revenue (plan vs actual) */}
          {chartMetric === "revenue" && (
            <div style={{ padding: "10px 20px 0", display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#64748b" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 10, borderRadius: 3, background: "#2563eb", display: "inline-block" }} />
                Выручка
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 10, borderRadius: 3, background: "#e2e8f0", display: "inline-block" }} />
                План
              </span>
            </div>
          )}
          {["planPct", "lc", "fc"].includes(chartMetric) && (
            <div style={{ padding: "10px 20px 0", display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#64748b" }}>
              {[{ c: "#16a34a", l: chartMetric === "lc" ? "≤22%" : chartMetric === "fc" ? "≤28%" : "≥100%" },
                { c: "#d97706", l: chartMetric === "lc" ? "22–28%" : chartMetric === "fc" ? "28–33%" : "90–100%" },
                { c: "#dc2626", l: chartMetric === "lc" ? ">28%" : chartMetric === "fc" ? ">33%" : "<90%" }].map(({ c, l }) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 14, height: 10, borderRadius: 3, background: c, display: "inline-block" }} />
                  {l}
                </span>
              ))}
            </div>
          )}

          {/* Chart */}
          <div style={{ padding: "12px 20px 20px" }}>
            <HBarChart
              data={sortedForChart.map((s) => activeMet.getValue(s))}
              labels={sortedForChart.map((s) => s.dept.replace(/^СХ /, "").replace("Хинкалыч ", "").trim())}
              title=""
              color="#2563eb"
              barColors={sortedForChart.map((s) => activeMet.getColor(activeMet.getValue(s)))}
              secondaryData={activeMet.getSecondary ? sortedForChart.map((s) => activeMet.getSecondary(s)) : null}
              secondaryLabel={activeMet.secondaryLabel}
              valueSuffix={activeMet.suffix}
            />
          </div>
        </div>
        </BlockLoader>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  DEPARTMENT PAGE (Детальный КПФ по ресторану)
// ═══════════════════════════════════════════════════════════
function DepartmentPage({ dept, dateFrom, dateTo, refreshSignal }) {
  const isMobile = useIsMobile();
  const cacheKey = `daily:${dept}:${dateFrom}:${dateTo}`;
  const [data, setData] = useState(() => getCached(cacheKey) || []);
  const [loading, setLoading] = useState(() => !getCached(cacheKey));
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!dept || !dateFrom || !dateTo) return;
    const hit = getCached(cacheKey);
    if (hit) { setData(hit); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(`/api/daily?dept=${encodeURIComponent(dept)}&date_from=${dateFrom}&date_to=${dateTo}`)
      .then((json) => {
        const days = json.days || [];
        setCached(cacheKey, days);
        if (!cancelled) setData(days);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cacheKey, tick, refreshSignal]);

  const handleRefresh = useCallback(() => { clearCached(cacheKey); setTick((t) => t + 1); }, [cacheKey]);

  const totalRev = data.reduce((a, d) => a + (d.revenue || 0), 0);
  const totalPlan = data.reduce((a, d) => a + (d.plan || 0), 0);
  const totalOrders = data.reduce((a, d) => a + (d.orders || 0), 0);
  const totalLC = data.reduce((a, d) => a + (d.lcSum || 0), 0);
  const totalWO = data.reduce((a, d) => a + (d.writeoffs || 0), 0);
  const totalKhinkali = data.reduce((a, d) => a + (d.khinkali || 0), 0);
  const avgCheck = totalOrders > 0 ? Math.round(totalRev / totalOrders) : 0;

  const [tab, setTab] = useState("table");

  if (!dept) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, color: "#94a3b8", gap: 12 }}>
      <Store size={40} color="#cbd5e1" strokeWidth={1.2} />
      <div style={{ fontSize: 15, fontWeight: 600, color: "#475569" }}>Выберите ресторан</div>
      <div style={{ fontSize: 13 }}>Выберите конкретный филиал из выпадающего списка или из сайдбара</div>
    </div>
  );
  if (error) return <ErrorBanner message={error} />;

  const isFirstLoad = loading && !data.length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>{dept}</h2>
        <RefreshBar onRefresh={handleRefresh} loading={loading} cacheKey={cacheKey} />
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#94a3b8" }}>
        {dateFrom} — {dateTo}{!isFirstLoad && ` • ${data.length} дней`}
      </p>

      {/* KPIs */}
      {isFirstLoad ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[0,1,2,3,4].map(i => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <BlockLoader loading={loading} radius={16}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            <StatCard label="Выручка" value={fmtCur(totalRev)} sub={`План: ${fmtCur(totalPlan)}`} trend={totalPlan ? +((totalRev / totalPlan * 100) - 100).toFixed(1) : null} Icon={TrendingUp} />
            <StatCard label="Заказов" value={fmt(totalOrders)} sub={`Ср. чек: ${fmtCur(avgCheck)}`} Icon={ShoppingCart} />
            <StatCard label="LC" value={fmtPct(totalRev > 0 ? +((totalLC / totalRev) * 100).toFixed(1) : 0)} sub={fmtCur(totalLC)} Icon={Users} />
            <StatCard label="Списания" value={fmtCur(totalWO)} Icon={Package} />
            <StatCard label="Хинкали" value={`${fmt(totalKhinkali)} шт`} Icon={Utensils} />
          </div>
        </BlockLoader>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#f1f5f9", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {[
          { id: "table", label: "Таблица" },
          { id: "charts", label: "Графики" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: tab === t.id ? "#fff" : "transparent",
              color: tab === t.id ? "#0f172a" : "#64748b",
              fontWeight: tab === t.id ? 600 : 400,
              fontSize: 13, fontFamily: "inherit",
              boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "charts" && (isFirstLoad ? (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {[0,1,2,3].map(i => <Skeleton key={i} height={220} style={{ borderRadius: 16 }} />)}
        </div>
      ) : (
        <BlockLoader loading={loading} radius={0}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #f1f5f9" }}>
            <LineChart
              datasets={[
                { label: "Выручка", data: data.map((d) => d.revenue), color: "#2563eb" },
                { label: "План", data: data.map((d) => d.plan), color: "#94a3b8" },
              ]}
              labels={data.map((d) => d.date.slice(8))}
              title="Выручка vs План"
              height={200}
            />
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #f1f5f9" }}>
            <BarChart data={data.map((d) => d.orders)} labels={data.map((d) => d.date.slice(8))} title="Заказы" color="#0891b2" height={200} />
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #f1f5f9" }}>
            <LineChart
              datasets={[
                { label: "LC %", data: data.map((d) => d.lcPct), color: "#7c3aed" },
                { label: "Food cost %", data: data.map((d) => d.foodCostPct), color: "#ea580c" },
              ]}
              labels={data.map((d) => d.date.slice(8))}
              title="LC % и Себестоимость %"
              height={200}
              valueSuffix="%"
            />
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #f1f5f9" }}>
            <BarChart data={data.map((d) => d.khinkali)} labels={data.map((d) => d.date.slice(8))} title="Хинкали (шт)" color="#16a34a" height={200} />
          </div>
        </div>
        </BlockLoader>
      ))}

      {tab === "table" && (isFirstLoad ? (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton height={14} width="40%" />
            {[...Array(10)].map((_, i) => <Skeleton key={i} height={36} style={{ borderRadius: 6 }} />)}
          </div>
        </div>
      ) : (
        <BlockLoader loading={loading}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#1e293b" }}>
                  {["Дата", "День", "План", "Выручка", "% Плана", "Заказы", "Ср. чек", "LC %", "LC ₽", "Списания", "Foodcost", "Хинкали", "Подарки", "t Хинк.", "t Хач."].map((h) => (
                    <th key={h} style={{
                      padding: "10px 10px", textAlign: "center", fontSize: 10, fontWeight: 600,
                      color: "#e2e8f0", textTransform: "uppercase", letterSpacing: "0.04em",
                      whiteSpace: "nowrap", position: "sticky", top: 0,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => {
                  const isWeekend = d.dow === "Сб" || d.dow === "Вс";
                  return (
                    <tr key={i} style={{ background: isWeekend ? "#fefce8" : i % 2 === 0 ? "#fff" : "#fafbfc", borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", textAlign: "center", fontSize: 11 }}>{d.date.slice(5)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "center", color: isWeekend ? "#dc2626" : "#64748b", fontWeight: isWeekend ? 600 : 400 }}>{d.dow}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8" }}>{fmt(d.plan)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>{fmt(d.revenue)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        <Badge variant={d.planPct >= 100 ? "success" : d.planPct >= 90 ? "warning" : "danger"}>
                          {d.planPct}%
                        </Badge>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>{d.orders}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>{fmt(d.avgCheck)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        <Badge variant={d.lcPct <= 22 ? "success" : d.lcPct <= 28 ? "warning" : "danger"}>
                          {d.lcPct}%
                        </Badge>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#64748b" }}>{fmt(d.lcSum)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#64748b" }}>{fmt(d.writeoffs)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        <Badge variant={d.foodCostPct <= 28 ? "success" : d.foodCostPct <= 33 ? "warning" : "danger"}>
                          {d.foodCostPct}%
                        </Badge>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 500 }}>{d.khinkali}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", color: d.gifts > 0 ? "#dc2626" : "#94a3b8" }}>{d.gifts}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontFamily: "monospace", fontSize: 11, color: d.ctHk ? "#0f172a" : "#cbd5e1" }}>{d.ctHk || "—"}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontFamily: "monospace", fontSize: 11, color: d.ctKh ? "#0f172a" : "#cbd5e1" }}>{d.ctKh || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f0f9ff" }}>
                  <td colSpan={2} style={{ padding: "10px 10px", fontWeight: 700, textAlign: "center" }}>ИТОГО</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600 }}>{fmt(totalPlan)}</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(totalRev)}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center" }}>
                    <Badge variant={totalPlan && totalRev / totalPlan >= 1 ? "success" : "warning"}>
                      {totalPlan ? ((totalRev / totalPlan) * 100).toFixed(1) : "—"}%
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "center", fontWeight: 600 }}>{fmt(totalOrders)}</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600 }}>{fmt(avgCheck)}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center" }}>
                    <Badge variant="info">{totalRev > 0 ? ((totalLC / totalRev) * 100).toFixed(1) : "—"}%</Badge>
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600 }}>{fmt(totalLC)}</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600 }}>{fmt(totalWO)}</td>
                  <td />
                  <td style={{ padding: "10px 10px", textAlign: "center", fontWeight: 600 }}>{fmt(totalKhinkali)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        </BlockLoader>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  LABOR NETWORK PAGE (ФОТ / LC по всем ресторанам)
// ═══════════════════════════════════════════════════════════
function LaborNetworkPage({ dateFrom, dateTo, refreshSignal }) {
  const isMobile = useIsMobile();
  const overviewKey = `overview:${dateFrom}:${dateTo}`;
  const [summaries, setSummaries] = useState(() => getCached(overviewKey) || []);
  const [loading, setLoading] = useState(() => !getCached(overviewKey));
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    const hit = getCached(overviewKey);
    if (hit) { setSummaries(hit); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/overview?date_from=${dateFrom}&date_to=${dateTo}`)
      .then((json) => {
        const rows = (json.summaries || []).map((s) => ({
          dept: s.dept, totalRev: s.revenue || 0, totalPlan: s.plan || 0,
          planPct: s.planPct || 0, lcPct: s.lcPct || 0, totalLC: s.lcSum || 0,
          avgFC: s.foodCostPct || 0,
        }));
        setCached(overviewKey, rows);
        if (!cancelled) setSummaries(rows);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [overviewKey, tick, refreshSignal]);

  const handleRefresh = useCallback(() => { clearCached(overviewKey); setTick((t) => t + 1); }, [overviewKey]);

  if (error) return <ErrorBanner message={error} />;

  const totalRev = summaries.reduce((a, s) => a + s.totalRev, 0);
  const totalLC  = summaries.reduce((a, s) => a + s.totalLC,  0);
  const avgLC    = totalRev > 0 ? +((totalLC / totalRev) * 100).toFixed(1) : 0;
  const sorted   = [...summaries].sort((a, b) => a.lcPct - b.lcPct);
  const best     = sorted[0];
  const worst    = sorted[sorted.length - 1];

  // Для графиков — сортировка по LC% убыв.
  const byLC  = [...summaries].sort((a, b) => b.lcPct - a.lcPct);
  const short = (d) => d.replace(/^СХ /, "").replace("Хинкалыч ", "").trim();

  // Категории LC для donut-аналога — считаем разбивку по диапазонам
  const lcBands = [
    { label: "≤ 20% (отлично)", color: "#16a34a", count: summaries.filter(s => s.lcPct <= 20).length },
    { label: "20–25% (норма)",  color: "#84cc16", count: summaries.filter(s => s.lcPct > 20 && s.lcPct <= 25).length },
    { label: "25–28% (внимание)", color: "#f59e0b", count: summaries.filter(s => s.lcPct > 25 && s.lcPct <= 28).length },
    { label: "> 28% (превышение)", color: "#dc2626", count: summaries.filter(s => s.lcPct > 28).length },
  ].filter(b => b.count > 0);

  const isFirst = loading && !summaries.length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>ФОТ / LC по сети</h2>
        <RefreshBar onRefresh={handleRefresh} loading={loading} cacheKey={overviewKey} />
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#94a3b8" }}>Сравнительный анализ по всем филиалам</p>

      {/* Stat cards */}
      {isFirst ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[0,1,2,3].map(i => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <BlockLoader loading={loading} radius={16}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="LC сети (ср.)" value={`${avgLC}%`} sub={fmtCur(totalLC)} Icon={Users}
              color={avgLC > 28 ? "#dc2626" : avgLC > 22 ? "#d97706" : "#16a34a"} />
            <StatCard label="Суммарный ФОТ" value={fmtCur(totalLC)} sub={`из ${fmtCur(totalRev)}`} Icon={TrendingUp} />
            <StatCard label="Лучший LC" value={best ? `${best.lcPct}%` : "—"}
              sub={best ? short(best.dept) : ""} Icon={CheckCircle2} color="#16a34a" />
            <StatCard label="Худший LC" value={worst ? `${worst.lcPct}%` : "—"}
              sub={worst ? short(worst.dept) : ""} Icon={AlertTriangle} color="#dc2626" />
          </div>
        </BlockLoader>
      )}

      {/* График LC% по ресторанам */}
      {isFirst ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>
          <Skeleton height={340} style={{ borderRadius: 16 }} />
        </div>
      ) : (
        <BlockLoader loading={loading} radius={16}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>
          {/* Основной сравнительный график LC% */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px 8px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>LC % по ресторанам</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Сортировка от большего к меньшему</div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[{ c: "#16a34a", l: "≤ 20%" }, { c: "#84cc16", l: "20–25%" }, { c: "#f59e0b", l: "25–28%" }, { c: "#dc2626", l: "> 28%" }].map(({ c, l }) => (
                  <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748b" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: c, display: "inline-block" }} />{l}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ padding: "12px 20px 20px" }}>
              <HBarChart
                data={byLC.map(s => s.lcPct)}
                labels={byLC.map(s => short(s.dept))}
                title=""
                barColors={byLC.map(s => s.lcPct > 28 ? "#dc2626" : s.lcPct > 25 ? "#f59e0b" : s.lcPct > 20 ? "#84cc16" : "#16a34a")}
                valueSuffix="%"
              />
            </div>
          </div>

          {/* График ФОТ в рублях */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px 8px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Абсолютный ФОТ, ₽</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Общий фонд оплаты труда за период</div>
            </div>
            <div style={{ padding: "12px 20px 20px" }}>
              <HBarChart
                data={[...summaries].sort((a,b) => b.totalLC - a.totalLC).map(s => s.totalLC)}
                labels={[...summaries].sort((a,b) => b.totalLC - a.totalLC).map(s => short(s.dept))}
                title=""
                barColors={[...summaries].sort((a,b) => b.totalLC - a.totalLC).map(() => "#2563eb")}
              />
            </div>
          </div>
        </div>
        </BlockLoader>
      )}

      {/* Таблица сравнения */}
      {isFirst ? (
        <Skeleton height={300} style={{ borderRadius: 16 }} />
      ) : (
        <BlockLoader loading={loading}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: isMobile ? "flex-start" : "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Детализация по ресторанам</div>
            <div style={{ display: "flex", gap: 8, marginLeft: isMobile ? 0 : "auto", flexWrap: "wrap" }}>
              {lcBands.map(b => (
                <span key={b.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color, display: "inline-block" }} />
                  {b.label}: <b>{b.count}</b>
                </span>
              ))}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["#", "Ресторан", "Выручка", "ФОТ, ₽", "LC %", "Доля в общем ФОТ", "Foodcost %"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: h === "#" ? "center" : "left", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => {
                  const lcColor = s.lcPct > 28 ? "#dc2626" : s.lcPct > 25 ? "#f59e0b" : s.lcPct > 20 ? "#84cc16" : "#16a34a";
                  const sharePct = totalLC > 0 ? +((s.totalLC / totalLC) * 100).toFixed(1) : 0;
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: "10px 14px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>{i + 1}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, whiteSpace: "nowrap" }}>{short(s.dept)}</td>
                      <td style={{ padding: "10px 14px", color: "#64748b" }}>{fmtCur(s.totalRev)}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{fmtCur(s.totalLC)}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: lcColor, flexShrink: 0 }} />
                          <span style={{ fontWeight: 700, color: lcColor }}>{s.lcPct}%</span>
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3, minWidth: 60 }}>
                            <div style={{ width: `${sharePct}%`, height: "100%", background: "#2563eb", borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>{sharePct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <Badge variant={s.avgFC <= 28 ? "success" : s.avgFC <= 33 ? "warning" : "danger"}>{s.avgFC}%</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f0f9ff" }}>
                  <td colSpan={2} style={{ padding: "10px 14px", fontWeight: 700 }}>ИТОГО</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>{fmtCur(totalRev)}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 700 }}>{fmtCur(totalLC)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontWeight: 700, color: avgLC > 28 ? "#dc2626" : avgLC > 25 ? "#f59e0b" : "#16a34a" }}>{avgLC}%</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>100%</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        </BlockLoader>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  LABOR PAGE (ФОТ / LC детализация)
// ═══════════════════════════════════════════════════════════
function LaborPage({ dept, dateFrom, dateTo, refreshSignal }) {
  const isMobile = useIsMobile();
  const laborKey = `labor:${dept}:${dateFrom}:${dateTo}`;
  const dailyKey = `daily:${dept}:${dateFrom}:${dateTo}`;
  const [roles, setRoles] = useState(() => getCached(laborKey)?.roles || []);
  const [data, setData] = useState(() => getCached(dailyKey) || []);
  const [loading, setLoading] = useState(() => !getCached(laborKey) || !getCached(dailyKey));
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!dept || !dateFrom || !dateTo) return;
    const hitLabor = getCached(laborKey);
    const hitDaily = getCached(dailyKey);
    if (hitLabor && hitDaily) { setRoles(hitLabor.roles); setData(hitDaily); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      hitLabor ? Promise.resolve(hitLabor) : apiFetch(`/api/labor?dept=${encodeURIComponent(dept)}&date_from=${dateFrom}&date_to=${dateTo}`).then((d) => { setCached(laborKey, d); return d; }),
      hitDaily ? Promise.resolve({ days: hitDaily }) : apiFetch(`/api/daily?dept=${encodeURIComponent(dept)}&date_from=${dateFrom}&date_to=${dateTo}`).then((d) => { setCached(dailyKey, d.days || []); return d; }),
    ])
      .then(([labor, daily]) => {
        if (!cancelled) {
          setRoles(labor.roles || []);
          setData(daily.days || []);
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [laborKey, dailyKey, tick, refreshSignal]);

  const handleRefresh = useCallback(() => { clearCached(laborKey); clearCached(dailyKey); setTick((t) => t + 1); }, [laborKey, dailyKey]);

  if (!dept) return <LaborNetworkPage dateFrom={dateFrom} dateTo={dateTo} refreshSignal={refreshSignal} />;
  if (error) return <ErrorBanner message={error} />;

  const LC_COLORS = {
    "Повара": "#2563eb",
    "Админы": "#7c3aed",
    "Официанты": "#0891b2",
    "Посудомойки": "#ea580c",
    "Технички": "#84cc16",
    "Кухрабочие": "#f59e0b",
    "Прочие": "#94a3b8",
  };

  const categories = {};
  roles.forEach((r) => {
    if (!categories[r.category]) categories[r.category] = { shifts: 0, hours: 0, cost: 0 };
    categories[r.category].shifts += r.shifts;
    categories[r.category].hours += r.hours;
    categories[r.category].cost += r.cost;
  });

  const totalLC = data.reduce((a, d) => a + d.lcSum, 0);
  const totalRev = data.reduce((a, d) => a + d.revenue, 0);

  const isFirstLoadLabor = loading && !roles.length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>ФОТ / Labor Cost</h2>
        <RefreshBar onRefresh={handleRefresh} loading={loading} cacheKey={laborKey} />
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#94a3b8" }}>{dept}</p>

      {isFirstLoadLabor ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[0,1,2,3].map(i => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <BlockLoader loading={loading} radius={16}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="LC итого" value={fmtCur(totalLC)} sub={fmtPct(totalRev > 0 ? +((totalLC / totalRev) * 100).toFixed(1) : 0)} Icon={Users} />
            <StatCard label="Выручка" value={fmtCur(totalRev)} Icon={TrendingUp} />
            <StatCard label="Смен всего" value={fmt(roles.reduce((a, r) => a + r.shifts, 0))} Icon={Calendar} />
            <StatCard label="Часов всего" value={fmt(roles.reduce((a, r) => a + r.hours, 0))} Icon={Clock} />
          </div>
        </BlockLoader>
      )}

      {isFirstLoadLabor ? (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 16, marginBottom: 16 }}>
          <Skeleton height={220} style={{ borderRadius: 16 }} />
          <Skeleton height={220} style={{ borderRadius: 16 }} />
        </div>
      ) : (
      <BlockLoader loading={loading} radius={0}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 16, marginBottom: 16 }}>
        {/* LC by day chart */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #f1f5f9" }}>
          <LineChart
            datasets={[
              { label: "LC %", data: data.map((d) => d.lcPct), color: "#7c3aed" },
            ]}
            labels={data.map((d) => d.date.slice(8))}
            title="LC % по дням"
            height={220}
            valueSuffix="%"
          />
        </div>

        {/* Donut */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <DonutChart
            segments={Object.entries(categories).map(([cat, v]) => ({
              label: cat,
              value: v.cost,
              color: LC_COLORS[cat] || "#94a3b8",
            }))}
            title="Распределение ФОТ"
            size={isMobile ? 140 : 180}
          />
        </div>
      </div>
      </BlockLoader>
      )}

      {/* Roles table */}
      {isFirstLoadLabor ? (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton height={14} width="30%" />
            {[...Array(6)].map((_, i) => <Skeleton key={i} height={36} style={{ borderRadius: 6 }} />)}
          </div>
        </div>
      ) : (
      <BlockLoader loading={loading}>
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f1f5f9" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#0f172a" }}>Детализация по ролям</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Должность", "Категория", "Смен", "Часов", "ФОТ, ₽", "₽/час"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f8fafc" }}>
                <td style={{ padding: "10px 14px", fontWeight: 500 }}>{r.role}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: LC_COLORS[r.category] || "#94a3b8" }} />
                    {r.category}
                  </span>
                </td>
                <td style={{ padding: "10px 14px" }}>{r.shifts}</td>
                <td style={{ padding: "10px 14px" }}>{r.hours}</td>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{fmtCur(r.cost)}</td>
                <td style={{ padding: "10px 14px", color: "#64748b" }}>{fmt(r.hours > 0 ? Math.round(r.cost / r.hours) : 0)} ₽</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      </BlockLoader>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  ALERTS PAGE
// ═══════════════════════════════════════════════════════════
function AlertsPage({ dept, departments, dateFrom, dateTo, refreshSignal }) {
  const overviewKey = `overview:${dateFrom}:${dateTo}`;
  const laborKey    = `labor:${dept}:${dateFrom}:${dateTo}`;

  const [summaries, setSummaries] = useState(() => getCached(overviewKey) || []);
  const [noTariff,  setNoTariff]  = useState(() => getCached(laborKey)?.noTariff || []);
  const [loading,   setLoading]   = useState(() => !getCached(overviewKey) || !getCached(laborKey));
  const [error,     setError]     = useState(null);
  const [tick,      setTick]      = useState(0);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    const hitOvr   = getCached(overviewKey);
    const hitLabor = dept ? getCached(laborKey) : null;
    if (hitOvr && (!dept || hitLabor)) {
      setSummaries(hitOvr);
      if (hitLabor) setNoTariff(hitLabor.noTariff || []);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const p1 = hitOvr
      ? Promise.resolve(hitOvr)
      : apiFetch(`/api/overview?date_from=${dateFrom}&date_to=${dateTo}`).then((json) => {
          const rows = (json.summaries || []).map((s) => ({
            dept: s.dept, totalRev: s.revenue || 0, totalPlan: s.plan || 0,
            planPct: s.planPct || 0, totalOrders: s.orders || 0, avgCheck: s.avgCheck || 0,
            lcPct: s.lcPct || 0, totalLC: s.lcSum || 0, totalWO: s.writeoffs || 0,
            avgFC: s.foodCostPct || 0, totalKhinkali: s.khinkali || 0,
          }));
          setCached(overviewKey, rows);
          return rows;
        });
    const p2 = dept
      ? (hitLabor
          ? Promise.resolve(hitLabor)
          : apiFetch(`/api/labor?dept=${encodeURIComponent(dept)}&date_from=${dateFrom}&date_to=${dateTo}`)
              .then((d) => { setCached(laborKey, d); return d; }))
      : Promise.resolve(null);

    Promise.all([p1, p2])
      .then(([ovr, labor]) => {
        if (!cancelled) {
          setSummaries(Array.isArray(ovr) ? ovr : []);
          setNoTariff(labor?.noTariff || []);
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [overviewKey, laborKey, dept, tick, refreshSignal]);

  const handleRefresh = useCallback(() => {
    clearCached(overviewKey); clearCached(laborKey); setTick((t) => t + 1);
  }, [overviewKey, laborKey]);

  if (error) return <ErrorBanner message={error} />;

  // ─── Генерируем алерты (только по выбранному ресторану, или по всем) ───
  const activeSummaries = dept ? summaries.filter((s) => s.dept === dept) : summaries;
  type Alert = { type: string; title: string; restaurant: string; value: string; detail?: string };
  const alerts: Alert[] = [];

  for (const s of activeSummaries) {
    const name = s.dept.replace(/^СХ /, "");
    // LC
    if (s.lcPct >= 35) alerts.push({ type: "danger",  title: "Критический LC",   restaurant: name, value: `${s.lcPct}%`, detail: `ФОТ: ${fmtCur(s.totalLC)}` });
    else if (s.lcPct >= 28) alerts.push({ type: "warning", title: "Высокий LC",  restaurant: name, value: `${s.lcPct}%`, detail: `ФОТ: ${fmtCur(s.totalLC)}` });
    // Foodcost
    if (s.avgFC >= 38) alerts.push({ type: "danger",  title: "Критический Foodcost", restaurant: name, value: `${s.avgFC}%` });
    else if (s.avgFC >= 33) alerts.push({ type: "warning", title: "Foodcost выше нормы", restaurant: name, value: `${s.avgFC}%` });
    // Plan
    if (s.totalPlan > 0) {
      if (s.planPct < 80)       alerts.push({ type: "danger",  title: "Критическое невыполнение плана", restaurant: name, value: `${s.planPct}%`, detail: `${fmtCur(s.totalRev)} из ${fmtCur(s.totalPlan)}` });
      else if (s.planPct < 90)  alerts.push({ type: "warning", title: "План не выполнен",               restaurant: name, value: `${s.planPct}%`, detail: `${fmtCur(s.totalRev)} из ${fmtCur(s.totalPlan)}` });
    }
    // Нет заказов
    if (s.totalOrders === 0 && s.totalRev === 0) alerts.push({ type: "danger", title: "Нет данных / заказов", restaurant: name, value: "0 заказов" });
    // Низкий средний чек
    if (s.totalOrders > 10 && s.avgCheck < 900) alerts.push({ type: "warning", title: "Низкий средний чек", restaurant: name, value: fmtCur(s.avgCheck) });
    // Нет хинкали (подозрительно)
    if (s.totalOrders > 50 && s.totalKhinkali === 0) alerts.push({ type: "info", title: "Нет хинкали за период", restaurant: name, value: "0 шт" });
  }

  // Сортируем: danger → warning → info
  const severity = { danger: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => (severity[a.type] ?? 3) - (severity[b.type] ?? 3));

  // noTariff
  if (noTariff.length > 0) {
    alerts.push({ type: "info", title: "Сотрудники без тарифа", restaurant: dept.replace(/^СХ /, ""), value: `${noTariff.length} смен` });
  }

  const isLoading = loading && !summaries.length;
  const COLORS = {
    danger:  { bg: "#fef2f2", border: "#fecaca",  Icon: AlertCircle,    iconColor: "#dc2626", badge: "#fee2e2", badgeText: "#991b1b" },
    warning: { bg: "#fffbeb", border: "#fde68a",  Icon: AlertTriangle,  iconColor: "#d97706", badge: "#fef3c7", badgeText: "#92400e" },
    info:    { bg: "#eff6ff", border: "#bfdbfe",  Icon: Info,           iconColor: "#2563eb", badge: "#dbeafe", badgeText: "#1e40af" },
    success: { bg: "#f0fdf4", border: "#bbf7d0",  Icon: CheckCircle2,   iconColor: "#16a34a", badge: "#dcfce7", badgeText: "#166534" },
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Внимание</h2>
        <RefreshBar onRefresh={handleRefresh} loading={loading} cacheKey={overviewKey} />
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#94a3b8" }}>
        {dept ? `Отклонения по: ${dept.replace(/^СХ /, "")}` : "Отклонения по всем ресторанам за период"}
      </p>

      {/* Счётчики сверху */}
      {!isLoading && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {(["danger", "warning", "info"] as const).map((type) => {
            const cnt = alerts.filter((a) => a.type === type).length;
            const c = COLORS[type];
            const labels = { danger: "Критичных", warning: "Предупреждений", info: "К сведению" };
            return (
              <div key={type} style={{
                flex: "1 1 120px", padding: "12px 16px", borderRadius: 12,
                background: c.bg, border: `1px solid ${c.border}`,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <c.Icon size={24} color={c.iconColor} strokeWidth={1.8} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>{cnt}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{labels[type]}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Список алертов */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[0,1,2,3,4,5].map(i => <Skeleton key={i} height={60} style={{ borderRadius: 12 }} />)}
        </div>
      ) : alerts.length === 0 ? (
        <div style={{ padding: "24px 20px", borderRadius: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", textAlign: "center" }}>
          <CheckCircle2 size={40} color="#16a34a" strokeWidth={1.5} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "#166534" }}>Всё в норме</div>
          <div style={{ fontSize: 13, color: "#4ade80", marginTop: 4 }}>
            {dept ? `По ${dept.replace(/^СХ /, "")} нет отклонений за период` : "За период нет отклонений ни по одному ресторану"}
          </div>
        </div>
      ) : (
        <BlockLoader loading={loading} radius={12}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.map((a, i) => {
            const c = COLORS[a.type] || COLORS.info;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderRadius: 12, background: c.bg, border: `1px solid ${c.border}`,
              }}>
                <c.Icon size={16} color={c.iconColor} strokeWidth={2} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{a.title}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 20,
                      background: c.badge, color: c.badgeText,
                    }}>{a.value}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    <MapPin size={11} style={{ display: "inline", marginRight: 3, verticalAlign: "middle" }} />{a.restaurant}{a.detail ? ` · ${a.detail}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </BlockLoader>
      )}

      {/* Таблица без тарифа для выбранного ресторана */}
      {dept && !isLoading && noTariff.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <BlockLoader loading={loading}>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f1f5f9" }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#0f172a" }}>
                Сотрудники без тарифа — {dept.replace(/^СХ /, "")}
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>Часы не учитываются в LC — нужно завести тариф в iiko</p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Сотрудник", "Должность", "Категория", "Дата", "Часов (не оплачено)"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {noTariff.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 500, whiteSpace: "nowrap" }}>{r.employee}</td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{r.role}</td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{r.category}</td>
                      <td style={{ padding: "10px 14px", color: "#64748b", whiteSpace: "nowrap" }}>{r.date}</td>
                      <td style={{ padding: "10px 14px" }}><Badge variant="danger">{r.hours} ч</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </BlockLoader>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════
export default function App() {
  const isMobile = useIsMobile();
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("kpf_user") || "null"); } catch { return null; }
  });
  const [currentView, setCurrentView] = useState("overview");
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10);
  });

  // Загрузка списка ресторанов
  useEffect(() => {
    if (!user) return;
    apiFetch("/api/departments")
      .then((json) => {
        const depts = json.departments || [];
        setDepartments(depts);
        if (depts.length && !selectedDept) setSelectedDept(depts[0]);
      })
      .catch(() => {});
  }, [user]);

  // Авто-обновление каждые 30 минут
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      clearCached();
      setRefreshSignal((s) => s + 1);
    }, 30 * 60 * 1000);
    return () => clearInterval(timer);
  }, [user]);

  if (!user) return <LoginPage onLogin={setUser} />;

  const showDeptSelect = !["overview", "plan-admin"].includes(currentView);

  return (
    <div style={{
      minHeight: "100vh",
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      background: "#f8fafc", color: "#0f172a",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        selectedDept={selectedDept}
        onSelectDept={setSelectedDept}
        departments={departments}
        user={user}
        onLogout={() => { localStorage.removeItem("kpf_user"); setUser(null); }}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
        expanded={sidebarExpanded}
        onToggleExpanded={() => setSidebarExpanded(v => !v)}
      />

      <main style={{
        flex: 1,
        padding: isMobile ? "12px 14px" : "20px 28px",
        overflow: "auto", minWidth: 0,
        marginLeft: isMobile ? 0 : (sidebarExpanded ? 260 : 64),
        transition: "margin-left 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16, flexWrap: "wrap", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} style={{
                width: 36, height: 36, borderRadius: 8, border: "1.5px solid #e2e8f0",
                background: "#fff", cursor: "pointer", fontSize: 18, display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}><Menu size={18} /></button>
            )}
            <DateRange dateFrom={dateFrom} dateTo={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} isMobile={isMobile} />
          </div>
          {showDeptSelect && (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{
                padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff",
                color: "#0f172a", cursor: "pointer",
                maxWidth: isMobile ? "100%" : 240, width: isMobile ? "100%" : "auto",
              }}
            >
              <option value="">Все филиалы</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
        </div>

        {/* Content */}
        {currentView === "overview"    && <OverviewPage   dateFrom={dateFrom} dateTo={dateTo} departments={departments} refreshSignal={refreshSignal} />}
        {currentView === "department"  && <DepartmentPage dept={selectedDept} dateFrom={dateFrom} dateTo={dateTo} refreshSignal={refreshSignal} />}
        {currentView === "labor"       && <LaborPage      dept={selectedDept} dateFrom={dateFrom} dateTo={dateTo} refreshSignal={refreshSignal} />}
        {currentView === "alerts"      && <AlertsPage     dept={selectedDept} departments={departments} dateFrom={dateFrom} dateTo={dateTo} refreshSignal={refreshSignal} />}
        {currentView === "plan-admin"  && <PlanAdmin />}
      </main>
    </div>
  );
}
