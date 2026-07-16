import os
from flask import Blueprint, request
from utils.helpers import verify_webhook_hmac
from database import execute

webhook_bp = Blueprint("webhook_routes", __name__)

def _validate_webhook():
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    raw_data = request.get_data()
    secret = os.getenv("SHOPIFY_CLIENT_SECRET")
    
    if not verify_webhook_hmac(raw_data, hmac_header, secret):
        return False
    return True

@webhook_bp.route("/webhooks/app-uninstalled", methods=["POST"])
def app_uninstalled():
    if not _validate_webhook():
        return "Unauthorized", 401
        
    data = request.json
    shop_domain = data.get("domain")
    
    if shop_domain:
        # Delete store tokens and data on uninstall
        execute("DELETE FROM SHOPIFY_STORES WHERE SHOP = %s", (shop_domain,))
        
    return "OK", 200

@webhook_bp.route("/webhooks/customers/data_request", methods=["POST"])
def customers_data_request():
    if not _validate_webhook():
        return "Unauthorized", 401
    # We do not store personal customer data, so return 200 OK to satisfy Shopify
    return "OK", 200

@webhook_bp.route("/webhooks/customers/redact", methods=["POST"])
def customers_redact():
    if not _validate_webhook():
        return "Unauthorized", 401
    # Return 200 OK to satisfy Shopify
    return "OK", 200

@webhook_bp.route("/webhooks/shop/redact", methods=["POST"])
def shop_redact():
    if not _validate_webhook():
        return "Unauthorized", 401
    
    data = request.json
    shop_domain = data.get("shop_domain")
    
    if shop_domain:
        # Erase all merchant data within 48 hours of request
        execute("DELETE FROM SHOPIFY_STORES WHERE SHOP = %s", (shop_domain,))
        
    return "OK", 200
