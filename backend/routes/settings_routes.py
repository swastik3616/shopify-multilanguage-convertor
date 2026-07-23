from flask import Blueprint, jsonify, request
from database import execute
from model import Language
from utils.helpers import (
    get_setting, set_setting, get_default_provider_settings,
    get_provider_settings, set_provider_settings,
    normalize_shopify_store_url
)

settings_bp = Blueprint("settings_routes", __name__)


@settings_bp.route("/save-languages", methods=["POST", "OPTIONS"])
def save_languages():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    updates = data.get("languages", [])
    
    try:
        langs = Language.query.all()
        lang_dict = {str(l.id): l.status for l in langs}
        
        for item in updates:
            lang_dict[str(item["id"])] = item["status"]
            
        target_count = sum(1 for status in lang_dict.values() if status in ["Target", "Both"])
        
        if target_count > 10:
            return jsonify({"success": False, "message": "Maximum of 10 target languages allowed."}), 400

        for item in updates:
            lang = Language.query.get(item["id"])
            if lang:
                lang.status = item["status"]
                lang._save()
    except Exception as e:
        import traceback
        return jsonify({"success": False, "message": str(e), "traceback": traceback.format_exc()}), 500

    return jsonify({"success": True, "message": "Languages saved successfully"})


@settings_bp.route("/get-languages", methods=["GET"])
def get_languages():
    langs = Language.query.order_by("name").all()
    
    if request.args.get("admin") == "true":
        result = []
        for l in langs:
            result.append({
                "id": l.id,
                "name": l.name,
                "code": l.code,
                "status": l.status
            })
        return jsonify(result)
        
    # Legacy format for storefront widget
    source = None
    targets = []
    for l in langs:
        if l.status == "Source" or l.status == "Both":
            if not source:
                source = l.name
            else:
                targets.append(l.name) # Fallback if multiple sources
        elif l.status == "Target":
            targets.append(l.name)
            
    if not source:
        source = "English"
        
    return jsonify({
        "source": source,
        "targets": targets
    })


@settings_bp.route("/get-provider", methods=["GET"])
def get_provider():
    settings = get_provider_settings()
    # Mask the API key before sending to frontend
    active_provider = settings.get("provider", "openai")
    masked_keys = {}
    for p, k in settings.get("api_keys", {}).items():
        if k:
            masked_keys[p] = k[:4] + "..." + k[-4:] if len(k) > 8 else "****"
        else:
            masked_keys[p] = ""
    return jsonify({
        "provider": active_provider,
        "model": settings.get("model", "gpt-3.5-turbo"),
        "api_keys": masked_keys,
    })


@settings_bp.route("/save-provider", methods=["POST", "OPTIONS"])
def save_provider():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    provider = data.get("provider", "openai")
    model = data.get("model", "")
    api_key = data.get("api_key", "")

    if not provider:
        return jsonify({"success": False, "message": "Provider is required"}), 400
    if not model:
        return jsonify({"success": False, "message": "Model name is required"}), 400
    if not api_key:
        return jsonify({"success": False, "message": "API key is required"}), 400

    try:
        set_provider_settings(provider, model, api_key)
    except Exception as e:
        import traceback
        return jsonify({"success": False, "message": str(e), "traceback": traceback.format_exc()}), 500

    execute(
        "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, CURRENT_TIMESTAMP)",
        (f"Provider Updated: {provider} / {model}",),
    )
    return jsonify({"success": True, "message": f"Provider '{provider}' saved successfully"})


@settings_bp.route("/save-store-settings", methods=["POST", "OPTIONS"])
def save_store_settings():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    store_setting = get_setting("store_setting", {})
    store_setting["store_url"] = normalize_shopify_store_url(data.get("store_url", ""))

    raw_token = (data.get("access_token") or "").strip()
    if raw_token.startswith('"') and raw_token.endswith('"'):
        raw_token = raw_token[1:-1]
    if raw_token.lower().startswith("bearer "):
        raw_token = raw_token.split(None, 1)[1]
    store_setting["access_token"] = raw_token

    set_setting("store_setting", store_setting)

    execute(
        "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, CURRENT_TIMESTAMP)",
        ("Store Settings Updated",),
    )
    return jsonify({"success": True, "message": "Store settings saved successfully"})


@settings_bp.route("/get-store-settings", methods=["GET", "OPTIONS"])
def get_store_settings():
    if request.method == "OPTIONS":
        return "", 204
    return jsonify(get_setting("store_setting", {}))


DEFAULT_CURRENCY_MAP = {
    "Hindi": "INR", "Marathi": "INR", "Gujarati": "INR", "Tamil": "INR",
    "Telugu": "INR", "Kannada": "INR", "Malayalam": "INR", "Bengali": "INR",
    "Punjabi": "INR", "Urdu": "INR", "Odia": "INR", "Assamese": "INR",
    "Spanish": "EUR", "French": "EUR", "German": "EUR", "Italian": "EUR",
    "Portuguese": "EUR", "Dutch": "EUR", "Greek": "EUR", "Romanian": "EUR",
    "Czech": "CZK", "Polish": "PLN", "Danish": "DKK", "Swedish": "SEK",
    "Norwegian": "NOK", "Finnish": "EUR", "Hungarian": "HUF",
    "Japanese": "JPY", "Chinese": "CNY", "Korean": "KRW",
    "Arabic": "AED", "Turkish": "TRY", "Hebrew": "ILS",
    "Thai": "THB", "Vietnamese": "VND", "Indonesian": "IDR",
    "Malay": "MYR", "Filipino": "PHP", "Russian": "RUB",
    "English": "USD",
}


@settings_bp.route("/save-feature-flags", methods=["POST"])
def save_feature_flags():
    data = request.json
    flags = get_setting("feature_flags", {})
    
    if "currency_enabled" in data:
        flags["currency_enabled"] = data["currency_enabled"]
    if "currency_api_key" in data:
        flags["currency_api_key"] = data["currency_api_key"]
    if "currency_map" in data:
        flags["currency_map"] = data["currency_map"]
    if "active_currencies" in data:
        flags["active_currencies"] = data["active_currencies"]
        
    set_setting("feature_flags", flags)

    execute(
        "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, CURRENT_TIMESTAMP)",
        (f"Feature Flags Updated: Currency {'Enabled' if flags['currency_enabled'] else 'Disabled'}",),
    )
    return jsonify({"success": True, "message": "Feature flags saved successfully"})


@settings_bp.route("/get-feature-flags", methods=["GET"])
def get_feature_flags():
    flags = get_setting("feature_flags", {"currency_enabled": False})
    if "currency_map" not in flags or not flags["currency_map"]:
        flags["currency_map"] = DEFAULT_CURRENCY_MAP
    if "active_currencies" not in flags:
        flags["active_currencies"] = []
    return jsonify(flags)
