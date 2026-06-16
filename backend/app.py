from flask import Flask, jsonify, make_response, request, redirect
from flask_cors import CORS
import os
import requests
import json
import re
from database import db
from model import Translation, PageContent, AuditLog, ShopifyStore, AppSetting
from dotenv import load_dotenv

app = Flask(__name__)

db_url = os.getenv("DATABASE_URL", "sqlite:///translator.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
STORE_URL = os.getenv("SHOPIFY_STORE_URL")
ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN")

db.init_app(app)

with app.app_context():
    db.create_all()

CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type"]}})

load_dotenv()

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
    if not STORE_URL or not ACCESS_TOKEN:
        return []
    
    try:
        headers = {
            "X-Shopify-Access-Token": ACCESS_TOKEN,
            "Content-Type": "application/json"
        }
        url = f"https://{STORE_URL}/admin/api/2024-01/pages.json"
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        return res.json().get("pages", [])
    except Exception as e:
        print(f"Error fetching Shopify pages: {str(e)}")
        return []


def fetch_shopify_products(limit=5):
    """Fetch products from Shopify store."""
    if not STORE_URL or not ACCESS_TOKEN:
        return []
    
    try:
        headers = {
            "X-Shopify-Access-Token": ACCESS_TOKEN,
            "Content-Type": "application/json"
        }
        url = f"https://{STORE_URL}/admin/api/2024-01/products.json?limit={limit}&fields=id,title,body_html,handle"
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        return res.json().get("products", [])
    except Exception as e:
        print(f"Error fetching Shopify products: {str(e)}")
        return []


def fetch_shopify_collections(limit=5):
    """Fetch collections from Shopify store."""
    if not STORE_URL or not ACCESS_TOKEN:
        return []
    
    try:
        headers = {
            "X-Shopify-Access-Token": ACCESS_TOKEN,
            "Content-Type": "application/json"
        }
        url = f"https://{STORE_URL}/admin/api/2024-01/custom_collections.json?limit={limit}&fields=id,title,body_html,handle"
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        return res.json().get("custom_collections", [])
    except Exception as e:
        print(f"Error fetching Shopify collections: {str(e)}")
        return []


def extract_text_from_html(html_text):
    """Extract plain text from HTML content."""
    if not html_text:
        return ""
    import re
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', html_text)
    # Decode HTML entities
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return text.strip()[:200]  # Limit to 200 chars


def seed_shopify_page_contents(page):
    """Fetch and seed page contents from Shopify store."""
    created = False
    
    try:
        if page == "home":
            pages = fetch_shopify_pages()
            for shopify_page in pages:
                title = shopify_page.get("title", "")
                body = extract_text_from_html(shopify_page.get("body_html", ""))
                
                if title and not PageContent.query.filter_by(page="home", key=title).first():
                    db.session.add(PageContent(page="home", key=title, source_text=body or title))
                    created = True
            
            # Also fetch first few products as featured content
            products = fetch_shopify_products(3)
            for idx, product in enumerate(products):
                title = product.get("title", f"Product {idx+1}")
                body = extract_text_from_html(product.get("body_html", ""))
                key = f"featured_product_{idx+1}_title"
                
                if not PageContent.query.filter_by(page="home", key=key).first():
                    db.session.add(PageContent(page="home", key=key, source_text=title))
                    created = True
                    
                key = f"featured_product_{idx+1}_desc"
                if body and not PageContent.query.filter_by(page="home", key=key).first():
                    db.session.add(PageContent(page="home", key=key, source_text=body))
                    created = True
                    
        elif page == "product":
            products = fetch_shopify_products(10)
            for idx, product in enumerate(products):
                title = product.get("title", "")
                body = extract_text_from_html(product.get("body_html", ""))
                key = f"product_{product.get('id', idx)}_title"
                
                if title and not PageContent.query.filter_by(page="product", key=key).first():
                    db.session.add(PageContent(page="product", key=key, source_text=title))
                    created = True
                    
                if body:
                    key = f"product_{product.get('id', idx)}_desc"
                    if not PageContent.query.filter_by(page="product", key=key).first():
                        db.session.add(PageContent(page="product", key=key, source_text=body))
                        created = True
                        
        elif page == "collection":
            collections = fetch_shopify_collections(10)
            for idx, collection in enumerate(collections):
                title = collection.get("title", "")
                body = extract_text_from_html(collection.get("body_html", ""))
                key = f"collection_{collection.get('id', idx)}_title"
                
                if title and not PageContent.query.filter_by(page="collection", key=key).first():
                    db.session.add(PageContent(page="collection", key=key, source_text=title))
                    created = True
                    
                if body:
                    key = f"collection_{collection.get('id', idx)}_desc"
                    if not PageContent.query.filter_by(page="collection", key=key).first():
                        db.session.add(PageContent(page="collection", key=key, source_text=body))
                        created = True
        
        if created:
            db.session.commit()
            print(f"Seeded {page} content from Shopify store")
            
    except Exception as e:
        print(f"Error seeding {page} content from Shopify: {str(e)}")



@app.route("/")
def home():
    return jsonify({
        "message": "Shopify Translator Backend Running"
    })

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
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3}
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            res.raise_for_status()
            response_text = res.json()["choices"][0]["message"]["content"].strip()
            
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

    # Convert array to dict with numeric keys
    source_texts_dict = {str(i): text for i, text in enumerate(texts)}

    try:
        translated_dict = get_bulk_provider_response(provider, model, api_key, source_texts_dict, target_language)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    # Build the final array and save to DB
    translated_texts = []
    for i in range(len(texts)):
        key = str(i)
        source = texts[i]
        translated = translated_dict.get(key, source) # fallback to original if missing
        translated_texts.append(translated)
        
        # Save to DB for history
        db.session.add(Translation(
            source_text=source,
            target_language=target_language,
            translated_text=translated
        ))
    
    db.session.commit()

    return jsonify({"translations": translated_texts})

