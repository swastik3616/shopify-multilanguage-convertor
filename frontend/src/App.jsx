import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";

import DashboardLayout from "./layouts/DashboardLayout";

import DashboardPage from "./pages/DashboardPage";
import LanguagesPage from "./pages/LanguagesPage";
import ProvidersPage from "./pages/ProvidersPage";
import TranslationsPage from "./pages/TranslationsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import AuditHistoryPage from "./pages/AuditHistoryPage";
import StoreSettingsPage from "./pages/StoreSettingsPage";
import SeoPage from "./pages/SeoPage";

function AppContent() {
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/languages" element={<LanguagesPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/translations" element={<TranslationsPage />} />
        <Route path="/seo" element={<SeoPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/audit-history" element={<AuditHistoryPage />} />
        <Route path="/store-settings" element={<StoreSettingsPage />} />
      </Routes>
    </DashboardLayout>
  );
}

function App() {
  // Extract shop environment passed by Shopify Admin iframe
  const urlParams = new URLSearchParams(window.location.search);
  const host = urlParams.get("host") || "";

  const appBridgeConfig = {
    apiKey: import.meta.env.VITE_SHOPIFY_CLIENT_ID || process.env.REACT_APP_SHOPIFY_CLIENT_ID, // Use appropriate env var based on Vite/CRA
    host: host,
    forceRedirect: true,
  };

  return (
    <BrowserRouter>
      {/* Wrap your app in AppBridgeProvider if loaded inside Shopify Admin */}
      {host ? (
        <AppBridgeProvider config={appBridgeConfig}>
          <AppContent />
        </AppBridgeProvider>
      ) : (
        <AppContent />
      )}
    </BrowserRouter>
  );
}

export default App;