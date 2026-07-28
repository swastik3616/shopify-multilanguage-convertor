import os
import hmac
import hashlib
import secrets
from urllib.parse import urlencode

import requests
from flask import Blueprint, request, jsonify, redirect, session, current_app
from models.merchant import db, Merchant
from utils.helpers import validate_shopify_shop, verify_shopify_hmac, encrypt_token, normalize_shopify_store_url

auth_bp = Blueprint("auth_v2", __name__)


@auth_bp.route("/auth/install", methods=["GET"])
def install():
    shop = request.args.get("shop")
    if not validate_shopify_shop(shop):
        return jsonify({"error": "Invalid shop domain. Must be *.myshopify.com"}), 400

    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state

    redirect_uri = current_app.config["SHOPIFY_REDIRECT_URI"]
    scopes = current_app.config["SHOPIFY_SCOPES"]
    client_id = current_app.config["SHOPIFY_API_KEY"]

    auth_url = (
        f"https://{shop}/admin/oauth/authorize?"
        f"client_id={client_id}&scope={scopes}&redirect_uri={redirect_uri}&state={state}"
    )
    return redirect(auth_url)


@auth_bp.route("/auth/callback", methods=["GET"])
def callback():
    shop = request.args.get("shop")
    code = request.args.get("code")
    state = request.args.get("state")
    hmac_param = request.args.get("hmac")

    if not validate_shopify_shop(shop):
        return jsonify({"error": "Invalid shop domain"}), 400

    if not state or state != session.pop("oauth_state", None):
        return jsonify({"error": "Invalid state parameter — possible CSRF"}), 403

    query_params = request.args.to_dict()
    secret = current_app.config["SHOPIFY_API_SECRET"]
    if not verify_shopify_hmac(query_params, secret):
        return jsonify({"error": "Invalid HMAC signature"}), 401

    resp = requests.post(
        f"https://{shop}/admin/oauth/access_token",
        json={
            "client_id": current_app.config["SHOPIFY_API_KEY"],
            "client_secret": secret,
            "code": code,
        },
        timeout=30,
    )

    if not resp.ok:
        return jsonify({"error": "Token exchange failed", "detail": resp.text}), resp.status_code

    access_token = resp.json().get("access_token", "")
    if not access_token:
        return jsonify({"error": "No access_token in response"}), 500

    encrypted = encrypt_token(access_token)
    shop_normalized = normalize_shopify_store_url(shop)

    merchant = Merchant.query.filter_by(shop_domain=shop_normalized).first()
    if merchant:
        merchant.access_token = encrypted
    else:
        merchant = Merchant(shop_domain=shop_normalized, access_token=encrypted)
        db.session.add(merchant)
    db.session.commit()

    return jsonify({"message": "OAuth successful", "shop": shop_normalized}), 200
