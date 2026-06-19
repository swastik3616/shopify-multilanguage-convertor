import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

const BACKEND = 'https://shopify-multilanguage-convertor.onrender.com';
const VERCEL  = 'https://shopify-multilanguage-convertor-plugin.vercel.app';

// ─── Data fetching ───────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v, fallback = '—') {
  return v === null || v === undefined || v === '' ? fallback : v;
}

function badgeStyle(status) {
  const s = String(status || '').toLowerCase();
  if (['active','healthy','connected','authorized','success','completed','online'].includes(s))
    return { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' };
  if (['warning','pending','degraded'].includes(s))
    return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
  if (['error','failed','disconnected','offline','unauthorized'].includes(s))
    return { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
  return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
}

// ─── SVG Line Chart ──────────────────────────────────────────────────────────

function LineChart({ data, width = 460, height = 200 }) {
  const days  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const W     = width;
  const H     = height;
  const padL  = 44;
  const padR  = 16;
  const padT  = 10;
  const padB  = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxV = Math.max(...data, 1);
  const minV = 0;

  const px = (i) => padL + (i / (data.length - 1)) * chartW;
  const py = (v) => padT + chartH - ((v - minV) / (maxV - minV)) * chartH;

  const pts = data.map((v, i) => `${px(i)},${py(v)}`).join(' ');

  // filled area path
  const areaPath =
    `M${px(0)},${py(data[0])} ` +
    data.slice(1).map((v, i) => {
      const x1 = px(i); const y1 = py(data[i]);
      const x2 = px(i + 1); const y2 = py(v);
      const cx = (x1 + x2) / 2;
      return `C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
    }).join(' ') +
    ` L${px(data.length - 1)},${padT + chartH} L${px(0)},${padT + chartH} Z`;

  // line path
  const linePath =
    `M${px(0)},${py(data[0])} ` +
    data.slice(1).map((v, i) => {
      const x1 = px(i); const y1 = py(data[i]);
      const x2 = px(i + 1); const y2 = py(v);
      const cx = (x1 + x2) / 2;
      return `C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
    }).join(' ');

  // Y-axis ticks
  const yTicks = [0, Math.round(maxV * 0.25), Math.round(maxV * 0.5), Math.round(maxV * 0.75), maxV];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#008060" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#008060" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Y-axis grid lines + labels */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={padL} y1={py(v)} x2={padL + chartW} y2={py(v)}
            stroke="#f1f5f9" strokeWidth="1"
          />
          <text x={padL - 6} y={py(v) + 4} textAnchor="end" fill="#94a3b8" fontSize="10">
            {v}
          </text>
        </g>
      ))}

      {/* Filled area */}
      <path d={areaPath} fill="url(#chartGrad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke="#008060" strokeWidth="2.2" />

      {/* Dots */}
      {data.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r="3.5" fill="#008060" stroke="#fff" strokeWidth="1.5" />
      ))}

      {/* X-axis labels */}
      {days.map((d, i) => (
        <text key={d} x={px(i)} y={padT + chartH + 18} textAnchor="middle" fill="#94a3b8" fontSize="10">
          {d}
        </text>
      ))}
    </svg>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Badge({ value, status }) {
  const s  = status ?? String(value ?? '');
  const c  = badgeStyle(s);
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: '20px', fontSize: '11px', fontWeight: 600,
    }}>
      {fmt(value)}
    </span>
  );
}

