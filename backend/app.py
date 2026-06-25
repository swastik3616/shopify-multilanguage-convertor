from dotenv import load_dotenv
load_dotenv()
from flask import Flask, jsonify, make_response, request, redirect
from flask_cors import CORS
from flask import after_this_request
import os
import requests
import json
import re
from sqlalchemy import func
from database import db
from model import Translation, PageContent, AuditLog, ShopifyStore, AppSetting
from datetime import datetime

app = Flask(__name__)

# Allow all origins — required so Shopify storefronts (any *.myshopify.com domain)
# can call the backend directly from theme scripts.
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    allow_headers=["Content-Type", "X-Shopify-Shop-Domain", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    supports_credentials=False,
)

db_url = os.getenv("DATABASE_URL", "sqlite:///translator.db")

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    db.create_all()

def get_setting(key, default_value):
    setting = AppSetting.query.filter_by(key=key).first()
    if setting:
        return json.loads(setting.value)
    return default_value

def set_setting(key, value):
    setting = AppSetting.query.filter_by(key=key).first()
    if not setting:
        setting = AppSetting(key=key, value=json.dumps(value))
        db.session.add(setting)
    else:
        setting.value = json.dumps(value)
    db.session.commit()


def normalize_shopify_store_url(store_url):
    """Strip scheme and trailing slashes — store URL must be hostname only."""
    if not store_url:
        return ""
    store_url = store_url.strip()
    store_url = re.sub(r"^https?://", "", store_url, flags=re.I)
    return store_url.strip("/")

def get_shop_from_request():
    """Extract shop domain from request headers, query or JSON body."""
    shop = None
    try:
        shop = request.headers.get("X-Shopify-Shop-Domain")
    except Exception:
        shop = None

    if not shop:
        shop = request.args.get("shop")

    if not shop:
        try:
            data = request.get_json(silent=True) or {}
            shop = data.get("shop")
        except Exception:
            shop = None

    return normalize_shopify_store_url(shop) if shop else None


def get_current_store(shop=None):
    """Return ShopifyStore model for provided shop domain (normalized) or from request."""
    if not shop:
        shop = get_shop_from_request()
    if not shop:
        return None
    shop = normalize_shopify_store_url(shop)
    return ShopifyStore.query.filter_by(shop=shop).first()


def get_shopify_credentials(shop=None):
    def _clean_token(t):
        if not t:
            return ""

        t = t.strip()

        if t.startswith('"') and t.endswith('"'):
            t = t[1:-1]

        if t.lower().startswith("bearer "):
            t = t.split(None, 1)[1]

        if t.lower().startswith("basic "):
            t = t.split(None, 1)[1]

        return t.strip()

    store = get_current_store(shop)
    if store:
        return normalize_shopify_store_url(store.shop), _clean_token(store.access_token)

    # Fallback: legacy manual store settings
    store_setting = get_setting("store_setting", {})
    store_url = normalize_shopify_store_url(store_setting.get("store_url", ""))
    access_token = _clean_token(store_setting.get("access_token", ""))
    return store_url, access_token

def get_default_provider_settings():
    return {
        "provider": "openai",
        "model": "gpt-3.5-turbo",
        "api_keys": {
            "openai": "",
            "gemini": "",
            "claude": "",
            "groq": "",
            "ollama": ""
        }
    }


def fetch_shopify_pages():
    """Fetch pages from Shopify store."""
    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return []
    
    try:
        headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json"
        }
        url = f"https://{store_url}/admin/api/2026-04/pages.json"
        res = requests.get(url, headers=headers, timeout=10)
        if not res.ok:
            print(f"Shopify pages request failed: {res.status_code} {res.text}")
            res.raise_for_status()
        return res.json().get("pages", [])
    except Exception as e:
        print(f"Error fetching Shopify pages: {str(e)}")
        if 'res' in locals():
            try:
                print("Response status:", res.status_code)
                print("Response body:", res.text)
            except Exception:
                pass
        return []


def fetch_shopify_products(limit=5):
    """Fetch products from Shopify store."""
    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return []
    
    try:
        headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json"
        }
        url = f"https://{store_url}/admin/api/2026-04/products.json?limit={limit}&fields=id,title,body_html,handle"
        res = requests.get(url, headers=headers, timeout=10)
        if not res.ok:
            print(f"Shopify products request failed: {res.status_code} {res.text}")
            res.raise_for_status()
        return res.json().get("products", [])
    except Exception as e:
        print(f"Error fetching Shopify products: {str(e)}")
        if 'res' in locals():
            try:
                print("Response status:", res.status_code)
                print("Response body:", res.text)
            except Exception:
                pass
        return []


def fetch_shopify_collections(limit=5):
    """Fetch collections from Shopify store."""
    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return []
    
    try:
        headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json"
        }
        url = f"https://{store_url}/admin/api/2026-04/custom_collections.json?limit={limit}&fields=id,title,body_html,handle"
        res = requests.get(url, headers=headers, timeout=10)
        if not res.ok:
            print(f"Shopify collections request failed: {res.status_code} {res.text}")
            res.raise_for_status()
        return res.json().get("custom_collections", [])
    except Exception as e:
        print(f"Error fetching Shopify collections: {str(e)}")
        if 'res' in locals():
            try:
                print("Response status:", res.status_code)
                print("Response body:", res.text)
            except Exception:
                pass
        return []


def _mask_token(token):
    if not token:
        return None
    if len(token) <= 8:
        return "****"
    return f"{token[:4]}...{token[-4:]}"


