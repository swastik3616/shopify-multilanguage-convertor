import { useState, useEffect } from "react";
import {
  reactExtension,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Divider,
  Link,
} from "@shopify/ui-extensions-react/admin";

export default reactExtension("admin.app.home.render", () => <App />);

const BACKEND = "https://shopify-multilanguage-convertor.onrender.com";
const VERCEL = "https://shopify-multilanguage-convertor-plugin.vercel.app";

async function fetchDashboard() {
  const res = await fetch(`${BACKEND}/api/dashboard`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Dashboard fetch failed (${res.status})`);
  return await res.json();
}

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchDashboard();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = {
    languages: data?.overview?.activeLanguages ?? "—",
    providers: data?.overview?.providers ?? "1",
    translations: data?.analytics?.translatedProducts ?? data?.overview?.translationRequests ?? "—",
    jobs: data?.overview?.pendingJobs ?? "0",
  };

  const recentActivity = data?.recentActivity?.length
    ? data.recentActivity
    : [
      { id: 1, action: "Translated Homepage", time: "2 mins ago" },
      { id: 2, action: "Added German Language", time: "1 hr ago" },
      { id: 3, action: "Provider updated", time: "3 hrs ago" },
    ];

  return (
    <BlockStack gap="base">
      {/* Menu Bar for Redirection */}
      <BlockStack>
        <BlockStack gap="base">
          <Text fontWeight="bold">Quick Navigation</Text>
          <InlineStack gap="base">
            <Link href={`${VERCEL}/languages`}>Languages</Link>
            <Link href={`${VERCEL}/providers`}>Providers</Link>
            <Link href={`${VERCEL}/translations`}>Translations</Link>
            <Link href={`${VERCEL}/live-translation`}>Live Translate</Link>
            <Link href={`${VERCEL}/store-settings`}>Store Settings</Link>
          </InlineStack>
        </BlockStack>
      </BlockStack>

      {/* Error Message */}
      {error && !loading && (
        <BlockStack>
          <BlockStack gap="base">
            <Text tone="critical" fontWeight="bold">⚠️ Error Loading Data</Text>
            <Text>{error}</Text>
            <Button onClick={load}>Retry</Button>
          </BlockStack>
        </BlockStack>
      )}

      {/* Stats Cards Row */}
      <InlineStack gap="base" columns={4}>
        <StatCard title="Languages" value={loading ? "..." : stats.languages} subtitle="+1 this week" />
        <StatCard title="Providers" value={loading ? "..." : stats.providers} subtitle="Active" />
        <StatCard title="Translations" value={loading ? "..." : stats.translations} subtitle="-3 today" />
        <StatCard title="Jobs" value={loading ? "..." : stats.jobs} subtitle="None pending" />
      </InlineStack>

      {/* Recent Activity */}
      <BlockStack>
        <BlockStack gap="base">
          <InlineStack align="space-between" blockAlign="center">
            <Text fontWeight="bold" variant="headingMd">Recent Activity</Text>
            <Link href={`${VERCEL}/audit-history`}>View all</Link>
          </InlineStack>
          <Divider />
          {loading ? (
            <Text appearance="subdued">Loading recent activity...</Text>
          ) : (
            <BlockStack gap="base">
              {recentActivity.map((item, index) => (
                <BlockStack key={index} gap="none">
                  <Text fontWeight="medium">{item.action || item.title || "—"}</Text>
                  <Text appearance="subdued" size="small">{item.time || item.sub || ""}</Text>
                </BlockStack>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </BlockStack>
    </BlockStack>
  );
}

function StatCard({ title, value, subtitle }) {
  return (
    <BlockStack>
      <BlockStack gap="none">
        <Text appearance="subdued" size="small">{title}</Text>
        <Text fontWeight="bold" variant="headingLg">{value}</Text>
        {subtitle && <Text appearance="subdued" size="small">{subtitle}</Text>}
      </BlockStack>
    </BlockStack>
  );
}
