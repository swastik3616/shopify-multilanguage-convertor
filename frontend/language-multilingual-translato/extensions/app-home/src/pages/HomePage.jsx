import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';

const DASHBOARD_ENDPOINT = '/api/dashboard';

const INITIAL_DASHBOARD_STATE = {
  overview: null,
  analytics: null,
  extension: null,
  settings: null,
  recentActivity: [],
};

function formatFallback(value, fallback = '—') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  return value;
}

function getToneFromStatus(status) {
  const normalized = String(status || '').toLowerCase();

  if (['healthy', 'active', 'connected', 'online', 'verified', 'authorized', 'success', 'completed'].includes(normalized)) {
    return 'success';
  }

  if (['warning', 'pending', 'degraded'].includes(normalized)) {
    return 'warning';
  }

  if (['error', 'failed', 'disconnected', 'offline', 'unauthorized'].includes(normalized)) {
    return 'critical';
  }

  return 'neutral';
}

function hasDashboardContent(data) {
  if (!data) return false;

  return Boolean(
    data.overview ||
    data.analytics ||
    data.extension ||
    data.settings ||
    (Array.isArray(data.recentActivity) && data.recentActivity.length > 0)
  );
}

async function fetchDashboardData() {
  const response = await fetch(DASHBOARD_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load dashboard (${response.status})`);
  }

  const payload = await response.json();

  return {
    overview: payload?.overview ?? null,
    analytics: payload?.analytics ?? null,
    extension: payload?.extension ?? null,
    settings: payload?.settings ?? null,
    recentActivity: Array.isArray(payload?.recentActivity) ? payload.recentActivity : [],
  };
}

function MetricCard({ title, value, tone = 'neutral', badge = false }) {
  return (
    <s-box padding="base" borderRadius="base" borderWidth="base">
      <s-stack gap="tight">
        <s-text fontWeight="medium" tone="subdued">
          {title}
        </s-text>
        {badge ? (
          <s-badge tone={tone}>{formatFallback(value)}</s-badge>
        ) : (
          <s-heading>{formatFallback(value)}</s-heading>
        )}
      </s-stack>
    </s-box>
  );
}

function StatusCard({ title, rows = [] }) {
  return (
    <s-box padding="base" borderRadius="base" borderWidth="base">
      <s-stack gap="base">
        <s-heading>{title}</s-heading>
        <s-table>
          <s-table-body>
            {rows.map((row) => (
              <s-table-row key={row.label}>
                <s-table-cell>{row.label}</s-table-cell>
                <s-table-cell>
                  {row.badge ? (
                    <s-badge tone={row.tone ?? getToneFromStatus(row.value)}>
                      {formatFallback(row.value)}
                    </s-badge>
                  ) : (
                    formatFallback(row.value)
                  )}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-stack>
    </s-box>
  );
}

function AnalyticsTable({ rows = [] }) {
  return <StatusCard title="Translation Analytics" rows={rows} />;
}

function ActivityTable({ activities = [] }) {
  if (!activities.length) {
    return (
      <s-box padding="base" borderRadius="base" borderWidth="base">
        <s-stack gap="base">
          <s-heading>Recent Activity</s-heading>
          <s-paragraph tone="subdued">No recent translation activity found.</s-paragraph>
        </s-stack>
      </s-box>
    );
  }

  return (
    <s-box padding="base" borderRadius="base" borderWidth="base">
      <s-stack gap="base">
        <s-heading>Recent Activity</s-heading>
        <s-table>
          <s-table-header-row>
            <s-table-header>Activity</s-table-header>
            <s-table-header>Time</s-table-header>
            <s-table-header>Status</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {activities.map((activity, index) => (
              <s-table-row key={activity.id ?? `${activity.action}-${index}`}>
                <s-table-cell>{formatFallback(activity.action)}</s-table-cell>
                <s-table-cell>{formatFallback(activity.time)}</s-table-cell>
                <s-table-cell>
                  <s-badge tone={getToneFromStatus(activity.status)}>
                    {formatFallback(activity.status)}
                  </s-badge>
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-stack>
    </s-box>
  );
}

function QuickActions({ onNavigateSettings }) {
  const actions = [
    { label: 'Scan Store Content' },
    { label: 'Translate Products' },
    { label: 'Translate Pages' },
    { label: 'Translate Collections' },
    { label: 'Language Settings', onClick: onNavigateSettings },
  ];

  return (
    <s-section heading="Quick Actions">
      <s-button-group>
        {actions.map((action) => (
          <s-button key={action.label} onClick={action.onClick}>
            {action.label}
          </s-button>
        ))}
      </s-button-group>
    </s-section>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <s-section heading="Quick Actions">
        <s-button-group>
          <s-button disabled>Loading…</s-button>
          <s-button disabled>Loading…</s-button>
          <s-button disabled>Loading…</s-button>
          <s-button disabled>Loading…</s-button>
          <s-button disabled>Loading…</s-button>
        </s-button-group>
      </s-section>

      <s-section heading="Overview Metrics">
        <s-grid gap="base">
          {Array.from({ length: 6 }).map((_, index) => (
            <s-box key={index} padding="base" borderRadius="base" borderWidth="base">
              <s-stack gap="tight">
                <s-text tone="subdued">Loading metric…</s-text>
                <s-paragraph>—</s-paragraph>
              </s-stack>
            </s-box>
          ))}
        </s-grid>
      </s-section>

      <s-section>
        <s-grid gap="base">
          <s-box padding="base" borderRadius="base" borderWidth="base">
            <s-heading>Translation Analytics</s-heading>
            <s-paragraph tone="subdued">Loading analytics…</s-paragraph>
          </s-box>
          <s-box padding="base" borderRadius="base" borderWidth="base">
            <s-heading>Theme Extension Status</s-heading>
            <s-paragraph tone="subdued">Loading extension status…</s-paragraph>
          </s-box>
        </s-grid>
      </s-section>

      <s-section>
        <s-grid gap="base">
          <s-box padding="base" borderRadius="base" borderWidth="base">
            <s-heading>System Status</s-heading>
            <s-paragraph tone="subdued">Loading system status…</s-paragraph>
          </s-box>
          <s-box padding="base" borderRadius="base" borderWidth="base">
            <s-heading>Recent Activity</s-heading>
            <s-paragraph tone="subdued">Loading activity…</s-paragraph>
          </s-box>
        </s-grid>
      </s-section>
    </>
  );
}

function DashboardErrorState({ message, onRetry }) {
  return (
    <s-section heading="Dashboard">
      <s-box padding="base" borderRadius="base" borderWidth="base">
        <s-stack gap="base">
          <s-heading>Unable to load dashboard</s-heading>
          <s-paragraph tone="subdued">
            {message || 'Something went wrong while loading your dashboard data.'}
          </s-paragraph>
          <s-button variant="primary" onClick={onRetry}>
            Retry
          </s-button>
        </s-stack>
      </s-box>
    </s-section>
  );
}

function DashboardEmptyState() {
  return (
    <s-section heading="Dashboard">
      <s-box padding="base" borderRadius="base" borderWidth="base">
        <s-stack gap="base">
          <s-heading>No dashboard data available</s-heading>
          <s-paragraph tone="subdued">
            Your store data will appear here once the dashboard service returns content.
          </s-paragraph>
        </s-stack>
      </s-box>
    </s-section>
  );
}

export default function HomePage() {
  const location = useLocation();

  const [dashboardData, setDashboardData] = useState(INITIAL_DASHBOARD_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const data = await fetchDashboardData();
      setDashboardData(data);
    } catch (error) {
      setDashboardData(INITIAL_DASHBOARD_STATE);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const overviewMetrics = useMemo(() => {
    const overview = dashboardData.overview;

    return [
      {
        title: 'Total Products',
        value: overview?.totalProducts,
      },
      {
        title: 'Total Pages',
        value: overview?.totalPages,
      },
      {
        title: 'Total Collections',
        value: overview?.totalCollections,
      },
      {
        title: 'Active Languages',
        value: overview?.activeLanguages,
        badge: true,
        tone: 'success',
      },
      {
        title: 'Translation Requests',
        value: overview?.translationRequests,
      },
      {
        title: 'Translation Status',
        value: overview?.status,
        badge: true,
        tone: getToneFromStatus(overview?.status),
      },
    ];
  }, [dashboardData.overview]);

  const analyticsRows = useMemo(() => {
    const analytics = dashboardData.analytics;

    return [
      {
        label: 'Translated Products',
        value: analytics?.translatedProducts,
      },
      {
        label: 'Translated Pages',
        value: analytics?.translatedPages,
      },
      {
        label: 'Most Used Language',
        value: analytics?.mostUsedLanguage,
      },
      {
        label: 'Success Rate',
        value: analytics?.successRate,
        badge: true,
        tone: 'success',
      },
    ];
  }, [dashboardData.analytics]);

  const extensionRows = useMemo(() => {
    const extension = dashboardData.extension;

    return [
      {
        label: 'Switcher Status',
        value: extension?.switcherStatus,
        badge: true,
      },
      {
        label: 'Extension Connection',
        value: extension?.connection,
        badge: true,
      },
      {
        label: 'Last Sync',
        value: extension?.lastSync,
      },
    ];
  }, [dashboardData.extension]);

  const systemRows = useMemo(() => {
    const settings = dashboardData.settings;

    return [
      {
        label: 'Current Provider',
        value: settings?.currentProvider,
      },
      {
        label: 'Backend Status',
        value: settings?.backend,
        badge: true,
      },
      {
        label: 'Store Connection',
        value: settings?.storeConnection,
        badge: true,
      },
    ];
  }, [dashboardData.settings]);

  const showEmptyState = !isLoading && !errorMessage && !hasDashboardContent(dashboardData);

  return (
    <s-page heading="Language Multilingual Translator">
      <s-button slot="primary-action" variant="primary" disabled={isLoading}>
        Translate Store
      </s-button>

      {isLoading ? (
        <DashboardSkeleton />
      ) : errorMessage ? (
        <DashboardErrorState message={errorMessage} onRetry={loadDashboard} />
      ) : showEmptyState ? (
        <DashboardEmptyState />
      ) : (
        <>
          <QuickActions onNavigateSettings={() => location.route('/settings')} />

          <s-section heading="Overview Metrics">
            <s-grid gap="base">
              {overviewMetrics.map((metric) => (
                <MetricCard
                  key={metric.title}
                  title={metric.title}
                  value={metric.value}
                  badge={metric.badge}
                  tone={metric.tone}
                />
              ))}
            </s-grid>
          </s-section>

          <s-section>
            <s-grid gap="base">
              <AnalyticsTable rows={analyticsRows} />
              <StatusCard title="Theme Extension Status" rows={extensionRows} />
            </s-grid>
          </s-section>

          <s-section>
            <s-grid gap="base">
              <StatusCard title="System Status" rows={systemRows} />
              <ActivityTable activities={dashboardData.recentActivity} />
            </s-grid>
          </s-section>
        </>
      )}
    </s-page>
  );
}