from flask import Blueprint, jsonify, request
from database import execute
from utils.helpers import get_setting
import requests
import logging
import json
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
currency_bp = Blueprint("currency_routes", __name__)

CACHE_TTL_SECONDS = 3600

def get_api_key():
    flags = get_setting("feature_flags", {})
    return flags.get("currency_api_key", "")

def get_cached_rates(base_currency="USD"):
    row = execute(
        "SELECT VALUE FROM APP_SETTINGS WHERE KEY = 'currency_rates_cache' LIMIT 1",
        fetch="one",
    )
    if not row:
        return None

    try:
        cached = json.loads(row["VALUE"])
    except (TypeError, json.JSONDecodeError):
        return None

    updated_str = cached.get("updated_at")
    if not updated_str:
        return None

    try:
        updated = datetime.fromisoformat(updated_str)
    except (TypeError, ValueError):
        return None

    age = (datetime.now(timezone.utc) - updated).total_seconds()
    if age > CACHE_TTL_SECONDS:
        return None

    if cached.get("base_code") != base_currency:
        return None

    return cached.get("conversion_rates")


def set_cached_rates(base_currency, rates):
    payload = json.dumps({
        "base_code": base_currency,
        "conversion_rates": rates,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    existing = execute(
        "SELECT ID FROM APP_SETTINGS WHERE KEY = 'currency_rates_cache' LIMIT 1",
        fetch="one",
    )
    if existing:
        execute("UPDATE APP_SETTINGS SET VALUE = %s WHERE KEY = 'currency_rates_cache'", (payload,))
    else:
        execute(
            "INSERT INTO APP_SETTINGS (KEY, VALUE) VALUES ('currency_rates_cache', %s)",
            (payload,),
        )


@currency_bp.route("/currency/rates", methods=["GET", "OPTIONS"])
def get_rates():
    if request.method == "OPTIONS":
        return "", 204

    base = request.args.get("base", "USD").upper()
    rates = get_cached_rates(base)
    from_cache = True

    if not rates:
        api_key = get_api_key()
        if not api_key:
            return jsonify({"success": False, "message": "Currency API key not configured"}), 400

        try:
            resp = requests.get(
                f"https://v6.exchangerate-api.com/v6/{api_key}/latest/{base}",
                timeout=10,
            )
            data = resp.json()
            if data.get("result") != "success":
                return jsonify({"success": False, "message": data.get("error-type", "API error")}), 502

            rates = data.get("conversion_rates", {})
            set_cached_rates(base, rates)
            from_cache = False
        except requests.RequestException as e:
            return jsonify({"success": False, "message": f"Failed to fetch rates: {str(e)}"}), 502

    return jsonify({
        "success": True,
        "base": base,
        "rates": rates,
        "from_cache": from_cache,
    })


@currency_bp.route("/currency/convert", methods=["POST", "OPTIONS"])
def convert_currency():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json or {}
    amount = data.get("amount")
    from_currency = (data.get("from_currency") or "USD").upper()
    to_currency = (data.get("to_currency") or "").upper()

    if amount is None or not to_currency:
        return jsonify({"success": False, "message": "Missing amount or to_currency"}), 400

    if from_currency == to_currency:
        return jsonify({
            "success": True,
            "amount": amount,
            "from_currency": from_currency,
            "to_currency": to_currency,
            "rate": 1,
            "converted": amount,
        })

    rates = get_cached_rates(from_currency)
    if not rates:
        api_key = get_api_key()
        if not api_key:
            return jsonify({"success": False, "message": "Currency API key not configured"}), 400

        try:
            resp = requests.get(
                f"https://v6.exchangerate-api.com/v6/{api_key}/latest/{from_currency}",
                timeout=10,
            )
            data = resp.json()
            if data.get("result") != "success":
                return jsonify({"success": False, "message": data.get("error-type", "API error")}), 502
            rates = data.get("conversion_rates", {})
            set_cached_rates(from_currency, rates)
        except requests.RequestException as e:
            return jsonify({"success": False, "message": f"Failed to fetch rates: {str(e)}"}), 502

    rate = rates.get(to_currency)
    if rate is None:
        return jsonify({"success": False, "message": f"Currency '{to_currency}' not found"}), 400

    converted = round(float(amount) * rate, 2)

    return jsonify({
        "success": True,
        "amount": amount,
        "from_currency": from_currency,
        "to_currency": to_currency,
        "rate": rate,
        "converted": converted,
    })


@currency_bp.route("/currency/map", methods=["GET", "OPTIONS"])
def get_currency_map():
    if request.method == "OPTIONS":
        return "", 204

    flags = get_setting("feature_flags", {"currency_enabled": False})

    from routes.settings_routes import DEFAULT_CURRENCY_MAP
    currency_map = flags.get("currency_map", DEFAULT_CURRENCY_MAP)

    return jsonify({
        "success": True,
        "enabled": flags.get("currency_enabled", False),
        "currency_map": currency_map,
    })
