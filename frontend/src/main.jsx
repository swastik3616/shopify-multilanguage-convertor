import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { persistShopFromQuery } from './services/apiClient'

// Persist the shop domain from the embedded app URL so API calls include it.
persistShopFromQuery();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)