@app.route("/shopify/check-token", methods=["GET"])
def shopify_check_token():
    """Diagnostic endpoint: checks current resolved Shopify store_url and access token by calling /shop.json."""
    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return jsonify({"connected": False, "message": "No Shopify store or access token configured."}), 400

    try:
        headers = {"X-Shopify-Access-Token": access_token}
        res = requests.get(f"https://{store_url}/admin/api/2026-04/shop.json", headers=headers, timeout=10)
        body = None
        try:
            body = res.json()
        except Exception:
            body = res.text[:200]

        return jsonify({
            "connected": res.ok,
            "status_code": res.status_code,
            "response": body,
            "store_url": store_url,
            "masked_token": _mask_token(access_token)
        }), (200 if res.ok else 401)
    except Exception as e:
        print("Shopify check-token error:", str(e))
        return jsonify({"connected": False, "message": str(e)}), 500


def extract_text_from_html(html_text):
    """Extract plain text from HTML content."""
    if not html_text:
        return ""

    # Remove script and style blocks entirely.
    html_text = re.sub(r'<script[^>]*>.*?</script>', '', html_text, flags=re.S | re.I)
    html_text = re.sub(r'<style[^>]*>.*?</style>', '', html_text, flags=re.S | re.I)
    html_text = re.sub(r'<!--.*?-->', '', html_text, flags=re.S)

    # Remove any remaining HTML tags.
    text = re.sub(r'<[^>]+>', '', html_text)

    # Decode common HTML entities and normalize whitespace.
    text = text.replace("&nbsp;", " ")
    text = text.replace("&amp;", "&")
    text = text.replace("&lt;", "<")
    text = text.replace("&gt;", ">")
    text = re.sub(r'\s+', ' ', text)

    return text.strip()[:1200]


def seed_shopify_page_contents(page):
    """Fetch and seed page contents from Shopify store."""
    imported = 0
    
    try:
        if page == "home":
            pages = fetch_shopify_pages()
            for shopify_page in pages:
                title = shopify_page.get("title", "")
                body = extract_text_from_html(shopify_page.get("body_html", ""))
                
                if title and not PageContent.query.filter_by(page="home", key=title).first():
                    db.session.add(PageContent(page="home", key=title, source_text=body or title))
                    imported += 1
            
            # Also fetch first few products as featured content
            products = fetch_shopify_products(3)
            for idx, product in enumerate(products):
                title = product.get("title", f"Product {idx+1}")
                body = extract_text_from_html(product.get("body_html", ""))
                key = f"featured_product_{idx+1}_title"
                
                if not PageContent.query.filter_by(page="home", key=key).first():
                    db.session.add(PageContent(page="home", key=key, source_text=title))
                    imported += 1
                    
                key = f"featured_product_{idx+1}_desc"
                if body and not PageContent.query.filter_by(page="home", key=key).first():
                    db.session.add(PageContent(page="home", key=key, source_text=body))
                    imported += 1
                    
        elif page == "product":
            products = fetch_shopify_products(10)
            for idx, product in enumerate(products):
                title = product.get("title", "")
                body = extract_text_from_html(product.get("body_html", ""))
                key = f"product_{product.get('id', idx)}_title"
                
                if title and not PageContent.query.filter_by(page="product", key=key).first():
                    db.session.add(PageContent(page="product", key=key, source_text=title))
                    imported += 1
                    
                if body:
                    key = f"product_{product.get('id', idx)}_desc"
                    if not PageContent.query.filter_by(page="product", key=key).first():
                        db.session.add(PageContent(page="product", key=key, source_text=body))
                        imported += 1
                        
        elif page == "collection":
            collections = fetch_shopify_collections(10)
            for idx, collection in enumerate(collections):
                title = collection.get("title", "")
                body = extract_text_from_html(collection.get("body_html", ""))
                key = f"collection_{collection.get('id', idx)}_title"
                
                if title and not PageContent.query.filter_by(page="collection", key=key).first():
                    db.session.add(PageContent(page="collection", key=key, source_text=title))
                    imported += 1
                    
                if body:
                    key = f"collection_{collection.get('id', idx)}_desc"
                    if not PageContent.query.filter_by(page="collection", key=key).first():
                        db.session.add(PageContent(page="collection", key=key, source_text=body))
                        imported += 1
        
        if imported:
            db.session.commit()
            print(f"Seeded {imported} {page} content item(s) from Shopify store")
            
    except Exception as e:
        print(f"Error seeding {page} content from Shopify: {str(e)}")

    return imported



@app.route("/api/dashboard", methods=["GET", "OPTIONS"])
def get_dashboard_stats():
    if request.method == 'OPTIONS':
        return '', 204
    
    # Languages count
    lang_settings = get_setting("language_settings", {})
    targets = lang_settings.get("targets", [])
    active_languages = len(targets)
    if lang_settings.get("source"):
        active_languages += 1
        
    # Providers count
    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    api_keys = provider_settings.get("api_keys", {})
    active_providers = sum(1 for key, val in api_keys.items() if val)
    
    # Translations count
    translation_count = Translation.query.count()
    
    # Installation time
    first_log = AuditLog.query.order_by(AuditLog.created_at.asc()).first()
    if first_log and first_log.created_at:
        install_time = first_log.created_at.strftime("%Y-%m-%d %H:%M")
    else:
        install_time = "N/A"
        
    return jsonify({
        "overview": {
            "activeLanguages": active_languages,
            "providers": active_providers,
            "translationRequests": translation_count,
            "installationTime": install_time
        },
        "analytics": {
             "volumeByDay": [0,0,0,0,0,0,translation_count]
        },
        "recentActivity": []
    })


@app.route("/")
def home():
    return jsonify({
        "message": "Shopify Translator Backend Running"
    })

