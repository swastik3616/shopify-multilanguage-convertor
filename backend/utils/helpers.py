import json
from database import execute
from model import ShopifyStore
import re
from flask import request


def _mask_token(token):
    if not token:
        return None
    if len(token) <= 8:
        return "****"
    return f"{token[:4]}...{token[-4:]}"


def get_setting(key, default_value):
    row = execute(
        "SELECT VALUE FROM APP_SETTINGS WHERE KEY = %s LIMIT 1", (key,), fetch="one"
    )
    if row:
        val = json.loads(row["VALUE"])
        return val if val is not None else default_value
    return default_value


def set_setting(key, value):
    existing = execute(
        "SELECT ID FROM APP_SETTINGS WHERE KEY = %s LIMIT 1", (key,), fetch="one"
    )
    if existing:
        execute(
            "UPDATE APP_SETTINGS SET VALUE = %s WHERE KEY = %s",
            (json.dumps(value), key),
        )
    else:
        execute(
            "INSERT INTO APP_SETTINGS (KEY, VALUE) VALUES (%s, %s)",
            (key, json.dumps(value)),
        )


def get_default_provider_settings():
    return {
        "provider": "openai",
        "model": "gpt-3.5-turbo",
        "api_keys": {
            "openai": "",
            "gemini": "",
            "claude": "",
            "groq": "",
            "ollama": "",
        },
    }


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
    """Return a row dict for the provided shop domain (normalized) or from request."""
    if not shop:
        shop = get_shop_from_request()
    if not shop:
        return None
    shop = normalize_shopify_store_url(shop)
    row = execute(
        "SELECT ID, SHOP, ACCESS_TOKEN FROM SHOPIFY_STORES WHERE SHOP = %s LIMIT 1",
        (shop,),
        fetch="one",
    )
    return row


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
        return normalize_shopify_store_url(store["SHOP"]), _clean_token(store["ACCESS_TOKEN"])

    # Fallback: legacy manual store settings
    store_setting = get_setting("store_setting", {})
    store_url = normalize_shopify_store_url(store_setting.get("store_url", ""))
    access_token = _clean_token(store_setting.get("access_token", ""))
    return store_url, access_token
