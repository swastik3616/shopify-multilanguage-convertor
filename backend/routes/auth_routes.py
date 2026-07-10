import os
import requests
from flask import Blueprint, jsonify, request, redirect
from database import execute
from utils.helpers import (
    get_shop_from_request,
    get_current_store,
    normalize_shopify_store_url,
    get_shopify_credentials,
    _mask_token,
)

auth_bp = Blueprint("auth_routes", __name__)


@auth_bp.route("/shopify/check-token", methods=["GET"])
def shopify_check_token():
    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return jsonify({"connected": False, "message": "No Shopify store or access token configured."}), 400

    try:
        headers = {"X-Shopify-Access-Token": access_token}
        res = requests.get(f"https://{store_url}/admin/api/2026-04/shop.json", headers=headers, timeout=10)
        try:
            body = res.json()
        except Exception:
            body = res.text[:200]

        return jsonify({
            "connected": res.ok,
            "status_code": res.status_code,
            "response": body,
            "store_url": store_url,
            "masked_token": _mask_token(access_token),
        }), (200 if res.ok else 401)
    except Exception as e:
        print("Shopify check-token error:", str(e))
        return jsonify({"connected": False, "message": str(e)}), 500


@auth_bp.route("/shopify/test")
def shopify_test():
    shop = get_shop_from_request()
    store = get_current_store(shop)
    if not store:
        return jsonify({"success": False, "message": "No Shopify store connected for this shop"}), 404

    headers = {"X-Shopify-Access-Token": store["ACCESS_TOKEN"]}
    response = requests.get(f"https://{store['SHOP']}/admin/api/2026-04/shop.json", headers=headers)
    return jsonify(response.json())


@auth_bp.route("/install")
def install():
    shop = request.args.get("shop")
    install_url = (
        f"https://{shop}/admin/oauth/authorize"
        f"?client_id={os.getenv('SHOPIFY_CLIENT_ID')}"
        f"&scope={os.getenv('SHOPIFY_SCOPES')}"
        f"&redirect_uri={os.getenv('SHOPIFY_REDIRECT_URI')}"
    )
    return redirect(install_url)


@auth_bp.route("/auth/callback")
def auth_callback():
    shop = request.args.get("shop")
    code = request.args.get("code")

    response = requests.post(
        f"https://{shop}/admin/oauth/access_token",
        json={
            "client_id": os.getenv("SHOPIFY_CLIENT_ID"),
            "client_secret": os.getenv("SHOPIFY_CLIENT_SECRET"),
            "code": code,
        },
    )

    token_data = response.json()
    atok = token_data.get("access_token", "")
    if isinstance(atok, str) and atok.startswith('"') and atok.endswith('"'):
        atok = atok[1:-1]
    if isinstance(atok, str) and atok.lower().startswith("bearer "):
        atok = atok.split(None, 1)[1]

    shop_normalized = normalize_shopify_store_url(shop)
    existing = execute(
        "SELECT ID FROM SHOPIFY_STORES WHERE SHOP = %s LIMIT 1",
        (shop_normalized,),
        fetch="one",
    )
    if existing:
        execute(
            "UPDATE SHOPIFY_STORES SET ACCESS_TOKEN = %s WHERE SHOP = %s",
            (atok, shop_normalized),
        )
    else:
        execute(
            "INSERT INTO SHOPIFY_STORES (SHOP, ACCESS_TOKEN) VALUES (%s, %s)",
            (shop_normalized, atok),
        )

    return "Installation successful! You can now close this tab and return to the app."