@app.route("/wake", methods=["GET", "OPTIONS"])
def wake():
    """Lightweight endpoint used by the storefront language switcher to pre-warm
    the Render instance before the first bulk-translate call.
    Render free tier can take 30-60 seconds on cold start; hitting /wake first
    lets the user see an immediate spinner rather than a silent freeze."""
    return jsonify({"status": "awake"})

@app.route("/save-languages", methods=["POST", "OPTIONS"])
def save_languages():
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    language_settings = get_setting("language_settings", {})

    language_settings["source"] = data["source_language"]
    language_settings["targets"] = data["target_languages"]
    
    set_setting("language_settings", language_settings)

    audit = AuditLog(action="Language Settings Updated")
    db.session.add(audit)
    db.session.commit()

    return jsonify({"success": True, "message": "Languages saved successfully"})

@app.route("/get-languages", methods=["GET"])
def get_languages():
    return jsonify(get_setting("language_settings", {}))

@app.route("/get-provider", methods=["GET"])
def get_provider():
    return jsonify(get_setting("provider_settings", get_default_provider_settings()))

@app.route("/save-provider", methods=["POST", "OPTIONS"])
def save_provider():
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    provider = data.get("provider", "openai")
    model = data.get("model", "gpt-3.5-turbo")
    api_key = data.get("api_key", "")
  
    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    provider_settings["provider"] = provider
    provider_settings["model"] = model
    provider_settings["api_keys"][provider] = api_key

    set_setting("provider_settings", provider_settings)

    audit = AuditLog(action=f"Provider Updated: {provider}")
    db.session.add(audit)
    db.session.commit()

    return jsonify({"success": True, "message": "Provider saved successfully"})

def get_provider_response(provider, model, api_key, source_text, target_language):
    prompt = f"Translate the following text to {target_language}. Only return the translated text without any quotes or explanations.\n\nText: {source_text}"
    try:
        if provider == "openai":
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3}
            res = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            if not res.ok:
                raise Exception(f"OpenAI Error {res.status_code}: {res.text}")
            res.raise_for_status()
            return res.json()["choices"][0]["message"]["content"].strip()
            
        elif provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {"contents": [{"parts":[{"text": prompt}]}]}
            res = requests.post(url, headers=headers, json=payload)
            if not res.ok:
                raise Exception(f"Gemini Error {res.status_code}: {res.text}")
            res.raise_for_status()
            return res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            
        elif provider == "claude":
            headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
            payload = {"model": model, "max_tokens": 1024, "messages": [{"role": "user", "content": prompt}]}
            res = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            if not res.ok:
                raise Exception(f"Claude Error {res.status_code}: {res.text}")
            res.raise_for_status()
            return res.json()["content"][0]["text"].strip()
            
        elif provider == "groq":
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3}
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            if not res.ok:
                raise Exception(f"Groq Error {res.status_code}: {res.text}")
            res.raise_for_status()
            return res.json()["choices"][0]["message"]["content"].strip()
            
        elif provider == "ollama":
            url = "http://localhost:11434/api/generate"
            payload = {"model": model, "prompt": prompt, "stream": False}
            res = requests.post(url, json=payload)
            if not res.ok:
                raise Exception(f"Ollama Error {res.status_code}: {res.text}")
            res.raise_for_status()
            return res.json()["response"].strip()
            
        else:
            return f"{source_text} translated to {target_language} (Mock - Unknown Provider)"
            
    except Exception as e:
        print(f"Provider Error ({provider}):", str(e))
        raise Exception(f"Failed to translate using {provider}: {str(e)}")

def extract_json_object(text):
    start = None
    depth = 0
    for i, ch in enumerate(text):
        if ch == '{':
            if start is None:
                start = i
            depth += 1
        elif ch == '}' and depth > 0:
            depth -= 1
            if depth == 0 and start is not None:
                return text[start:i + 1]
    return text


def clean_bulk_response_text(response_text):
    text = re.sub(r'^```json\s*', '', response_text, flags=re.IGNORECASE)
    text = re.sub(r'^```\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()
    text = extract_json_object(text)
    text = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', text)
    text = re.sub(r'\\u(?![0-9A-Fa-f]{4})', r'\\\\u', text)
    return text


def parse_bulk_json_response(response_text):
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        cleaned_text = clean_bulk_response_text(response_text)
        return json.loads(cleaned_text)


def get_bulk_provider_response(provider, model, api_key, source_texts_dict, target_language):
    prompt = (
        f"You are a professional translator. Translate the following JSON object's values to {target_language}. "
        "Return ONLY a valid JSON object with the exact same keys and the translated values. "
        "Do not include any markdown formatting, explanations, or backticks.\n\n"
        f"Input: {json.dumps(source_texts_dict)}"
    )
    
    def try_single_fallbacks():
        fallback = {}
        for key, text in source_texts_dict.items():
            fallback[key] = get_provider_response(provider, model, api_key, text, target_language)
        return fallback

    try:
        response_text = ""
        if provider == "openai":
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3}
            res = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            res.raise_for_status()
            response_text = res.json()["choices"][0]["message"]["content"].strip()
            
        elif provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {"contents": [{"parts":[{"text": prompt}]}]}
            res = requests.post(url, headers=headers, json=payload)
            res.raise_for_status()
            response_text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            
        elif provider == "claude":
            headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
            payload = {"model": model, "max_tokens": 4096, "messages": [{"role": "user", "content": prompt}]}
            res = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            res.raise_for_status()
            response_text = res.json()["content"][0]["text"].strip()
            
        elif provider == "groq":
            import time as _time
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3}
            # Retry up to 3 times with exponential back-off on 429 rate-limit responses
            _last_res = None
            for _attempt in range(3):
                res = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers, json=payload
                )
                if res.status_code == 429:
                    _wait = 2 ** _attempt  # 1 s, 2 s, 4 s
                    print(f"[Groq] 429 rate-limit — retrying in {_wait}s (attempt {_attempt + 1}/3)")
                    _time.sleep(_wait)
                    _last_res = res
                    continue
                res.raise_for_status()
                response_text = res.json()["choices"][0]["message"]["content"].strip()
                break
            else:
                _body = _last_res.text if _last_res else "unknown"
                raise Exception(f"Groq rate limit exceeded after 3 retries: {_body}")
            
        elif provider == "ollama":
            url = "http://localhost:11434/api/generate"
            payload = {"model": model, "prompt": prompt, "stream": False}
            res = requests.post(url, json=payload)
            res.raise_for_status()
            response_text = res.json()["response"].strip()
            
        else:
            return {k: f"{v} (Mock)" for k, v in source_texts_dict.items()}

        response_text = clean_bulk_response_text(response_text)
        try:
            return parse_bulk_json_response(response_text)
        except Exception as json_error:
            print(f"Bulk JSON parse failed, attempting single-item fallback: {json_error}")
            return try_single_fallbacks()
            
    except Exception as e:
        print(f"Bulk Provider Error ({provider}):", str(e))
        raise Exception(f"Failed to bulk translate using {provider}: {str(e)}")

