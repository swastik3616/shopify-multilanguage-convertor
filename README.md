# 🌐 Shopify Multilingual Translator

A full-stack Shopify app that enables merchants to translate their storefront into multiple languages using AI providers (OpenAI, Gemini, Claude, Groq, Ollama). Customers get a floating language switcher widget on the store that translates content in real-time.

---

## ✨ Features

- **AI-Powered Translation** — Supports OpenAI, Google Gemini, Anthropic Claude, Groq, and Ollama
- **Smart Caching** — Translations are cached in the database so repeated requests are instant
- **Floating Language Switcher** — A beautiful widget injected into the Shopify storefront
- **Merchant-Controlled Languages** — Only the languages the merchant selects appear on the storefront
- **Bulk Translation** — Translates all visible page text in one API call
- **SEO Translation** — Translates product/page meta titles and descriptions via Shopify GraphQL
- **Audit Logs** — Tracks all major actions (language changes, translations, store updates)
- **Side-by-side Translation UI** — Fetch any URL and view original vs translated content
- **Multiple AI Providers** — Switch between providers at any time from the admin dashboard

---

## 🏗️ Project Structure

```
shopify-multilingual-translator/
├── backend/                        # Flask Python API
│   ├── app.py                      # All API routes and business logic
│   ├── model.py                    # SQLAlchemy database models
│   ├── database.py                 # DB initialization
│   ├── requirements.txt            # Python dependencies
│   └── .env                        # Environment variables (not committed)
│
├── frontend/                       # React Admin Dashboard (Vite)
│   └── src/
│       ├── pages/
│       │   ├── DashboardPage.jsx   # Overview stats & activity
│       │   ├── LanguagesPage.jsx   # Source & target language config
│       │   ├── TranslationPage.jsx # URL fetch + side-by-side translation
│       │   ├── TranslationsPage.jsx# View/edit all saved translations
│       │   ├── ProvidersPage.jsx   # AI provider & API key setup
│       │   ├── SeoPage.jsx         # SEO meta translation (GraphQL)
│       │   ├── AnalyticsPage.jsx   # Usage analytics
│       │   ├── SettingsPage.jsx    # App settings
│       │   └── StoreSettingsPage.jsx # Shopify store connection
│       ├── services/               # API client functions
│       └── contexts/               # React context providers
│
└── language-multilingual-translato/ # Shopify App Extension (CLI)
    └── extensions/
        └── multilingual-language-switcher/
            └── blocks/
                └── language_switcher_embed.liquid  # Customer-facing widget
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- A Shopify Partner account + development store
- Shopify CLI (`npm install -g @shopify/cli`)

---

### 1. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in `/backend`:

```env
DATABASE_URL=sqlite:///translator.db
SHOPIFY_CLIENT_ID=your_shopify_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_client_secret
SHOPIFY_REDIRECT_URI=https://your-backend-url.com/auth/callback
SHOPIFY_SCOPES=read_products,write_products,read_translations,write_translations
```

Start the backend:

```bash
python app.py
```

The API will run at `http://localhost:5000`.

---

### 2. Frontend Setup (Admin Dashboard)

```bash
cd frontend
npm install
npm run dev
```

The admin dashboard will run at `http://localhost:5173`.

Set your backend URL in a `.env` file inside `/frontend`:

```env
VITE_API_URL=http://localhost:5000
```

---

### 3. Shopify Extension Setup (Language Switcher Widget)

```bash
cd frontend/language-multilingual-translato
npm install
shopify app dev
```

This will open your development store with the extension deployed.

> **Tip:** In your Shopify Theme Customizer, add the **Language Switcher Global** block to your Footer section so it appears on every page.

---

## ⚙️ Configuration After Installation

### Step 1 — Connect Your Store
Go to **Store Settings** in the admin dashboard and enter:
- Your Shopify store URL (e.g., `your-store.myshopify.com`)
- Your Admin API Access Token

