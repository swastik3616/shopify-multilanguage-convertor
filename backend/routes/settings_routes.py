from flask import Blueprint, jsonify, request
from database import execute
from model import Language
from utils.helpers import get_setting, set_setting, get_default_provider_settings, normalize_shopify_store_url

settings_bp = Blueprint("settings_routes", __name__)


@settings_bp.route("/save-languages", methods=["POST", "OPTIONS"])
def save_languages():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    updates = data.get("languages", [])
    
    try:
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
    return jsonify(get_setting("provider_settings", get_default_provider_settings()))


@settings_bp.route("/save-provider", methods=["POST", "OPTIONS"])
def save_provider():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    provider = data.get("provider", "openai")
    model = data.get("model", "gpt-3.5-turbo")
    api_key = data.get("api_key", "")

    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    provider_settings["provider"] = provider
    provider_settings["model"] = model
    provider_settings["api_keys"][provider] = api_key
    set_setting("provider_settings", provider_settings)

    execute(
        "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, CURRENT_TIMESTAMP())",
        (f"Provider Updated: {provider}",),
    )
    return jsonify({"success": True, "message": "Provider saved successfully"})


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
        "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, CURRENT_TIMESTAMP())",
        ("Store Settings Updated",),
    )
    return jsonify({"success": True, "message": "Store settings saved successfully"})


@settings_bp.route("/get-store-settings", methods=["GET", "OPTIONS"])
def get_store_settings():
    if request.method == "OPTIONS":
        return "", 204
    return jsonify(get_setting("store_setting", {}))
