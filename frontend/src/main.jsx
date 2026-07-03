import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { persistShopFromQuery } from './services/apiClient'
import { ThemeProvider } from './contexts/ThemeContext'
import { ContentLanguageProvider } from './contexts/ContentLanguageContext'

// Persist the shop domain from the embedded app URL so API calls include it.
persistShopFromQuery();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <ContentLanguageProvider>
        <App />
      </ContentLanguageProvider>
    </ThemeProvider>
  </StrictMode>,
)