### Step 2 — Configure an AI Provider
Go to **Providers** and select your preferred AI provider, then enter the API key:
- OpenAI → `sk-...`
- Google Gemini → AI Studio API key
- Anthropic Claude → `sk-ant-...`
- Groq → `gsk_...`
- Ollama → No key needed (runs locally)

### Step 3 — Set Languages
Go to **Languages** and:
1. Select your **Source Language** — the language your store is currently written in
2. Check the **Target Languages** — only these will appear in the storefront dropdown

> ⚠️ **Important:** The storefront widget only shows the languages you select here. Customers will not see any other languages.

### Step 4 — Translate Content
- Use the **Translations** page to manually add and translate content
- Use the **Translation** page to fetch any URL and translate it side-by-side
- Use the **SEO** page to translate product/page meta titles and descriptions

---

## 🔌 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/get-languages` | GET | Returns saved source + target languages |
| `/save-languages` | POST | Save source and target language settings |
| `/get-provider` | GET | Returns current AI provider settings |
| `/save-provider` | POST | Save AI provider and API key |
| `/translate` | POST | Translate a single text string |
| `/bulk-translate` | POST | Translate an array of text strings (cached) |
| `/translations` | GET | List all saved translations |
| `/contents` | GET | List page content items |
| `/contents/sync` | POST | Sync content from Shopify (home/product/collection) |
| `/api/seo-resources` | GET | Fetch Shopify products/pages for SEO translation |
| `/api/seo-translate` | POST | Register a translation in Shopify via GraphQL |
| `/save-store-settings` | POST | Save Shopify store URL and access token |
| `/wake` | GET | Pre-warm the server (used by widget on cold start) |
| `/api/dashboard` | GET | Aggregate stats for the admin dashboard |

---

## 🌍 How the Language Switcher Works

1. The floating widget loads on every storefront page.
2. It calls `GET /get-languages` to fetch the merchant's configured languages.
3. Only the saved target languages (+ source language) are shown in the dropdown.
4. When a customer selects a language, the widget calls `POST /bulk-translate` with all visible text nodes.
5. The translated text replaces the original content in the DOM instantly.
6. The selection is saved to `localStorage` so it persists across page navigations.
7. Selecting the **source language** reloads the page to restore original content.

---

## 🗄️ Database Models

| Table | Description |
|---|---|
| `translations` | Cached source_text → translated_text per language |
| `page_contents` | Store content items (page + key + source text) |
| `app_settings` | Key-value store for app config (languages, provider, store) |
| `shopify_stores` | OAuth-connected store domains + access tokens |
| `audit_logs` | Action log for all major operations |

---

## 🚢 Deployment

### Backend (Render / Railway / Fly.io)

1. Set environment variables from your `.env` file on the hosting platform.
2. Set the start command to: `gunicorn app:app`
3. Add `gunicorn` to `requirements.txt`.
4. Update `VITE_API_URL` in the frontend build to point to your deployed backend URL.
5. Update the `BACKEND` constant in `language_switcher_embed.liquid` to your deployed backend URL.

### Frontend (Vercel / Netlify)

```bash
cd frontend
npm run build
```

Deploy the `dist/` folder to Vercel or Netlify.

### Shopify Extension

```bash
cd frontend/language-multilingual-translato
shopify app deploy
```

---

## 🧠 Supported AI Providers & Models

| Provider | Models |
|---|---|
| OpenAI | `gpt-3.5-turbo`, `gpt-4`, `gpt-4o` |
| Google Gemini | `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash` |
| Anthropic Claude | `claude-3-haiku-20240307`, `claude-3-sonnet-20240229` |
| Groq | `llama3-8b-8192`, `mixtral-8x7b-32768`, `gemma2-9b-it` |
| Ollama | Any locally running model (e.g., `llama3`, `mistral`) |

---

## 🛡️ Security Notes

- Access tokens are stored in the database and never exposed to the frontend.
- The `/get-languages` endpoint is public (needed by the storefront widget).
- All other sensitive routes should be protected via Shopify session tokens in a production deployment.

---

## 📝 License

MIT License — free to use, modify, and distribute.