@app.route("/bulk-translate", methods=["POST", "OPTIONS"])
def bulk_translate():
    if request.method == 'OPTIONS':
        return '', 204

    data = request.json
    texts = data.get("texts", [])
    target_language = data.get("target_language", "")

    if not texts or not target_language:
        return jsonify({"success": False, "message": "Missing texts or language"}), 400

    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    provider = provider_settings.get("provider", "openai")
    model = provider_settings.get("model", "gpt-3.5-turbo")
    api_key = provider_settings["api_keys"].get(provider, "")

    # ── Step 1: Translation Cache Lookup ──────────────────────────────────
    # Check the DB for each text before calling the AI provider.
    # Only texts that have never been translated are sent to the AI.
    cached_map = {}        # original_index → translated_text  (cache hits)
    uncached_indices = []  # original positions that need a fresh AI call

    # Optimize: Fetch all existing translations in batched queries instead of 1-by-1
    db_cache = {}
    chunk_size = 500
    
    # We use a set to avoid querying duplicate texts multiple times in the IN clause
    unique_texts = list(set(texts))
    
    for i in range(0, len(unique_texts), chunk_size):
        chunk = unique_texts[i:i + chunk_size]
        existing = Translation.query.filter(
            Translation.target_language == target_language,
            Translation.source_text.in_(chunk)
        ).all()
        for t in existing:
            db_cache[t.source_text] = t.translated_text

    for i, text in enumerate(texts):
        if text in db_cache:
            cached_map[i] = db_cache[text]
        else:
            uncached_indices.append(i)

    cache_hits = len(texts) - len(uncached_indices)
    print(f"[bulk-translate] cache={cache_hits}/{len(texts)} hits | "
          f"need_ai={len(uncached_indices)} | lang='{target_language}'")

    # ── Step 2: Call AI only for uncached texts ───────────────────────────
    if uncached_indices:
        # Build a compact dict (sequential keys) for the AI call
        uncached_dict = {
            str(j): texts[orig_idx]
            for j, orig_idx in enumerate(uncached_indices)
        }

        try:
            translated_dict = get_bulk_provider_response(
                provider, model, api_key, uncached_dict, target_language
            )
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 500

        # Map AI results back to original positions and persist to DB
        for j, orig_idx in enumerate(uncached_indices):
            source = texts[orig_idx]
            translated = translated_dict.get(str(j), source)  # fallback to source
            cached_map[orig_idx] = translated

            db.session.add(Translation(
                source_text=source,
                target_language=target_language,
                translated_text=translated
            ))

        db.session.commit()

    # ── Step 3: Rebuild final ordered list ───────────────────────────────
    translated_texts = [cached_map.get(i, texts[i]) for i in range(len(texts))]

    return jsonify({
        "translations": translated_texts,
        "cache_hits": cache_hits,
        "api_calls": len(uncached_indices)
    })

@app.route("/translate", methods=["POST", "OPTIONS"])
def translate_text():
    if request.method == 'OPTIONS':
        return '', 204
        
    data = request.json
    source_text = data.get("source_text", "")
    target_language = data.get("target_language", "")
    
    if not source_text or not target_language:
        return jsonify({"success": False, "message": "Missing text or language"}), 400

    # 1. Check if translation exists in the database
    existing = Translation.query.filter_by(
        source_text=source_text,
        target_language=target_language
    ).first()

    if existing:
        return jsonify({"translated_text": existing.translated_text})

    # 2. If not in DB, use AI provider to translate
    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    provider = provider_settings.get("provider", "openai")
    model = provider_settings.get("model", "gpt-3.5-turbo")
    api_key = provider_settings["api_keys"].get(provider, "")

    try:
        translated_text = get_provider_response(provider, model, api_key, source_text, target_language)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    translation = Translation(
        source_text=source_text,
        target_language=target_language,
        translated_text=translated_text
    )

    db.session.add(translation)
    db.session.commit()

    return jsonify({"translated_text": translated_text})

@app.route("/fetch-url", methods=["POST", "OPTIONS"])
@app.route("/api/fetch-url", methods=["POST", "OPTIONS"])
def fetch_url_content():
    if request.method == 'OPTIONS':
        return '', 204

    data = request.json
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"success": False, "message": "URL is required"}), 400

    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; ShopifyTranslatorBot/1.0; +content-fetch)"
        }
        resp = requests.get(url, headers=headers, timeout=12)
        resp.raise_for_status()
        html = resp.text
        MAX_HTML_LENGTH = 500_000  
        if len(html) > MAX_HTML_LENGTH:
            html = html[:MAX_HTML_LENGTH]

        return jsonify({"success": True, "html": html})
    except Exception as e:
        return jsonify({"success": False, "message": f"Unable to fetch content: {str(e)}"}), 500

