import { BrowserRouter, Routes, Route } from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import LanguagesPage from "./pages/LanguagesPage";
import ProvidersPage from "./pages/ProvidersPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/languages" element={<LanguagesPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;