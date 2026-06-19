import { render, h } from 'preact';
import { useState } from 'preact/hooks';
import { LocationProvider, ErrorBoundary, Router, Route } from 'preact-iso';

import HomePage from './pages/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default async () => {
  render(<App />, document.body);
};

// ─── Icons (inline SVG) ──────────────────────────────────────────────────────

function Icon({ d, size = 16, strokeWidth = 1.7 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  dashboard:      'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  languages:      'M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6',
  providers:      'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  translations:   'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4',
  liveTranslation:'M12 2a10 10 0 110 20A10 10 0 0112 2zm0 6v6l4 2',
  jobs:           'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  analytics:      'M18 20V10M12 20V4M6 20v-6',
  audit:          'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  storeSettings:  'M3 9a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M3 9l9-5 9 5',
  settings:       'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  bell:           'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0',
  user:           'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
  search:         'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
};

const VERCEL = 'https://shopify-multilanguage-convertor-plugin.vercel.app';

// ─── Nav config ─────────────────────────────────────────────────────────────

const MENU_ITEMS = [
  { label: 'Dashboard',       icon: 'dashboard',       href: '/',                  internal: true  },
  { label: 'Languages',       icon: 'languages',       href: `${VERCEL}/languages`              },
  { label: 'Providers',       icon: 'providers',       href: `${VERCEL}/providers`              },
  { label: 'Translations',    icon: 'translations',    href: `${VERCEL}/translations`           },
  { label: 'Live Translation',icon: 'liveTranslation', href: `${VERCEL}/live-translation`       },
  { label: 'Jobs',            icon: 'jobs',            href: `${VERCEL}/jobs`                   },
  { label: 'Analytics',       icon: 'analytics',       href: `${VERCEL}/analytics`              },
  { label: 'Audit History',   icon: 'audit',           href: `${VERCEL}/audit-history`          },
];

const SYSTEM_ITEMS = [
  { label: 'Store Settings',  icon: 'storeSettings',   href: `${VERCEL}/store-settings`         },
  { label: 'Settings',        icon: 'settings',        href: `${VERCEL}/settings`               },
];

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function NavItem({ item, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  const isActive = active === item.label;

  const style = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? '#008060' : hovered ? '#0f172a' : '#475569',
    background: isActive ? '#e6f4f0' : hovered ? '#f8fafc' : 'transparent',
    transition: 'all 0.15s',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    textDecoration: 'none',
    boxSizing: 'border-box',
  };

  const handleClick = (e) => {
    e.preventDefault();
    if (item.internal) {
      onClick(item.label);
    } else {
      window.open(item.href, '_blank');
    }
  };

  return (
    <button
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      <span style={{ color: isActive ? '#008060' : '#94a3b8', flexShrink: 0 }}>
        <Icon d={ICONS[item.icon]} size={15} />
      </span>
      {item.label}
    </button>
  );
}

function Sidebar({ active, onNavigate }) {
  return (
    <aside style={{
      width: '200px',
      minWidth: '200px',
      background: '#fff',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      overflowY: 'auto',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '18px 16px 16px',
        borderBottom: '1px solid #f1f5f9',
      }}>
        <div style={{
          width: '32px', height: '32px',
          background: '#008060',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: '14px',
          flexShrink: 0,
        }}>T</div>
        <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>Translator</span>
      </div>

      {/* Main nav */}
      <nav style={{ flex: 1, padding: '14px 10px 8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 6px 8px' }}>
          MENU
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {MENU_ITEMS.map((item) => (
            <NavItem key={item.label} item={item} active={active} onClick={onNavigate} />
          ))}
        </div>

        <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '20px 6px 8px' }}>
          SYSTEM
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {SYSTEM_ITEMS.map((item) => (
            <NavItem key={item.label} item={item} active={active} onClick={onNavigate} />
          ))}
        </div>
      </nav>
    </aside>
  );
}

// ─── Top Bar ─────────────────────────────────────────────────────────────────

function TopBar() {
  return (
    <header style={{
      height: '52px',
      background: '#fff',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
      gap: '12px',
    }}>
      {/* Search */}
      <div style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
          <Icon d={ICONS.search} size={14} />
        </span>
        <input
          type="text"
          placeholder="Search..."
          style={{
            width: '100%',
            height: '34px',
            paddingLeft: '32px',
            paddingRight: '12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#334155',
            outline: 'none',
            background: '#f8fafc',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          style={{
            padding: '6px 14px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            background: '#fff',
            fontSize: '12px',
            fontWeight: 500,
            color: '#008060',
            cursor: 'pointer',
          }}
          onClick={() => window.open('https://translator-test-store.myshopify.com', '_blank')}
        >
          Demo Store
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: '4px' }}>
          <Icon d={ICONS.bell} size={18} />
        </button>
        <div style={{
          width: '30px', height: '30px',
          background: '#e2e8f0',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#64748b', cursor: 'pointer',
        }}>
          <Icon d={ICONS.user} size={16} />
        </div>
      </div>
    </header>
  );
}

// ─── App shell ───────────────────────────────────────────────────────────────

function App() {
  const [activePage, setActivePage] = useState('Dashboard');

  return (
    <LocationProvider>
      <div style={{
        display: 'flex',
        height: '100vh',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        background: '#f8fafc',
        overflow: 'hidden',
      }}>
        <Sidebar active={activePage} onNavigate={setActivePage} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopBar />
          <main style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
            <ErrorBoundary>
              <Router>
                <Route path="/" component={HomePage} />
                <Route default component={NotFoundPage} />
              </Router>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </LocationProvider>
  );
}
