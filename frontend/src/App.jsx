import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";

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
import CurrencyPage from "./pages/CurrencyPage";

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
        <Route path="/currency" element={<CurrencyPage />} />
      </Routes>
    </DashboardLayout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;