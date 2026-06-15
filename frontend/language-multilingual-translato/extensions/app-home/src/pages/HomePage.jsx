import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';

export default function HomePage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  // Mock data state for future API integration
  const [dashboardData, setDashboardData] = useState({
    overview: {
      totalProducts: 1540,
      totalPages: 12,
      totalCollections: 24,
      activeLanguages: 5,
      translationRequests: 128,
      status: 'Healthy',
    },
    analytics: {
      translatedProducts: 1420,
      translatedPages: 10,
      mostUsedLanguage: 'Spanish (ES)',
      successRate: '99.8%',
    },
    extension: {
      switcherStatus: 'Active',
      connection: 'Connected',
      lastSync: '10 mins ago',
    },
    settings: {
      googleApi: 'Verified',
      backend: 'Online',
      storeConnection: 'Authorized',
    },
    recentActivity: [
      { id: 1, action: 'Translated 50 Products to French', time: '2 hours ago', status: 'Success' },
      { id: 2, action: 'Updated Language Switcher Settings', time: '5 hours ago', status: 'Success' },
      { id: 3, action: 'Scanned Store Content', time: '1 day ago', status: 'Completed' },
    ]
  });

  useEffect(() => {
    // Simulate API fetch delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <s-page heading="🌐 Language Multilingual Translator">
      <s-button slot="primary-action" variant="primary">
        Translate Store
      </s-button>

      {loading ? (
        <s-section>
          <s-paragraph>Loading dashboard data...</s-paragraph>
        </s-section>
      ) : (
        <>
          {/* Quick Actions */}
          <s-section heading="Quick Actions">
            <s-button-group>
              <s-button>🔍 Scan Store Content</s-button>
              <s-button>🛍️ Translate Products</s-button>
              <s-button>📄 Translate Pages</s-button>
              <s-button>📂 Translate Collections</s-button>
              <s-button onClick={() => location.route('/settings')}>⚙️ Language Settings</s-button>
            </s-button-group>
          </s-section>

          {/* Dashboard Overview */}
          <s-section heading="Dashboard Overview">
            <s-grid gap="base">
              <s-box padding="base" borderRadius="base" borderWidth="base">
                <s-heading>Total Products</s-heading>
                <s-paragraph>{dashboardData.overview.totalProducts}</s-paragraph>
              </s-box>
              <s-box padding="base" borderRadius="base" borderWidth="base">
                <s-heading>Total Pages</s-heading>
                <s-paragraph>{dashboardData.overview.totalPages}</s-paragraph>
              </s-box>
              <s-box padding="base" borderRadius="base" borderWidth="base">
                <s-heading>Total Collections</s-heading>
                <s-paragraph>{dashboardData.overview.totalCollections}</s-paragraph>
              </s-box>
              <s-box padding="base" borderRadius="base" borderWidth="base">
                <s-heading>Active Languages</s-heading>
                <s-badge tone="success">{dashboardData.overview.activeLanguages} Languages</s-badge>
              </s-box>
              <s-box padding="base" borderRadius="base" borderWidth="base">
                <s-heading>Translation Requests</s-heading>
                <s-paragraph>{dashboardData.overview.translationRequests}</s-paragraph>
              </s-box>
              <s-box padding="base" borderRadius="base" borderWidth="base">
                <s-heading>Translation Status</s-heading>
                <s-badge tone="success">{dashboardData.overview.status}</s-badge>
              </s-box>
            </s-grid>
          </s-section>

          {/* Translation Analytics & Extension Status */}
          <s-section>
            <s-grid gap="base">
              <s-box padding="base" borderRadius="base" borderWidth="base">
                <s-heading>📈 Translation Analytics</s-heading>
                <s-table>
                  <s-table-body>
                    <s-table-row>
                      <s-table-cell>Translated Products</s-table-cell>
                      <s-table-cell>{dashboardData.analytics.translatedProducts}</s-table-cell>
                    </s-table-row>
                    <s-table-row>
                      <s-table-cell>Translated Pages</s-table-cell>
                      <s-table-cell>{dashboardData.analytics.translatedPages}</s-table-cell>
                    </s-table-row>
                    <s-table-row>
                      <s-table-cell>Most Used Language</s-table-cell>
                      <s-table-cell>{dashboardData.analytics.mostUsedLanguage}</s-table-cell>
                    </s-table-row>
                    <s-table-row>
                      <s-table-cell>Success Rate</s-table-cell>
                      <s-table-cell><s-badge tone="success">{dashboardData.analytics.successRate}</s-badge></s-table-cell>
                    </s-table-row>
                  </s-table-body>
                </s-table>
              </s-box>

              <s-box padding="base" borderRadius="base" borderWidth="base">
                <s-heading>🎨 Theme Extension Status</s-heading>
                <s-table>
                  <s-table-body>
                    <s-table-row>
                      <s-table-cell>Language Switcher</s-table-cell>
                      <s-table-cell><s-badge tone="success">{dashboardData.extension.switcherStatus}</s-badge></s-table-cell>
                    </s-table-row>
                    <s-table-row>
                      <s-table-cell>Extension Connection</s-table-cell>
                      <s-table-cell><s-badge tone="success">{dashboardData.extension.connection}</s-badge></s-table-cell>
                    </s-table-row>
                    <s-table-row>
                      <s-table-cell>Last Sync Time</s-table-cell>
                      <s-table-cell>{dashboardData.extension.lastSync}</s-table-cell>
                    </s-table-row>
                  </s-table-body>
                </s-table>
              </s-box>
            </s-grid>
          </s-section>

          {/* System Settings & Recent Activity */}
          <s-section>
            <s-grid gap="base">
              <s-box padding="base" borderRadius="base" borderWidth="base">
                <s-heading>⚙️ Settings Connection Status</s-heading>
                <s-table>
                  <s-table-body>
                    <s-table-row>
                      <s-table-cell>Google Translate API</s-table-cell>
                      <s-table-cell><s-badge tone="success">{dashboardData.settings.googleApi}</s-badge></s-table-cell>
                    </s-table-row>
                    <s-table-row>
                      <s-table-cell>Backend Services</s-table-cell>
                      <s-table-cell><s-badge tone="success">{dashboardData.settings.backend}</s-badge></s-table-cell>
                    </s-table-row>
                    <s-table-row>
                      <s-table-cell>Shopify Store Connection</s-table-cell>
                      <s-table-cell><s-badge tone="success">{dashboardData.settings.storeConnection}</s-badge></s-table-cell>
                    </s-table-row>
                  </s-table-body>
                </s-table>
              </s-box>

              <s-box padding="base" borderRadius="base" borderWidth="base">
                <s-heading>🕒 Recent Activity</s-heading>
                <s-table>
                  <s-table-header-row>
                    <s-table-header>Activity</s-table-header>
                    <s-table-header>Time</s-table-header>
                    <s-table-header>Status</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {dashboardData.recentActivity.map(activity => (
                      <s-table-row key={activity.id}>
                        <s-table-cell>{activity.action}</s-table-cell>
                        <s-table-cell>{activity.time}</s-table-cell>
                        <s-table-cell><s-badge tone={activity.status === 'Success' || activity.status === 'Completed' ? 'success' : 'neutral'}>{activity.status}</s-badge></s-table-cell>
                      </s-table-row>
                    ))}
                  </s-table-body>
                </s-table>
              </s-box>
            </s-grid>
          </s-section>
        </>
      )}
    </s-page>
  );
}