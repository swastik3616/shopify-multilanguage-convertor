from urllib.parse import urlencode

from flask import Blueprint, request, jsonify, current_app
from models.merchant import db, Merchant
from models.subscription import Subscription
from services.shopify import create_subscription, get_active_subscriptions
from utils.helpers import validate_shopify_shop

billing_bp = Blueprint("billing", __name__)


@billing_bp.route("/billing/create-subscription", methods=["POST"])
def create_subscription_route():
    data = request.get_json(silent=True) or {}
    shop = data.get("shop", "").strip()
    plan = data.get("plan", "").strip().upper()

    if not validate_shopify_shop(shop):
        return jsonify({"error": "Invalid shop domain"}), 400

    plans = current_app.config["PLANS"]
    if plan not in plans:
        return jsonify({"error": f"Invalid plan. Must be one of: {', '.join(plans.keys())}"}), 400

    merchant = Merchant.query.filter_by(shop_domain=shop).first()
    if not merchant:
        return jsonify({"error": "Merchant not found. Install the app first."}), 404

    if plan == "FREE":
        sub = Subscription.query.filter_by(shop_domain=shop).first()
        if sub:
            sub.plan_name = "FREE"
            sub.status = "ACTIVE"
        else:
            sub = Subscription(shop_domain=shop, plan_name="FREE", status="ACTIVE")
            db.session.add(sub)
        db.session.commit()
        return jsonify({"plan": "FREE", "status": "ACTIVE", "message": "Free plan activated"}), 200

    plan_config = plans[plan]
    return_url = request.host_url.rstrip("/") + "/billing/callback?" + urlencode({"shop": shop, "plan": plan})

    try:
        confirmation_url = create_subscription(
            shop_domain=shop,
            encrypted_token=merchant.access_token,
            plan_name=plan,
            plan_config=plan_config,
            return_url=return_url,
        )
        return jsonify({"confirmationUrl": confirmation_url}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@billing_bp.route("/billing/callback", methods=["GET"])
def billing_callback():
    shop = request.args.get("shop")
    plan = request.args.get("plan", "").upper()

    if not validate_shopify_shop(shop):
        return jsonify({"error": "Invalid shop domain"}), 400

    merchant = Merchant.query.filter_by(shop_domain=shop).first()
    if not merchant:
        return jsonify({"error": "Merchant not found"}), 404

    try:
        subscriptions = get_active_subscriptions(shop, merchant.access_token)
    except Exception as e:
        return jsonify({"error": f"Failed to verify subscription: {str(e)}"}), 500

    matched = None
    for sub in subscriptions:
        matched = sub
        break

    if not matched:
        return jsonify({"error": "No active subscription found in Shopify"}), 404

    shopify_sub_id = matched["id"].split("/")[-1]

    existing = Subscription.query.filter_by(shop_domain=shop).first()
    if existing:
        existing.plan_name = plan
        existing.shopify_subscription_id = shopify_sub_id
        existing.status = "ACTIVE"
    else:
        sub = Subscription(
            shop_domain=shop,
            plan_name=plan,
            shopify_subscription_id=shopify_sub_id,
            status="ACTIVE",
        )
        db.session.add(sub)
    db.session.commit()

    return jsonify({
        "message": "Subscription activated",
        "plan": plan,
        "shopify_subscription_id": shopify_sub_id,
    }), 200


@billing_bp.route("/subscription/status/<shop>", methods=["GET"])
def subscription_status(shop):
    if not validate_shopify_shop(shop):
        return jsonify({"error": "Invalid shop domain"}), 400

    subscription = Subscription.query.filter_by(shop_domain=shop).first()
    if not subscription:
        return jsonify({"plan": "FREE", "status": "ACTIVE"}), 200

    return jsonify({
        "plan": subscription.plan_name,
        "status": subscription.status,
    }), 200
