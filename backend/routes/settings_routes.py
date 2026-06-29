from flask import Blueprint, jsonify, request
from database import db
from model import AuditLog
from utils.helpers import (
    get_setting, set_setting, get_default_provider_settings,
    normalize_shopify_store_url
)

settings_bp = Blueprint("settings_routes", __name__)


@settings_bp.route("/save-languages", methods=["POST", "OPTIONS"])
def save_languages():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    language_settings = get_setting("language_settings", {})
    language_settings["source"] = data["source_language"]
    language_settings["targets"] = data["target_languages"]
    set_setting("language_settings", language_settings)

    db.session.add(AuditLog(action="Language Settings Updated"))
    db.session.commit()

    return jsonify({"success": True, "message": "Languages saved successfully"})


@settings_bp.route("/get-languages", methods=["GET"])
def get_languages():
    return jsonify(get_setting("language_settings", {}))


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

    db.session.add(AuditLog(action=f"Provider Updated: {provider}"))
    db.session.commit()

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

    db.session.add(AuditLog(action="Store Settings Updated"))
    db.session.commit()

    return jsonify({"success": True, "message": "Store settings saved successfully"})


@settings_bp.route("/get-store-settings", methods=["GET", "OPTIONS"])
def get_store_settings():
    if request.method == "OPTIONS":
        return "", 204
    return jsonify(get_setting("store_setting", {}))
