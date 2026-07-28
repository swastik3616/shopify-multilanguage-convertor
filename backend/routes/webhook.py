import os
from flask import Blueprint, request, jsonify, current_app
from models.merchant import db, Merchant
from models.subscription import Subscription
from utils.helpers import verify_webhook_hmac

webhook_bp = Blueprint("webhooks_v2", __name__)


def _validate_webhook():
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    raw_data = request.get_data()
    secret = current_app.config["SHOPIFY_API_SECRET"]
    if not verify_webhook_hmac(raw_data, hmac_header, secret):
        return False
    return True


@webhook_bp.route("/webhooks/app/uninstalled", methods=["POST"])
def app_uninstalled():
    if not _validate_webhook():
        return "Unauthorized", 401

    data = request.json or {}
    shop_domain = data.get("domain", "")

    if shop_domain:
        sub = Subscription.query.filter_by(shop_domain=shop_domain).first()
        if sub:
            sub.status = "UNINSTALLED"
        merchant = Merchant.query.filter_by(shop_domain=shop_domain).first()
        if merchant:
            merchant.access_token = ""
        db.session.commit()

    return "OK", 200


@webhook_bp.route("/webhooks/app_subscriptions/update", methods=["POST"])
def app_subscriptions_update():
    if not _validate_webhook():
        return "Unauthorized", 401

    data = request.json or {}
    shop_domain = request.headers.get("X-Shopify-Shop-Domain", "")

    sub = Subscription.query.filter_by(shop_domain=shop_domain).first()
    if sub:
        status = data.get("status", sub.status)
        sub.status = status.upper()
        db.session.commit()

    return "OK", 200


@webhook_bp.route("/webhooks/customers/data_request", methods=["POST"])
def customers_data_request():
    if not _validate_webhook():
        return "Unauthorized", 401
    return "OK", 200


@webhook_bp.route("/webhooks/customers/redact", methods=["POST"])
def customers_redact():
    if not _validate_webhook():
        return "Unauthorized", 401
    return "OK", 200


@webhook_bp.route("/webhooks/shop/redact", methods=["POST"])
def shop_redact():
    if not _validate_webhook():
        return "Unauthorized", 401

    data = request.json or {}
    shop_domain = data.get("shop_domain", "")

    if shop_domain:
        Merchant.query.filter_by(shop_domain=shop_domain).delete()
        Subscription.query.filter_by(shop_domain=shop_domain).delete()
        db.session.commit()

    return "OK", 200