@app.route("/translations", methods=["GET"])
def get_translations():
    records = Translation.query.all()
    return jsonify([{
        "id": item.id,
        "source_text": item.source_text,
        "target_language": item.target_language,
        "translated_text": item.translated_text
    } for item in records])

@app.route("/translations/<int:translation_id>", methods=["PUT", "OPTIONS"])
def update_translation(translation_id):
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    translation = Translation.query.get(translation_id)
    
    if not translation:
        return jsonify({"success": False, "message": "Translation not found"}), 404
    
    translation.translated_text = data.get("translated_text", translation.translated_text)
    db.session.commit()
    
    audit = AuditLog(action=f"Translation Updated: {translation_id}")
    db.session.add(audit)
    db.session.commit()
    
    return jsonify({"success": True, "message": "Translation updated", "id": translation.id})

@app.route("/translations/<int:translation_id>", methods=["DELETE", "OPTIONS"])
def delete_translation(translation_id):
    if request.method == 'OPTIONS':
        return '', 204
    
    translation = Translation.query.get(translation_id)
    
    if not translation:
        return jsonify({"success": False, "message": "Translation not found"}), 404
    
    db.session.delete(translation)
    db.session.commit()
    
    audit = AuditLog(action=f"Translation Deleted: {translation_id}")
    db.session.add(audit)
    db.session.commit()
    
    return jsonify({"success": True, "message": "Translation deleted"})

@app.route("/contents/store-status", methods=["GET", "OPTIONS"])
def get_contents_store_status():
    if request.method == 'OPTIONS':
        return '', 204
    store_url, access_token = get_shopify_credentials()
    return jsonify({
        "connected": bool(store_url and access_token),
        "store_url": store_url or None,
    })


@app.route("/contents/sync", methods=["POST", "OPTIONS"])
def sync_contents():
    if request.method == 'OPTIONS':
        return '', 204

    data = request.json or {}
    page = (data.get("page") or "home").strip()

    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return jsonify({
            "success": False,
            "message": "No Shopify store connected. Add your store URL and access token in Store Settings.",
            "imported": 0,
        }), 400

    if page not in ["home", "product", "collection"]:
        return jsonify({
            "success": False,
            "message": f"The '{page}' page is not synced from Shopify. Add content manually or choose home, product, or collection.",
            "imported": 0,
        }), 400

    imported = seed_shopify_page_contents(page)
    total = PageContent.query.filter_by(page=page).count()

    return jsonify({
        "success": True,
        "message": f"Imported {imported} new item(s) from Shopify. {total} total item(s) on this page.",
        "imported": imported,
        "total": total,
    })


@app.route("/contents", methods=["GET", "OPTIONS"])
def get_contents():
    if request.method == 'OPTIONS':
        return '', 204
    page = request.args.get("page")
    if page:
        if page in ["home", "product", "collection"]:
            seed_shopify_page_contents(page)
        records = PageContent.query.filter_by(page=page).order_by(PageContent.key).all()
    else:
        records = PageContent.query.order_by(PageContent.page, PageContent.key).all()

    return jsonify([{
        "id": item.id,
        "page": item.page,
        "key": item.key,
        "source_text": item.source_text
    } for item in records])

@app.route("/contents", methods=["POST", "OPTIONS"])
def create_content():
    if request.method == 'OPTIONS':
        return '', 204

    data = request.json
    page = data.get("page", "home").strip()
    key = data.get("key", "").strip()
    source_text = data.get("source_text", "").strip()

    if not page or not key or not source_text:
        return jsonify({"success": False, "message": "page, key, and source_text are required"}), 400

    existing = PageContent.query.filter_by(page=page, key=key).first()
    if existing:
        return jsonify({"success": False, "message": "Content item already exists for this page and key"}), 400

    content = PageContent(page=page, key=key, source_text=source_text)
    db.session.add(content)
    db.session.commit()

    return jsonify({"success": True, "content": {
        "id": content.id,
        "page": content.page,
        "key": content.key,
        "source_text": content.source_text
    }})

@app.route("/contents/import", methods=["POST", "OPTIONS"])
def import_content():
    if request.method == 'OPTIONS':
        return '', 204

    data = request.json or {}
    page = (data.get("page") or "other").strip()
    key = (data.get("key") or "").strip()
    source_text = (data.get("source_text") or "").strip()
    source_url = (data.get("source_url") or "").strip()
    target_language = (data.get("target_language") or "").strip()
    translated_text = (data.get("translated_text") or "").strip()

    if not key or not source_text:
        return jsonify({"success": False, "message": "key and source_text are required"}), 400

    existing = PageContent.query.filter_by(page=page, key=key).first()
    if existing:
        existing.source_text = source_text
        content = existing
        updated = True
    else:
        content = PageContent(page=page, key=key, source_text=source_text)
        db.session.add(content)
        updated = False

    translation_saved = False
    if target_language and translated_text:
        existing_translation = Translation.query.filter_by(
            source_text=content.source_text,
            target_language=target_language
        ).first()
        if existing_translation:
            existing_translation.translated_text = translated_text
        else:
            db.session.add(Translation(
                source_text=content.source_text,
                target_language=target_language,
                translated_text=translated_text
            ))
        translation_saved = True

    db.session.commit()

    audit_action = f"Content Imported: {page}/{key}"
    if source_url:
        audit_action += f" from {source_url}"
    db.session.add(AuditLog(action=audit_action))
    db.session.commit()

    return jsonify({
        "success": True,
        "updated": updated,
        "translation_saved": translation_saved,
        "message": f"Content {'updated' if updated else 'saved'} to Translations library.",
        "content": {
            "id": content.id,
            "page": content.page,
            "key": content.key,
            "source_text": content.source_text
        }
    })

