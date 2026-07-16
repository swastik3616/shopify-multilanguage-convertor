import json
from database import execute
from model import ShopifyStore
import re
from flask import request
import hmac
import hashlib
from urllib.parse import urlencode


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


def get_provider_settings():
    active_row = execute("SELECT PROVIDER_NAME, MODEL FROM AI_PROVIDERS WHERE IS_ACTIVE = TRUE LIMIT 1", fetch="one")
    
    provider = "openai"
    model = "gpt-3.5-turbo"
    if active_row:
        provider = active_row["PROVIDER_NAME"]
        model = active_row["MODEL"]

    all_keys_rows = execute("SELECT PROVIDER_NAME, API_KEY FROM AI_PROVIDERS", fetch="all") or []
    api_keys = {r["PROVIDER_NAME"]: r["API_KEY"] or "" for r in all_keys_rows}
    
    for p in ["openai", "gemini", "claude", "groq", "ollama"]:
        if p not in api_keys:
            api_keys[p] = ""

    return {
        "provider": provider,
        "model": model,
        "api_keys": api_keys,
    }


def set_provider_settings(provider, model, api_key):
    execute("UPDATE AI_PROVIDERS SET IS_ACTIVE = FALSE")
    
    existing = execute(
        "SELECT ID FROM AI_PROVIDERS WHERE PROVIDER_NAME = %s LIMIT 1",
        (provider,),
        fetch="one",
    )
    if existing:
        execute(
            "UPDATE AI_PROVIDERS SET MODEL = %s, API_KEY = %s, IS_ACTIVE = TRUE, UPDATED_AT = CURRENT_TIMESTAMP "
            "WHERE PROVIDER_NAME = %s",
            (model, api_key, provider),
        )
    else:
        # Seed missing providers safely
        default_base_url = "https://api.openai.com"
        default_endpoint = "/v1/chat/completions"
        auth_type = "Bearer"
        auth_header = "Authorization"
        headers_tpl = '{"Content-Type": "application/json"}'
        req_tpl = '{"model": "{{model}}", "messages": [{"role": "user", "content": "{{prompt}}"}]}'
        resp_map = 'choices[0].message.content'

        if provider == "claude":
            default_base_url = "https://api.anthropic.com"
            default_endpoint = "/v1/messages"
            auth_type = "Header"
            auth_header = "x-api-key"
            headers_tpl = '{"anthropic-version": "2023-06-01", "content-type": "application/json"}'
            req_tpl = '{"model": "{{model}}", "max_tokens": 4096, "messages": [{"role": "user", "content": "{{prompt}}"}]}'
            resp_map = 'content[0].text'
        elif provider == "ollama":
            default_base_url = "http://localhost:11434"
            default_endpoint = "/api/generate"
            auth_type = ""
            auth_header = ""
            req_tpl = '{"model": "{{model}}", "prompt": "{{prompt}}", "stream": false, "format": "json"}'
            resp_map = 'response'
            
        execute(
            "INSERT INTO AI_PROVIDERS (PROVIDER_NAME, BASE_URL, ENDPOINT, METHOD, AUTH_TYPE, AUTH_HEADER, REQUEST_TEMPLATE, RESPONSE_MAPPING, HEADERS, MODEL, API_KEY, IS_ACTIVE, UPDATED_AT) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, CURRENT_TIMESTAMP)",
            (provider, default_base_url, default_endpoint, 'POST', auth_type, auth_header, req_tpl, resp_map, headers_tpl, model, api_key),
        )


def normalize_shopify_store_url(store_url):
    if not store_url:
        return ""
    store_url = store_url.strip()
    store_url = re.sub(r"^https?://", "", store_url, flags=re.I)
    return store_url.strip("/")


def get_shop_from_request():
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
    store_setting = get_setting("store_setting", {})
    store_url = normalize_shopify_store_url(store_setting.get("store_url", ""))
    access_token = _clean_token(store_setting.get("access_token", ""))
    return store_url, access_token


def validate_shopify_shop(shop: str) -> bool:
    if not shop:
        return False
    pattern = r"^[a-zA-Z0-9-]+\.myshopify\.com$"
    return bool(re.match(pattern, shop))

def verify_shopify_hmac(query_params: dict, secret: str) -> bool:
    if 'hmac' not in query_params:
        return False
    provided_hmac = query_params['hmac']
    sorted_params = {k: v for k, v in sorted(query_params.items()) if k not in ['hmac', 'signature']}
    message = urlencode(sorted_params, safe='=')
    
    # Calculate HMAC SHA256
    calculated_hmac = hmac.new(
        secret.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    # Use compare_digest to prevent timing attacks
    return hmac.compare_digest(calculated_hmac, provided_hmac)

def verify_webhook_hmac(raw_data: bytes, hmac_header: str, secret: str) -> bool:
    if not hmac_header or not raw_data:
        return False
        
    import base64
    calculated_hmac = hmac.new(
        secret.encode('utf-8'),
        raw_data,
        hashlib.sha256
    ).digest()
    
    calculated_hmac_b64 = base64.b64encode(calculated_hmac).decode('utf-8')
    
    return hmac.compare_digest(calculated_hmac_b64, hmac_header)
