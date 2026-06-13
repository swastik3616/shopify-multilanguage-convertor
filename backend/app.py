from flask import Flask, jsonify, make_response,request,redirect
from flask_cors import CORS
import os
import requests
from database import db
from model import Translation, AuditLog, ShopifyStore
from dotenv import load_dotenv

app = Flask(__name__)


app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///translator.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
STORE_URL = os.getenv("SHOPIFY_STORE_URL")
ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN")

db.init_app(app)

with app.app_context():
    db.create_all()

CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type"]}})


language_settings = {}
provider_settings = {
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
store_setting={}
load_dotenv()

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

    language_settings["source"] = data["source_language"]
    language_settings["targets"] = data["target_languages"]
    audit = AuditLog(
    action="Language Settings Updated"
)

    db.session.add(audit)
    db.session.commit()

    return jsonify({
    "success": True,
    "message": "Languages saved successfully"
})


@app.route("/get-languages", methods=["GET"])
def get_languages():
    return jsonify(language_settings)

@app.route("/get-provider", methods=["GET"])
def get_provider():
    return jsonify(provider_settings)

@app.route("/save-provider", methods=["POST", "OPTIONS"])
def save_provider():
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json

    provider = data.get("provider", "openai")
    model = data.get("model", "gpt-3.5-turbo")
    api_key = data.get("api_key", "")
  
    provider_settings["provider"] = provider
    provider_settings["model"] = model
    provider_settings["api_keys"][provider] = api_key

    audit = AuditLog(
        action=f"Provider Updated: {provider}"
    )

    db.session.add(audit)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Provider saved successfully"
    })


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

@app.route("/translate", methods=["POST"])
def translate_text():
    data = request.json

    source_text = data.get("source_text", "")
    target_language = data.get("target_language", "")
    
    if not source_text or not target_language:
        return jsonify({"success": False, "message": "Missing text or language"}), 400

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

    return jsonify({
        "translated_text": translated_text
    })


@app.route("/translations", methods=["GET"])
def get_translations():
    records = Translation.query.all()

    return jsonify([
    {
        "id": item.id,
        "source_text": item.source_text,
        "target_language": item.target_language,
        "translated_text": item.translated_text
    }
    for item in records
])



@app.route("/update-translation", methods=["POST"])
def update_translation():
    data = request.json

    translation = Translation.query.get(data["id"])

    if not translation:
        return jsonify({
        "success": False,
        "message": "Translation not found"
    }), 404

    translation.translated_text = data["translated_text"]

    db.session.commit()

    return jsonify({
    "success": True,
    "message": "Translation updated successfully"
})



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
    
    return jsonify({
        "total_translations": total_translations,
        "total_languages": len(language_settings.get("targets", [])),
        "providers": 1 if provider_settings else 0,
        "last_translation": last_translation_data or "No translations yet"
    })


@app.route("/audit-history", methods=["GET"])
def get_audit_history():

    logs = AuditLog.query.order_by(
        AuditLog.id.desc()
    ).all()

    return jsonify([
        {
            "id": log.id,
            "action": log.action,
            "created_at": str(log.created_at)
        }
        for log in logs
    ])
    
@app.route('/save-store-settings', methods=['POST', 'OPTIONS'])
def save_store_settings():
    if request.method == 'OPTIONS':
        return '', 204

    data = request.json

    print("Received Data:", data)

    store_setting["store_url"] = data["store_url"]
    store_setting["access_token"] = data["access_token"]

    print("Saved Settings:", store_setting)

    audit = AuditLog(
        action="Store Settings Updated"
    )

    db.session.add(audit)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Store settings saved successfully"
    })
    

@app.route("/get-store-settings", methods=['GET', 'OPTIONS'])
def get_store_settings():
    if request.method == 'OPTIONS':
        return '', 204
    
    return jsonify(store_setting)


@app.route("/shopify/test")
def shopify_test():
    
    store = ShopifyStore.query.first()

    if not store:
        return jsonify({
        "success": False,
        "message": "No Shopify store connected"
    }), 404

    headers = {
    "X-Shopify-Access-Token": store.access_token
}

    response = requests.get(
        f"https://{store.shop}/admin/api/2025-07/shop.json",
        headers=headers
    )

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

    store = ShopifyStore.query.filter_by(
        shop=shop
    ).first()

    if not store:
        store = ShopifyStore(
            shop=shop,
            access_token=token_data["access_token"]
        )
        db.session.add(store)
    else:
        store.access_token = token_data["access_token"]

    db.session.commit()

    return jsonify({
        "success": True,
        "shop": shop
    })
    
@app.route("/stores")
def stores():

    stores = ShopifyStore.query.all()

    return jsonify([
        {
            "id": store.id,
            "shop": store.shop
        }
        for store in stores
    ])

if __name__ == "__main__":
    app.run(debug=True, port=5000)