@app.route("/contents/<int:content_id>", methods=["PUT", "OPTIONS"])
def update_content(content_id):
    if request.method == 'OPTIONS':
        return '', 204

    data = request.json
    content = PageContent.query.get(content_id)
    if not content:
        return jsonify({"success": False, "message": "Content item not found"}), 404

    page = data.get("page", content.page).strip()
    key = data.get("key", content.key).strip()
    source_text = data.get("source_text", content.source_text).strip()

    if not page or not key or not source_text:
        return jsonify({"success": False, "message": "page, key, and source_text are required"}), 400

    duplicate = PageContent.query.filter(PageContent.page == page, PageContent.key == key, PageContent.id != content_id).first()
    if duplicate:
        return jsonify({"success": False, "message": "Another content item already uses this page and key"}), 400

    content.page = page
    content.key = key
    content.source_text = source_text
    db.session.commit()

    return jsonify({"success": True, "content": {
        "id": content.id,
        "page": content.page,
        "key": content.key,
        "source_text": content.source_text
    }})

@app.route("/contents/<int:content_id>", methods=["DELETE"])
def delete_content(content_id):
    content = PageContent.query.get(content_id)
    if not content:
        return jsonify({"success": False, "message": "Content item not found"}), 404

    db.session.delete(content)
    db.session.commit()

    return jsonify({"success": True, "message": "Content item deleted"})

@app.route("/contents/<int:content_id>/translate", methods=["POST", "OPTIONS"])
def translate_content(content_id):
    if request.method == 'OPTIONS':
        return '', 204

    data = request.json
    target_language = data.get("target_language", "").strip()
    if not target_language:
        return jsonify({"success": False, "message": "Missing target language"}), 400

    content = PageContent.query.get(content_id)
    if not content:
        return jsonify({"success": False, "message": "Content item not found"}), 404

    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    provider = provider_settings.get("provider", "openai")
    model = provider_settings.get("model", "gpt-3.5-turbo")
    api_key = provider_settings["api_keys"].get(provider, "")

    try:
        translated_text = get_provider_response(provider, model, api_key, content.source_text, target_language)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    translation = Translation(
        source_text=content.source_text,
        target_language=target_language,
        translated_text=translated_text
    )
    db.session.add(translation)
    db.session.commit()

    return jsonify({"success": True, "translated_text": translated_text})

