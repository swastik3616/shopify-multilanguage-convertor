import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../components/StatCard";
import { Languages, Plug, ArrowRightLeft, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch } from "../services/apiClient";

const REFRESH_INTERVAL_MS = 30_000; // auto-refresh every 30 s]

async function fetchDashboard() {
  const res = await apiFetch("/api/dashboard", { headers: { Accept: "application/json" } });
  const p = await res.json();
  return {
    overview: p?.overview ?? null,
    analytics: p?.analytics ?? null,
    recentActivity: Array.isArray(p?.recentActivity) ? p.recentActivity : [],
  };
}

function Skeleton({ className }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

/* Pulse dot for "Live" indicator */
function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
    </span>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      setData(await fetchDashboard());
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 s (silent — no skeleton flash)
  useEffect(() => {
    const id = setInterval(() => load(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  /* ── Stat cards ── */
  const stats = useMemo(() => {
    const o = data?.overview;
    return [
      { title: "Languages", value: o?.activeLanguages ?? "—", icon: Languages, trend: "Configured" },
      { title: "Providers", value: o?.providers ?? "—", icon: Plug, trend: "Active" },
      { title: "Translations", value: o?.translationRequests ?? "—", icon: ArrowRightLeft, trend: "All time" },
      { title: "Installed", value: o?.installationTime ?? "—", icon: Clock, trend: "First seen" },
    ];
  }, [data]);

  /* ── Chart data — uses real dates from backend ── */
  const chartData = useMemo(() => {
    const vols = data?.analytics?.volumeByDay;
    const labels = data?.analytics?.dayLabels;
    if (Array.isArray(vols) && vols.length) {
      return vols.map((val, i) => ({
        name: labels?.[i] ?? `Day ${i + 1}`,
        translations: val,
      }));
    }
    // No data yet — show last 7 days with zeros so chart is visible but empty
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return {
        name: d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }),
        translations: 0,
      };
    });
  }, [data]);

  const totalToday = useMemo(() => {
    const vols = data?.analytics?.volumeByDay;
    if (!Array.isArray(vols) || !vols.length) return 0;
    return vols[vols.length - 1] ?? 0;           // last element = today
  }, [data]);

  const recentActivity = useMemo(() =>
    data?.recentActivity ?? [], [data]);

  /* ── UI ── */
  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Dashboard</h1>
          {!loading && (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
              <LiveDot /> Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && !loading && (
            <span className="text-xs text-slate-400 hidden sm:block">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button className="btn btn-primary px-4 py-2" onClick={() => navigate("/translations")}>
            + New Translation
          </button>
        </div>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => load(false)} className="text-sm font-semibold hover:underline">Retry</button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-container p-6">
              <Skeleton className="h-4 w-20 mb-4" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))
        ) : (
          stats.map((item, i) => <StatCard key={i} {...item} />)
        )}
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Area chart */}
        <div className="lg:col-span-2 card-container p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900">Translation Volume</h3>
              {!loading && <LiveDot />}
            </div>
            <span className="text-xs text-slate-400">Last 7 days</span>
          </div>

          {/* Today's count */}
          {!loading && (
            <p className="text-xs text-slate-500 mb-5">
              <span className="font-semibold text-slate-800">{totalToday}</span> translation{totalToday !== 1 ? "s" : ""} today
            </p>
          )}

          {loading ? (
            <div className="h-72 w-full">
              <Skeleton className="h-full w-full" />
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTranslations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#008060" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#008060" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    axisLine={false} tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 11 }} dy={10}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false} tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    formatter={(v) => [v, "Translations"]}
                  />
                  <Area
                    type="monotone" dataKey="translations"
                    stroke="#008060" strokeWidth={2}
                    fillOpacity={1} fill="url(#colorTranslations)"
                    dot={{ r: 3, fill: "#008060", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card-container p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-900">Recent Activity</h3>
            {!loading && <LiveDot />}
          </div>
          <div className="flex flex-col gap-4 flex-1 overflow-y-auto max-h-72">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <div className="w-full">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))
            ) : recentActivity.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">
                No activity yet
              </div>
            ) : (
              recentActivity.map((item, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-900 font-medium truncate">{item.action || "—"}</p>
                    <p className="text-xs text-slate-400">{item.time || ""}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default DashboardPage;