function StatCard({ icon, label, value, sub, subColor = '#008060' }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '20px 22px',
      flex: '1 1 180px',
      minWidth: 0,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{label}</span>
        <span style={{ color: '#cbd5e1', fontSize: '16px' }}>{icon}</span>
      </div>
      <div style={{ fontSize: '32px', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
        {fmt(value, '0')}
      </div>
      {sub && (
        <div style={{ fontSize: '12px', color: subColor, fontWeight: 500 }}>{sub}</div>
      )}
    </div>
  );
}

function ActivityItem({ icon, title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 0' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        background: '#f1f5f9', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{title}</div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '1px' }}>{sub}</div>
      </div>
    </div>
  );
}

function SkeletonBlock({ h = 16, w = '100%', mb = 8, br = 6 }) {
  return (
    <div style={{
      height: h, width: w, marginBottom: mb, borderRadius: br,
      background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  );
}

// ─── Chart data ──────────────────────────────────────────────────────────────

const CHART_FALLBACK = [3800, 2800, 3100, 2900, 2600, 2700, 3200];

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Stat values from API or fallback to reasonable defaults
  const stats = useMemo(() => {
    const o = data?.overview;
    const a = data?.analytics;
    return {
      languages:    o?.activeLanguages     ?? '—',
      providers:    o?.providers           ?? '1',
      translations: a?.translatedProducts  ?? o?.translationRequests ?? '—',
      jobs:         o?.pendingJobs         ?? '0',
    };
  }, [data]);

  const recentActivity = useMemo(() => {
    if (data?.recentActivity?.length) return data.recentActivity;
    // friendly fallback
    return [
      { id: 1, icon: '🔄', action: 'Translated Homepage',      time: 'English to French · 2 mins ago',   status: 'completed' },
      { id: 2, icon: '🌐', action: 'Added German Language',     time: 'Settings updated · 1 hr ago',       status: 'completed' },
      { id: 3, icon: '🔑', action: 'Provider updated',          time: 'OpenAI API Key changed · 3 hrs ago',status: 'completed' },
    ];
  }, [data]);

  const chartData = useMemo(() => {
    if (data?.analytics?.volumeByDay) return data.analytics.volumeByDay;
    return CHART_FALLBACK;
  }, [data]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* Page heading */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Dashboard</h1>
        <button
          style={{
            padding: '10px 22px',
            background: '#008060',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onClick={() => window.open(`${VERCEL}/translations`, '_blank')}
        >
          + New Translation
        </button>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{
              flex: '1 1 180px', background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: '12px', padding: '20px',
            }}>
              <SkeletonBlock h={12} w={80} />
              <SkeletonBlock h={32} w={60} mb={0} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <StatCard icon="🌐" label="Languages"    value={stats.languages}    sub="+1 this week" />
          <StatCard icon="🔌" label="Providers"    value={stats.providers}    sub="Active" />
          <StatCard icon="🔄" label="Translations" value={stats.translations} sub="-3 today"    subColor="#ef4444" />
          <StatCard icon="⚙️" label="Jobs"         value={stats.jobs}         sub="None pending" subColor="#94a3b8" />
        </div>
      )}

      {/* Chart + Activity row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        {/* Translation Volume Chart */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '22px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          minWidth: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Translation Volume</span>
            <span style={{ color: '#cbd5e1', cursor: 'pointer', fontSize: '18px' }}>⋯</span>
          </div>
          {loading ? (
            <SkeletonBlock h={180} w="100%" br={8} mb={0} />
          ) : (
            <LineChart data={chartData} width={460} height={200} />
          )}
        </div>

        {/* Recent Activity */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '22px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Recent Activity</span>
            <button
              style={{ background: 'none', border: 'none', color: '#008060', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              onClick={() => window.open(`${VERCEL}/audit-history`, '_blank')}
            >
              View all
            </button>
          </div>

          {loading ? (
            <div style={{ marginTop: '12px' }}>
              {[1, 2, 3].map((n) => (
                <div key={n} style={{ display: 'flex', gap: '12px', padding: '10px 0' }}>
                  <SkeletonBlock h={32} w={32} br={50} mb={0} />
                  <div style={{ flex: 1 }}>
                    <SkeletonBlock h={12} w="70%" />
                    <SkeletonBlock h={10} w="50%" mb={0} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ divider: '1px solid #f1f5f9' }}>
              {recentActivity.slice(0, 6).map((item, i) => (
                <div key={item.id ?? i} style={{ borderBottom: i < recentActivity.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <ActivityItem
                    icon={item.icon ?? '🔄'}
                    title={item.action ?? item.title ?? '—'}
                    sub={item.time ?? item.sub ?? ''}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && !loading && (
        <div style={{
          background: '#fee2e2', border: '1px solid #fca5a5',
          borderRadius: '10px', padding: '14px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: '#991b1b', fontSize: '13px' }}>⚠️ {error}</span>
          <button
            onClick={load}
            style={{
              background: '#991b1b', color: '#fff', border: 'none',
              borderRadius: '6px', padding: '5px 14px', fontSize: '12px',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}