@app.route('/api/dashboard', methods=['GET', 'OPTIONS'])
def api_dashboard():
    """Aggregate endpoint for the app-home Shopify extension dashboard."""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        # ── Counts ──
        total_translations = Translation.query.count()
        lang_settings      = get_setting("language_settings", {})
        targets            = lang_settings.get("targets", [])

        # ── Provider ──
        provider_settings = get_setting("provider_settings", get_default_provider_settings())
        provider = provider_settings.get("provider", "Not configured")

        # ── Store connection ──
        store_setting = get_setting("store_setting", {})
        store_url     = store_setting.get("store_url", "")
        store_status  = "Not configured"
        if store_url:
            try:
                token = store_setting.get("access_token", "")
                r = requests.get(
                    f"https://{store_url}/admin/api/2026-04/shop.json",
                    headers={"X-Shopify-Access-Token": token},
                    timeout=5
                )
                store_status = "Connected" if r.status_code == 200 else "Token error"
            except Exception:
                store_status = "Unreachable"

        # ── Content counts ──
        page_count = db.session.query(PageContent.page).distinct().count()

        # Most translated language
        most_used_row = (
            db.session.query(Translation.target_language, func.count(Translation.id).label('cnt'))
            .group_by(Translation.target_language)
            .order_by(func.count(Translation.id).desc())
            .first()
        )
        most_used_lang = most_used_row[0] if most_used_row else (targets[0] if targets else "—")

        # ── Recent activity (last 5 audit logs) ──
        logs = AuditLog.query.order_by(AuditLog.id.desc()).limit(5).all()
        recent_activity = [
            {
                "id":     log.id,
                "action": log.action,
                "time":   log.created_at.strftime("%b %d, %H:%M") if log.created_at else "—",
                "status": "Success"
            }
            for log in logs
        ]

        return jsonify({
            "overview": {
                "totalProducts":      "—",
                "totalPages":         page_count,
                "totalCollections":   "—",
                "activeLanguages":    len(targets),
                "translationRequests": total_translations,
                "status":             "Healthy"
            },
            "analytics": {
                "translatedProducts":  "—",
                "translatedPages":     page_count,
                "mostUsedLanguage":    most_used_lang,
                "successRate":         "—"
            },
            "extension": {
                "switcherStatus": "Active",
                "connection":     "Connected",
                "lastSync":       "—"
            },
            "settings": {
                "currentProvider":  provider,
                "backend":         "Online",
                "storeConnection": store_status
            },
            "recentActivity": recent_activity
        })

    except Exception as e:
        print(f"[api/dashboard] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/analytics', methods=['GET'])
def analytics():
    total_translations = Translation.query.count()
    last_translation = Translation.query.order_by(Translation.id.desc()).first()
    
    last_translation_data = None
    if last_translation:
        last_translation_data = {
            "id": last_translation.id,
            "source_text": last_translation.source_text,
            "target_language": last_translation.target_language,
            "translated_text": last_translation.translated_text
        }
    
    language_settings = get_setting("language_settings", {})
    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    
    return jsonify({
        "total_translations": total_translations,
        "total_languages": len(language_settings.get("targets", [])),
        "providers": 1 if provider_settings else 0,
        "last_translation": last_translation_data or "No translations yet"
    })

@app.route("/audit-history", methods=["GET"])
def get_audit_history():
    logs = AuditLog.query.order_by(AuditLog.id.desc()).all()
    return jsonify([{
        "id": log.id,
        "action": log.action,
        "created_at": str(log.created_at)
    } for log in logs])
    
@app.route('/save-store-settings', methods=['POST', 'OPTIONS'])
def save_store_settings():
    if request.method == 'OPTIONS':
        return '', 204

    data = request.json
    print("Received Data:", data)

    store_setting = get_setting("store_setting", {})
    store_setting["store_url"] = normalize_shopify_store_url(data.get("store_url", ""))
    raw_token = (data.get("access_token") or "").strip()
    # strip common prefixes/quotes
    if raw_token.startswith('"') and raw_token.endswith('"'):
        raw_token = raw_token[1:-1]
    if raw_token.lower().startswith("bearer "):
        raw_token = raw_token.split(None, 1)[1]
    store_setting["access_token"] = raw_token
    set_setting("store_setting", store_setting)

    print("Saved Settings:", store_setting)

    audit = AuditLog(action="Store Settings Updated")
    db.session.add(audit)
    db.session.commit()

    return jsonify({"success": True, "message": "Store settings saved successfully"})

@app.route("/get-store-settings", methods=['GET', 'OPTIONS'])
def get_store_settings():
    if request.method == 'OPTIONS':
        return '', 204
    return jsonify(get_setting("store_setting", {}))

@app.route("/shopify/test")
def shopify_test():
    shop = get_shop_from_request()
    store = get_current_store(shop)
    if not store:
        return jsonify({"success": False, "message": "No Shopify store connected for this shop"}), 404

    headers = {"X-Shopify-Access-Token": store.access_token}
    response = requests.get(f"https://{store.shop}/admin/api/2025-07/shop.json", headers=headers)
    return jsonify(response.json())

@app.route("/install")
def install():
    shop = request.args.get("shop")

    install_url = (
        f"https://{shop}/admin/oauth/authorize"
        f"?client_id={os.getenv('SHOPIFY_CLIENT_ID')}"
        f"&scope={os.getenv('SHOPIFY_SCOPES')}"
        f"&redirect_uri={os.getenv('SHOPIFY_REDIRECT_URI')}"
    )

    return redirect(install_url)

@app.route("/auth/callback")
def auth_callback():
    shop = request.args.get("shop")
    code = request.args.get("code")

    response = requests.post(
        f"https://{shop}/admin/oauth/access_token",
        json={
            "client_id": os.getenv("SHOPIFY_CLIENT_ID"),
            "client_secret": os.getenv("SHOPIFY_CLIENT_SECRET"),
            "code": code
        }
    )

    token_data = response.json()
    print("TOKEN DATA:", token_data)

    store = ShopifyStore.query.filter_by(
        shop=normalize_shopify_store_url(shop)
    ).first()

    atok = token_data.get("access_token", "")

    if isinstance(atok, str) and atok.startswith('"') and atok.endswith('"'):
        atok = atok[1:-1]

    if isinstance(atok, str) and atok.lower().startswith("bearer "):
        atok = atok.split(None, 1)[1]

    if not store:
        store = ShopifyStore(
            shop=normalize_shopify_store_url(shop),
            access_token=atok
        )
        db.session.add(store)
    else:
        store.access_token = atok

    db.session.commit()

    return jsonify({
        "success": True,
        "shop": shop
    })
@app.route("/stores")
def stores():
    stores = ShopifyStore.query.all()
    return jsonify([{
        "id": store.id,
        "shop": store.shop
    } for store in stores])


@app.route("/debug-store")
def debug_store():
    shop = request.args.get("shop")

    store = ShopifyStore.query.filter_by(
        shop=shop
    ).first()

    if not store:
        return jsonify({"found": False})

    return jsonify({
        "found": True,
        "shop": store.shop,
        "token": store.access_token
    })


@app.route("/api/seo-resources", methods=["GET", "OPTIONS"])
def get_seo_resources():
    if request.method == 'OPTIONS':
        return '', 204
    
    resource_type = request.args.get("type", "products").lower()
    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return jsonify({"success": False, "message": "Store not connected"}), 400

    graphql_type = "PRODUCT" if resource_type == "products" else "PAGE"
    
    query = """
    query {
      translatableResources(first: 50, resourceType: %s) {
        edges {
          node {
            resourceId
            translatableContent {
              key
              value
              digest
              locale
            }
          }
        }
      }
    }
    """ % graphql_type

    headers = {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json"
    }
    url = f"https://{store_url}/admin/api/2026-04/graphql.json"
    
    try:
        res = requests.post(url, headers=headers, json={"query": query})
        res.raise_for_status()
        data = res.json()
        
        if "errors" in data:
            return jsonify({"success": False, "message": f"Shopify GraphQL Error: {data['errors'][0].get('message', 'Unknown error')}"}), 400
            
        graphql_data = data.get("data") or {}
        edges = graphql_data.get("translatableResources", {}).get("edges", [])
        resources = []
        
        for edge in edges:
            node = edge["node"]
            resource_id = node["resourceId"]
            content = node.get("translatableContent", [])
            
            title = ""
            meta_title = ""
            meta_title_digest = ""
            meta_desc = ""
            meta_desc_digest = ""
            
            for item in content:
                if item["key"] == "title":
                    title = item["value"]
                elif item["key"] == "meta_title":
                    meta_title = item["value"]
                    meta_title_digest = item["digest"]
                elif item["key"] == "meta_description":
                    meta_desc = item["value"]
                    meta_desc_digest = item["digest"]
            
            resources.append({
                "id": resource_id,
                "title": title or resource_id.split("/")[-1],
                "originalMetaTitle": meta_title,
                "titleDigest": meta_title_digest,
                "originalMetaDescription": meta_desc,
                "descriptionDigest": meta_desc_digest
            })
            
        return jsonify({"success": True, "resources": resources})
        
    except requests.exceptions.RequestException as e:
        status_code = e.response.status_code if e.response else 500
        print("GraphQL HTTP Error:", str(e))
        if status_code == 401:
             return jsonify({"success": False, "message": "Shopify store authentication failed. The access token may be invalid or expired. Please update it in Store Settings."}), 401
        return jsonify({"success": False, "message": str(e)}), status_code
    except Exception as e:
        print("GraphQL Error:", str(e))
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/seo-update-original", methods=["POST", "OPTIONS"])
def update_original_seo():
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    resource_id = data.get("resourceId")
    meta_title = data.get("metaTitle", "")
    meta_desc = data.get("metaDescription", "")
    
    if not resource_id:
        return jsonify({"success": False, "message": "resourceId is required"}), 400
        
    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return jsonify({"success": False, "message": "Store not connected"}), 400

    headers = {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json"
    }
    
    is_product = "Product" in resource_id
    
    if is_product:
        mutation = """
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            userErrors {
              message
            }
          }
        }
        """
        variables = {
            "input": {
                "id": resource_id,
                "seo": {
                    "title": meta_title,
                    "description": meta_desc
                }
            }
        }
    else:
        mutation = """
        mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
          pageUpdate(id: $id, page: $page) {
            userErrors {
              message
            }
          }
        }
        """
        
        metafields = []
        if meta_title:
            metafields.append({
                "namespace": "global",
                "key": "title_tag",
                "type": "single_line_text_field",
                "value": meta_title
            })
        if meta_desc:
            metafields.append({
                "namespace": "global",
                "key": "description_tag",
                "type": "single_line_text_field",
                "value": meta_desc
            })
            
        variables = {
            "id": resource_id,
            "page": {
                "metafields": metafields
            }
        }

    try:
        res = requests.post(f"https://{store_url}/admin/api/2026-04/graphql.json", headers=headers, json={"query": mutation, "variables": variables})
        res.raise_for_status()
        data = res.json()
        
        if "errors" in data:
            return jsonify({"success": False, "message": f"Shopify GraphQL Error: {data['errors'][0].get('message', 'Unknown error')}"}), 400
            
        # Parse user errors based on mutation type
        mutation_name = "productUpdate" if is_product else "pageUpdate"
        user_errors = data.get("data", {}).get(mutation_name, {}).get("userErrors", [])
        
        if user_errors:
            return jsonify({"success": False, "message": user_errors[0].get("message", "Update failed")}), 400
            
        return jsonify({"success": True})
        
    except requests.exceptions.RequestException as e:
        status_code = e.response.status_code if e.response else 500
        print("GraphQL HTTP Error:", str(e))
        if status_code == 401:
             return jsonify({"success": False, "message": "Shopify store authentication failed. The access token may be invalid or expired. Please update it in Store Settings."}), 401
        return jsonify({"success": False, "message": str(e)}), status_code
    except Exception as e:
        print("GraphQL Error:", str(e))
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/seo-translate", methods=["POST", "OPTIONS"])
def translate_seo():
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    resource_id = data.get("resourceId")
    locale = data.get("locale")
    meta_title = data.get("metaTitle")
    meta_desc = data.get("metaDescription")
    title_digest = data.get("titleDigest")
    desc_digest = data.get("descriptionDigest")
    
    if not resource_id or not locale:
        return jsonify({"success": False, "message": "resourceId and locale required"}), 400
        
    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return jsonify({"success": False, "message": "Store not connected"}), 400

    translations = []
    if meta_title and title_digest:
        translations.append({
            "key": "meta_title",
            "value": meta_title,
            "translatableContentDigest": title_digest,
            "locale": locale
        })
    if meta_desc and desc_digest:
        translations.append({
            "key": "meta_description",
            "value": meta_desc,
            "translatableContentDigest": desc_digest,
            "locale": locale
        })
        
    if not translations:
        return jsonify({"success": False, "message": "No translations provided or missing digests. Ensure original SEO data exists in Shopify before translating."}), 400

    mutation = """
    mutation translationsRegister($resourceId: ID!, $translations: [TranslationInput!]!) {
      translationsRegister(resourceId: $resourceId, translations: $translations) {
        userErrors {
          message
          field
        }
      }
    }
    """
    
    variables = {
        "resourceId": resource_id,
        "translations": translations
    }
    
    headers = {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json"
    }
    url = f"https://{store_url}/admin/api/2026-04/graphql.json"
    
    try:
        res = requests.post(url, headers=headers, json={"query": mutation, "variables": variables})
        res.raise_for_status()
        data = res.json()
        
        user_errors = data.get("data", {}).get("translationsRegister", {}).get("userErrors", [])
        if user_errors:
            error_msg = ", ".join([e["message"] for e in user_errors])
            return jsonify({"success": False, "message": f"GraphQL Error: {error_msg}"}), 400
            
        audit = AuditLog(action=f"SEO Translated {resource_id.split('/')[-1]} to {locale}")
        db.session.add(audit)
        db.session.commit()
            
        return jsonify({"success": True, "message": "Translations registered"})
        
    except Exception as e:
        print("GraphQL Mutation Error:", str(e))
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)