import { useState, useEffect, useMemo } from "react";
import StatCard from "../components/StatCard";
import { Languages, Plug, ArrowRightLeft, ListTodo, MoreVertical, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const BACKEND = 'https://shopify-multilanguage-convertor.onrender.com';

async function fetchDashboard() {
  const res = await fetch(`${BACKEND}/api/dashboard`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Dashboard fetch failed (${res.status})`);
  const p = await res.json();
  return {
    overview:       p?.overview       ?? null,
    analytics:      p?.analytics      ?? null,
    extension:      p?.extension      ?? null,
    settings:       p?.settings       ?? null,
    recentActivity: Array.isArray(p?.recentActivity) ? p.recentActivity : [],
  };
}

const DEFAULT_CHART_DATA = [
  { name: 'Mon', translations: 4000 },
  { name: 'Tue', translations: 3000 },
  { name: 'Wed', translations: 2000 },
  { name: 'Thu', translations: 2780 },
  { name: 'Fri', translations: 1890 },
  { name: 'Sat', translations: 2390 },
  { name: 'Sun', translations: 3490 },
];

function Skeleton({ className }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`}></div>;
}

function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const o = data?.overview;
    const a = data?.analytics;
    return [
      {
        title: "Languages",
        value: o?.activeLanguages ?? "—",
        icon: Languages,
        trend: "+1 this week"
      },
      {
        title: "Providers",
        value: o?.providers ?? "1",
        icon: Plug,
        trend: "Active"
      },
      {
        title: "Translations",
        value: a?.translatedProducts ?? o?.translationRequests ?? "—",
        icon: ArrowRightLeft,
        trend: "-3 today"
      },
      {
        title: "Jobs",
        value: o?.pendingJobs ?? "0",
        icon: ListTodo,
        trend: "None pending"
      },
    ];
  }, [data]);

  const recentActivity = useMemo(() => {
    if (data?.recentActivity?.length) return data.recentActivity;
    return [
      { id: 1, action: 'Translated Homepage', time: 'English to French • 2 mins ago', icon: ArrowRightLeft, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100' },
      { id: 2, action: 'Added German Language', time: 'Settings updated • 1 hr ago', icon: Languages, iconColor: 'text-blue-600', iconBg: 'bg-blue-100' },
      { id: 3, action: 'Provider updated', time: 'OpenAI API Key changed • 3 hrs ago', icon: Plug, iconColor: 'text-amber-600', iconBg: 'bg-amber-100' },
    ];
  }, [data]);

  const chartData = useMemo(() => {
    if (data?.analytics?.volumeByDay && Array.isArray(data.analytics.volumeByDay)) {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return data.analytics.volumeByDay.map((val, i) => ({
        name: days[i] || `Day ${i+1}`,
        translations: val
      }));
    }
    return DEFAULT_CHART_DATA;
  }, [data]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Dashboard</h1>
        <button className="btn btn-primary px-4 py-2" onClick={() => window.open('https://shopify-multilanguage-convertor-plugin.vercel.app/translations', '_blank')}>
          + New Translation
        </button>
      </div>

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={load} className="text-sm font-semibold hover:underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-container p-6">
              <Skeleton className="h-4 w-20 mb-4" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))
        ) : (
          stats.map((item, index) => (
            <StatCard key={index} {...item} />
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-container p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-900">Translation Volume</h3>
            <button className="p-1 hover:bg-slate-100 rounded text-slate-400">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
          {loading ? (
            <div className="h-72 w-full flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTranslations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#008060" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#008060" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="translations" stroke="#008060" strokeWidth={2} fillOpacity={1} fill="url(#colorTranslations)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card-container p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-900">Recent Activity</h3>
            <button className="text-sm font-medium text-[#008060] hover:text-[#006e52]">View all</button>
          </div>
          <div className="flex flex-col gap-4 flex-1">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <div className="w-full">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))
            ) : (
              recentActivity.map((item, index) => {
                const Icon = item.icon || ArrowRightLeft;
                return (
                  <div key={index} className="flex gap-4">
                    <div className={`w-8 h-8 rounded-full ${item.iconBg || 'bg-slate-100'} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 ${item.iconColor || 'text-slate-600'}`} />
                    </div>
                    <div>
                      <p className="text-sm text-slate-900 font-medium">{item.action || item.title || '—'}</p>
                      <p className="text-xs text-slate-500">{item.time || item.sub || ''}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;