@app.route("/translate", methods=["POST", "OPTIONS"])
def translate_text():
    if request.method == 'OPTIONS':
        return '', 204
        
    data = request.json
    source_text = data.get("source_text", "")
    target_language = data.get("target_language", "")
    
    if not source_text or not target_language:
        return jsonify({"success": False, "message": "Missing text or language"}), 400

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

@app.route("/translations/<int:translation_id>", methods=["DELETE"])
def delete_translation(translation_id):
    translation = Translation.query.get(translation_id)
    
    if not translation:
        return jsonify({"success": False, "message": "Translation not found"}), 404
    
    db.session.delete(translation)
    db.session.commit()
    
    audit = AuditLog(action=f"Translation Deleted: {translation_id}")
    db.session.add(audit)
    db.session.commit()
    
    return jsonify({"success": True, "message": "Translation deleted"})

@app.route("/contents", methods=["GET"])
def get_contents():
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

@app.route("/update-translation", methods=["POST"])
def update_translation():
    data = request.json
    translation = Translation.query.get(data["id"])

    if not translation:
        return jsonify({"success": False, "message": "Translation not found"}), 404

    translation.translated_text = data["translated_text"]
    db.session.commit()

    return jsonify({"success": True, "message": "Translation updated successfully"})

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
    store_setting["store_url"] = data["store_url"]
    store_setting["access_token"] = data["access_token"]
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
    store = ShopifyStore.query.first()
    if not store:
        return jsonify({"success": False, "message": "No Shopify store connected"}), 404

    headers = {"X-Shopify-Access-Token": store.access_token}
    response = requests.get(f"https://{store.shop}/admin/api/2025-07/shop.json", headers=headers)
    return jsonify(response.json())

@app.route("/install")
def install():
    shop = "0jeqkm-rp.myshopify.com"
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

    store = ShopifyStore.query.filter_by(shop=shop).first()
    if not store:
        store = ShopifyStore(shop=shop, access_token=token_data["access_token"])
        db.session.add(store)
    else:
        store.access_token = token_data["access_token"]

    db.session.commit()
    return jsonify({"success": True, "shop": shop})

@app.route("/stores")
def stores():
    stores = ShopifyStore.query.all()
    return jsonify([{
        "id": store.id,
        "shop": store.shop
    } for store in stores])

if __name__ == "__main__":
    app.run(debug=True, port=5000)
