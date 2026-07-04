<div align="center">

# 🌐 Shopify Multilingual Translator

**AI-powered translation app for Shopify stores — translate your storefront into any language in real time.**

[![Backend](https://img.shields.io/badge/Backend-Flask%20%2B%20Python-blue?style=flat-square&logo=python)](https://flask.palletsprojects.com/)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Deployed on](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat-square&logo=render)](https://render.com/)
[![Deployed on](https://img.shields.io/badge/Frontend-Vercel-000000?style=flat-square&logo=vercel)](https://vercel.com/)
[![Shopify](https://img.shields.io/badge/Shopify-App%20Extension-95BF47?style=flat-square&logo=shopify)](https://shopify.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[Live Demo](https://shopify-multilanguage-convertor-plugin.vercel.app/) · [Backend API](https://shopify-multilanguage-convertor.onrender.com) · [Report Bug](https://github.com/swastik3616/shopify-multilanguage-convertor/issues)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#1-backend-setup)
  - [Frontend Setup](#2-frontend-setup-admin-dashboard)
  - [Shopify Extension Setup](#3-shopify-extension-setup)
- [Configuration](#️-configuration-after-installation)
- [How It Works](#-how-it-works)
- [API Reference](#-api-reference)
- [Supported AI Providers](#-supported-ai-providers)
- [Database Schema](#️-database-schema)
- [Deployment](#-deployment)
- [Environment Variables](#-environment-variables)
- [License](#-license)

---

## 🎯 Overview

**Shopify Multilingual Translator** is a full-stack Shopify app that enables merchants to offer their storefront in multiple languages — powered by AI. After installing the app, merchants configure their store's source language and select which target languages to offer. A floating widget is injected into the storefront, giving customers a seamless language switcher that translates all visible page content in real time.

Translations are intelligently cached in a PostgreSQL database, so repeated requests are served instantly without additional AI API calls.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **AI-Powered Translation** | Supports OpenAI, Google Gemini, Anthropic Claude, Groq, and Ollama |
| ⚡ **Smart Caching** | Translated content is persisted in PostgreSQL — zero AI calls for repeated text |
| 🌍 **Floating Language Switcher** | A beautiful, accessible widget injected into every storefront page |
| 🔒 **Merchant-Controlled Languages** | Only languages the merchant enables appear on the storefront |
| 📦 **Bulk Translation** | All visible page text nodes translated in a single batched API call |
| 🔍 **SEO Translation** | Translate product/page meta titles and descriptions via Shopify GraphQL |
| 🔄 **Live Restore** | Switching back to the source language reloads the original store content |
| 📊 **Admin Dashboard** | Real-time stats — active languages, translation count, provider status |
| 📝 **Audit Logs** | Full activity history for all configuration changes and translation events |
| 🖥️ **Side-by-Side Translation UI** | Fetch any URL and preview original vs translated content in a simplified grid table with source text, translations, and actions |
| 🏪 **Shopify OAuth** | Standard OAuth 2.0 installation flow with per-store access token management |

---

## 🆕 Recent Updates

- **Structural Translation Workspace:** The Side-by-Side Translation UI now perfectly maps out your webpage structure. Instead of flat text, it visually separates elements into tagged blocks (`[H1]`, `[P]`, `[BUTTON]`, `[IMG]`) grouped by semantic HTML sections (like `<header>` or `<main>`), preserving your exact website layout.
- **Simplified Translation Grid:** The grid table now focuses on source text, translated text, and actions only, with the separate tag and section columns removed for a cleaner review experience.
- **Masonry Grid Layout:** The Translation Workspace has been upgraded to a responsive, masonry-style grid layout, making it much easier to view and translate multiple sections simultaneously on large monitors.
- **Storefront Auto-Translate Fix:** Fixed a critical bug in the storefront `language_switcher_embed.liquid` extension that forcefully translated the store to a target language on every page load. The store now respects the native source language initially.
- **Live Dashboard Analytics:** The admin dashboard now displays real, dynamic database queries for translation volumes over the last 7 days and a live activity feed pulling directly from the Audit Logs, complete with PostgreSQL transaction safety fallback for legacy schemas.
- **Backend Modular Refactoring:** The monolithic `app.py` (1,600+ lines) has been split into clean, focused modules using **Flask Blueprints**. All routes are now in a dedicated `routes/` folder, and shared logic lives in a `utils/` folder — making the codebase far easier to debug and extend.

---

## 🛠 Tech Stack

### Backend
- **Python 3.9+** with **Flask** — REST API server
- **Flask-SQLAlchemy** — ORM for database access
- **PostgreSQL** — Production database (SQLite for local dev)
- **Gunicorn** — WSGI server for production
- **Deployed on Render**

### Frontend
- **React 19** with **Vite 8** — Admin dashboard (embedded Shopify app)
- **Tailwind CSS v4** — Utility-first styling
- **React Router v7** — Client-side routing
- **Recharts** — Analytics charts
- **Framer Motion** — UI animations
- **Lucide React** — Icon library
- **Deployed on Vercel**

### Shopify Extension
- **Shopify CLI** — Extension deployment tooling
- **Liquid** — Storefront widget template language
- **Vanilla JavaScript** — Widget logic (no framework dependencies)

---

## 📁 Project Structure

```
shopify-multilingual-translator/
│
├── backend/                              # Python Flask API
│   ├── app.py                            # Entry point — initializes app & registers blueprints
│   ├── database.py                       # SQLAlchemy database initialization
│   ├── model.py                          # Database models (Translation, PageContent, AuditLog, etc.)
│   ├── requirements.txt                  # Python dependencies
│   │
│   ├── routes/                           # API route blueprints (one file per feature)
│   │   ├── auth_routes.py                # /install, /auth/callback, /shopify/check-token
│   │   ├── translation_routes.py         # /translate, /bulk-translate, /translations CRUD
│   │   ├── content_routes.py             # /contents, /contents/sync, /contents/import
│   │   ├── settings_routes.py            # /save-languages, /save-provider, /save-store-settings
│   │   ├── dashboard_routes.py           # /api/dashboard, /analytics, /audit-history
│   │   └── seo_routes.py                 # /api/seo-resources, /api/seo-translate
│   │
│   └── utils/                            # Shared helper functions (not routes)
│       ├── ai_provider.py                # LLM logic — OpenAI, Gemini, Claude, Groq, Ollama
│       ├── shopify_client.py             # Shopify REST API fetching + HTML text extraction
│       └── helpers.py                    # get_setting, set_setting, get_shopify_credentials, etc.
│
├── frontend/                             # React Admin Dashboard (Vite)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx         # Overview stats & recent activity
│   │   │   ├── LanguagesPage.jsx         # Source & target language configuration
│   │   │   ├── TranslationPage.jsx       # URL fetch + side-by-side translation workspace
│   │   │   ├── TranslationsPage.jsx      # View, edit & manage translations
│   │   │   ├── ProvidersPage.jsx         # AI provider & API key management
│   │   │   ├── SeoPage.jsx               # SEO meta translation via GraphQL
│   │   │   ├── AnalyticsPage.jsx         # Usage analytics & charts
│   │   │   ├── SettingsPage.jsx          # General app settings
│   │   │   ├── StoreSettingsPage.jsx     # Shopify store connection settings
│   │   │   └── AuditHistoryPage.jsx      # Audit log viewer
│   │   ├── services/                     # API client & service functions
│   │   ├── components/                   # Reusable UI components
│   │   ├── contexts/                     # React context providers
│   │   ├── layouts/                      # Page layout wrappers
│   │   └── styles/                       # Global CSS & design tokens
│   └── package.json
│
├── language-multilingual-translato/      # Shopify App Extension (CLI)
│   └── extensions/
│       └── multilingual-language-switcher/
│           └── blocks/
│               └── language_switcher_embed.liquid  # Storefront widget
│
├── vercel.json                           # Vercel deployment configuration
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js 18+](https://nodejs.org/)
- [Python 3.9+](https://www.python.org/)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli) — `npm install -g @shopify/cli`
- A [Shopify Partner Account](https://partners.shopify.com/) with a development store
- An API key from at least one supported AI provider (OpenAI, Gemini, Claude, or Groq)

---

### 1. Backend Setup

**Clone the repository:**
```bash
git clone https://github.com/swastik3616/shopify-multilanguage-convertor.git
cd shopify-multilingual-translator/backend
```

**Create and activate a virtual environment:**
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

**Install dependencies:**
```bash
pip install -r requirements.txt
```

**Configure environment variables:**

Create a `.env` file inside `/backend`:

```env
# Shopify OAuth
SHOPIFY_CLIENT_ID=your_shopify_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_client_secret
SHOPIFY_REDIRECT_URI=https://your-backend-url.com/auth/callback
SHOPIFY_SCOPES=read_products,write_products,read_content,write_content,read_translations,write_translations

# Database
# Leave as SQLite for local development
DATABASE_URL=sqlite:///translator.db
# For production (PostgreSQL):
# DATABASE_URL=postgresql://user:password@host/dbname
```

**Start the server:**
```bash
python app.py
```

> API available at `http://localhost:5000`

---

### 2. Frontend Setup (Admin Dashboard)

```bash
cd ../frontend
npm install
```

Create a `.env` file inside `/frontend`:

```env
VITE_API_URL=http://localhost:5000
```

**Start the development server:**
```bash
npm run dev
```

> Dashboard available at `http://localhost:5173`

---

### 3. Shopify Extension Setup

```bash
cd ../language-multilingual-translato
npm install
shopify app dev
```

This will deploy the extension to your Shopify development store and provide a preview URL.

> **Note:** In the Shopify Theme Customizer, navigate to your theme's **Footer** section and add the **"Language Switcher Global"** block. This makes the widget appear on every page of your store.

---

## ⚙️ Configuration After Installation

Follow these steps after the app is installed on a Shopify store:

### Step 1 — Connect Your Store
Navigate to **Store Settings** in the admin dashboard:
- Enter your Shopify store URL (e.g., `your-store.myshopify.com`)
- Enter your **Admin API Access Token** from your Shopify Partner Dashboard

### Step 2 — Configure an AI Provider
Navigate to **Providers** and select your preferred translation engine:

| Provider | Where to Get API Key |
|---|---|
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) |
| Google Gemini | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| Anthropic Claude | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| Groq | [console.groq.com](https://console.groq.com/keys) |
| Ollama | No key required — runs locally |

### Step 3 — Set Languages
Navigate to **Languages** and configure:

1. **Source Language** — The language your store content is **currently written in**. This is always available to customers as the "original" view.
2. **Target Languages** — The languages customers can **switch to**. Only these will appear in the storefront dropdown.

> ✅ Changes take effect immediately. The storefront widget fetches your configuration on every page load.

### Step 4 — Translate Your Content
- **Translations Page** — Manually add content and trigger translations
- **Translation Page** — Fetch any webpage URL and review translations side-by-side
- **SEO Page** — Translate product and page meta titles/descriptions directly to Shopify

---

## 🔄 How It Works

```
Customer visits store
        │
        ▼
Widget loads on storefront (language_switcher_embed.liquid)
        │
        ▼
Calls GET /get-languages → fetches merchant's saved config
        │
        ▼
Renders ONLY the configured languages in the dropdown
        │
        ├── Customer selects SOURCE LANGUAGE → page.reload() (restore original)
        │
        └── Customer selects TARGET LANGUAGE
                │
                ▼
        Widget walks all text nodes on the page
                │
                ▼
        Calls POST /bulk-translate with all text + target language
                │
                ├── Cache HIT → returns from PostgreSQL instantly
                └── Cache MISS → calls AI provider → saves to DB → returns result
                        │
                        ▼
                DOM text nodes updated in place
                        │
                        ▼
                Selection saved to localStorage (persists on navigation)
```

---

## 📡 API Reference

### Language Settings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/get-languages` | Returns the configured source and target languages |
| `POST` | `/save-languages` | Save source and target language configuration |

**POST `/save-languages` payload:**
```json
{
  "source_language": "English",
  "target_languages": ["Hindi", "French", "Spanish"]
}
```

---

### Translation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/translate` | Translate a single text string |
| `POST` | `/bulk-translate` | Translate an array of text strings (cached) |
| `GET` | `/translations` | List all saved translations |
| `PUT` | `/translations/<id>` | Update a saved translation |
| `DELETE` | `/translations/<id>` | Delete a saved translation |

**POST `/bulk-translate` payload:**
```json
{
  "texts": ["Hello", "Welcome to our store", "Add to cart"],
  "target_language": "Hindi"
}
```

**Response:**
```json
{
  "translations": ["नमस्ते", "हमारी दुकान में आपका स्वागत है", "कार्ट में जोड़ें"],
  "cache_hits": 2,
  "api_calls": 1
}
```

---

### Content Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/contents` | List all page content items |
| `POST` | `/contents` | Create a new content item |
| `POST` | `/contents/sync` | Sync content from Shopify (home/product/collection) |
| `PUT` | `/contents/<id>` | Update a content item |
| `DELETE` | `/contents/<id>` | Delete a content item |

---

### AI Provider

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/get-provider` | Get current provider settings |
| `POST` | `/save-provider` | Save provider and API key |

---

### SEO (Shopify GraphQL)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/seo-resources` | Fetch translatable products/pages from Shopify |
| `POST` | `/api/seo-translate` | Register translated SEO meta to Shopify |
| `POST` | `/api/seo-update-original` | Update original SEO fields in Shopify |

---

### Store & Utility

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/wake` | Pre-warm server on cold start (used by widget) |
| `GET` | `/api/dashboard` | Aggregate stats for admin dashboard |
| `GET` | `/audit-history` | Full audit activity log |
| `GET` | `/shopify/check-token` | Verify Shopify store connection |
| `POST` | `/save-store-settings` | Save store URL and access token |
| `GET` | `/install` | Initiate Shopify OAuth install flow |
| `GET` | `/auth/callback` | OAuth callback — stores access token |

---

## 🤖 Supported AI Providers

| Provider | Recommended Models | Notes |
|---|---|---|
| **OpenAI** | `gpt-4o`, `gpt-4`, `gpt-3.5-turbo` | Best quality; paid API |
| **Google Gemini** | `gemini-2.0-flash`, `gemini-1.5-pro` | Fast & cost-effective |
| **Anthropic Claude** | `claude-3-haiku-20240307`, `claude-3-sonnet` | Excellent for nuanced text |
| **Groq** | `llama3-8b-8192`, `mixtral-8x7b-32768` | Very fast inference |
| **Ollama** | Any local model (`llama3`, `mistral`) | Free; no internet required |

---

## 🗄️ Database Schema

| Table | Purpose |
|---|---|
| `translations` | Cached `source_text → translated_text` mappings per language |
| `page_contents` | Store content items organized by `page` and `key` |
| `app_settings` | Key-value store for app configuration (languages, provider, store URL) |
| `shopify_stores` | OAuth-connected store domains and their access tokens |
| `audit_logs` | Action history for all major events |

---

## 🚢 Deployment

### Backend — Render

1. Create a new **Web Service** on [Render](https://render.com/).
2. Connect your GitHub repository.
3. Set the **root directory** to `backend`.
4. Set **build command**: `pip install -r requirements.txt`
5. Set **start command**: `gunicorn app:app`
6. Add all environment variables from the table below.
7. Provision a **PostgreSQL** database on Render and set `DATABASE_URL`.

### Frontend — Vercel

1. Import your repository on [Vercel](https://vercel.com/).
2. Set **root directory** to `frontend`.
3. Add `VITE_API_URL` pointing to your Render backend URL.
4. The included `vercel.json` configures the required `frame-ancestors` CSP header for Shopify embedding.

### Shopify Extension

```bash
cd language-multilingual-translato
shopify app deploy
```

This pushes the language switcher widget to your Shopify app in production.

---

## 🔐 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SHOPIFY_CLIENT_ID` | ✅ | Your Shopify app's client ID |
| `SHOPIFY_CLIENT_SECRET` | ✅ | Your Shopify app's client secret |
| `SHOPIFY_REDIRECT_URI` | ✅ | OAuth callback URL (e.g., `https://your-backend.com/auth/callback`) |
| `SHOPIFY_SCOPES` | ✅ | Comma-separated Shopify permission scopes |
| `DATABASE_URL` | ✅ | PostgreSQL or SQLite connection string |

> ⚠️ **Never commit your `.env` file to version control.** It is listed in `.gitignore`.

---

## 🌍 Supported Languages

English · French · German · Spanish · Hindi · Arabic · Japanese · Portuguese · Marathi · Italian · Chinese · Korean

> Additional languages can be added by extending the `ALL_LANGUAGES` array in both `LanguagesPage.jsx` and `language_switcher_embed.liquid`.

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — free to use, modify, and distribute.

---

<div align="center">

Built with ❤️ for the Shopify ecosystem

**[⬆ Back to Top](#-shopify-multilingual-translator)**

</div>
