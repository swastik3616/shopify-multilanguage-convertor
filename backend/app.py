from dotenv import load_dotenv
load_dotenv()

import os
import flask
from flask import Flask, jsonify, request
from config import Config
from models.merchant import db
from models.subscription import Subscription
import sqlalchemy as sa
import logging
import time
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[FlaskIntegration()],
    traces_sample_rate=1.0,
)

# Blueprints
from routes.auth_routes import auth_bp
from routes.translation_routes import translation_bp
from routes.content_routes import content_bp
from routes.settings_routes import settings_bp
from routes.dashboard_routes import dashboard_bp
from routes.seo_routes import seo_bp
from routes.overlay_routes import overlay_bp
from routes.webhook_routes import webhook_bp
from routes.search_routes import search_bp
from routes.currency_routes import currency_bp

# New billing / auth / webhook blueprints
from routes.auth import auth_bp as auth_v2_bp
from routes.billing import billing_bp
from routes.webhook import webhook_bp as webhooks_v2_bp


#Add Structure Logging 
from pythonjsonlogger import jsonlogger
from prometheus_flask_exporter import PrometheusMetrics
logger = logging.getLogger()

handler = logging.StreamHandler()
handler.setFormatter(jsonlogger.JsonFormatter())

logger.addHandler(handler)
logger.setLevel(logging.INFO)

print("DATABASE_URL =", os.getenv("DATABASE_URL"))

app = Flask(__name__)
app.config.from_object(Config)
metrics = PrometheusMetrics(app)

@app.route("/test")
def test():
    logger.info("Login API called")
    return {"status": "success"}

@app.before_request
def before():
    request.start_time = time.perf_counter()

@app.after_request
def after(response):
    duration = time.perf_counter() - request.start_time
    logger.info(
    "Request completed",
    extra={
        "path": request.path,
        "method": request.method,
        "status": response.status_code,
        "duration_ms": round(duration * 1000, 2)
    }
)
    return response


# Flask-SQLAlchemy
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///dev.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.secret_key = app.config["FLASK_SECRET_KEY"]
db.init_app(app)

with app.app_context():
    inspector = sa.inspect(db.engine)
    tables = inspector.get_table_names()
    if "merchants" not in tables or "subscriptions" not in tables:
        db.create_all()
        print("Created merchants and subscriptions tables")

_CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGIN", "*").split(",") if o.strip()]

def _get_cors_origin():
    origin = request.headers.get("Origin", "")
    if "*" in _CORS_ORIGINS:
        return origin if origin else "*"
    if origin in _CORS_ORIGINS:
        return origin
    return _CORS_ORIGINS[0] if _CORS_ORIGINS else "*"

_ALWAYS_HEADERS = "Content-Type, X-Shopify-Shop-Domain, Authorization, ngrok-skip-browser-warning"
_ALWAYS_METHODS = "GET, POST, PUT, DELETE, OPTIONS"

@app.after_request
def add_cors_headers(response):
    origin = _get_cors_origin()
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Headers"] = _ALWAYS_HEADERS
    response.headers["Access-Control-Allow-Methods"] = _ALWAYS_METHODS
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        resp = flask.make_response("", 204)
        origin = _get_cors_origin()
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Access-Control-Allow-Headers"] = _ALWAYS_HEADERS
        resp.headers["Access-Control-Allow-Methods"] = _ALWAYS_METHODS
        resp.headers["Access-Control-Max-Age"] = "86400"
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        return resp

from werkzeug.exceptions import HTTPException
import traceback

@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        response = e.get_response()
    else:
        tb = traceback.format_exc()
        response = jsonify({"success": False, "message": "Internal Server Error", "error": str(e), "traceback": tb})
        response.status_code = 500
    # Flask after_request will handle CORS for this response automatically
    return response

# Register existing blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(translation_bp)
app.register_blueprint(content_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(seo_bp)
app.register_blueprint(overlay_bp)
app.register_blueprint(webhook_bp)
app.register_blueprint(search_bp)
app.register_blueprint(currency_bp)

# Register new billing / auth / webhook blueprints
app.register_blueprint(auth_v2_bp)
app.register_blueprint(billing_bp)
app.register_blueprint(webhooks_v2_bp)

try:
    from database import execute as _execute
    _execute("""
        CREATE TABLE IF NOT EXISTS AI_PROVIDERS (
            ID SERIAL PRIMARY KEY,
            PROVIDER_NAME VARCHAR(50) NOT NULL UNIQUE,
            BASE_URL VARCHAR(255) NOT NULL,
            ENDPOINT VARCHAR(255) NOT NULL,
            METHOD VARCHAR(10) NOT NULL DEFAULT 'POST',
            AUTH_TYPE VARCHAR(50) NOT NULL,
            AUTH_HEADER VARCHAR(100),
            API_KEY TEXT,
            REQUEST_TEMPLATE TEXT NOT NULL,
            RESPONSE_MAPPING VARCHAR(255) NOT NULL,
            HEADERS TEXT,
            MODEL VARCHAR(100),
            TIMEOUT INTEGER DEFAULT 60,
            STREAMING_SUPPORTED BOOLEAN DEFAULT FALSE,
            IS_ACTIVE BOOLEAN DEFAULT FALSE,
            UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    count = _execute("SELECT COUNT(*) AS CNT FROM AI_PROVIDERS", fetch="one")
    if count and count["CNT"] == 0:
        req_tpl = '{"model": "{{model}}", "messages": [{"role": "user", "content": "{{prompt}}"}], "temperature": {{temperature}}}'
        headers_tpl = '{"Content-Type": "application/json"}'
        _execute("""
            INSERT INTO AI_PROVIDERS (
                PROVIDER_NAME, BASE_URL, ENDPOINT, METHOD, AUTH_TYPE, AUTH_HEADER, 
                REQUEST_TEMPLATE, RESPONSE_MAPPING, HEADERS, MODEL, IS_ACTIVE
            ) VALUES (
                'openai', 'https://api.openai.com', '/v1/chat/completions', 'POST', 'Bearer', 'Authorization',
                %s, 'choices[0].message.content', %s, 'gpt-3.5-turbo', TRUE
            )
        """, (req_tpl, headers_tpl))

        req_tpl_groq = '{"model": "{{model}}", "messages": [{"role": "system", "content": "You are a translation API. Always return ONLY valid JSON."}, {"role": "user", "content": "{{prompt}}"}], "temperature": 0, "max_tokens": {{max_tokens}}}'
        _execute("""
            INSERT INTO AI_PROVIDERS (
                PROVIDER_NAME, BASE_URL, ENDPOINT, METHOD, AUTH_TYPE, AUTH_HEADER, 
                REQUEST_TEMPLATE, RESPONSE_MAPPING, HEADERS, MODEL, IS_ACTIVE
            ) VALUES (
                'groq', 'https://api.groq.com', '/openai/v1/chat/completions', 'POST', 'Bearer', 'Authorization',
                %s, 'choices[0].message.content', %s, 'llama3-8b-8192', FALSE
            )
        """, (req_tpl_groq, headers_tpl))

        req_tpl_gemini = '{"contents": [{"parts": [{"text": "{{prompt}}"}]}]}'
        _execute("""
            INSERT INTO AI_PROVIDERS (
                PROVIDER_NAME, BASE_URL, ENDPOINT, METHOD, AUTH_TYPE, AUTH_HEADER, 
                REQUEST_TEMPLATE, RESPONSE_MAPPING, HEADERS, MODEL, IS_ACTIVE
            ) VALUES (
                'gemini', 'https://generativelanguage.googleapis.com', '/v1beta/models/{{model}}:generateContent?key={{api_key}}', 'POST', 'Query', '',
                %s, 'candidates[0].content.parts[0].text', %s, 'gemini-1.5-flash', FALSE
            )
        """, (req_tpl_gemini, headers_tpl))
except Exception as _e:
    print(f"[startup] AI_PROVIDERS table check failed: {_e}")


@app.route("/")
def home():
    return jsonify({"message": "Shopify Translator Backend Running"})


import os as _os

_STATICS = {
    "/storefront.js": _os.path.join(_os.path.dirname(__file__), "..", "frontend", "public", "storefront.js"),
    "/currency.js": _os.path.join(_os.path.dirname(__file__), "..", "frontend", "public", "currency.js"),
}

@app.route("/storefront.js")
@app.route("/currency.js")
def serve_storefront_script():
    path = _STATICS.get(request.path)
    if not path or not _os.path.isfile(path):
        return "Not Found", 404
    with open(path, "r", encoding="utf-8") as f:
        return flask.Response(f.read(), mimetype="application/javascript")


@app.route("/wake", methods=["GET", "OPTIONS"])
def wake():
    return jsonify({"status": "awake"})


@app.route("/stores")
def stores():
    from database import execute
    stores = execute("SELECT ID, SHOP FROM SHOPIFY_STORES", fetch="all") or []
    return jsonify([
        {
            "id": s["ID"],
            "shop": s["SHOP"]
        }
        for s in stores
    ])


@app.route("/debug-store")
def debug_store():
    from flask import request
    from database import execute

    shop = request.args.get("shop")
    store = execute("SELECT SHOP, ACCESS_TOKEN FROM SHOPIFY_STORES WHERE SHOP = %s LIMIT 1", (shop,), fetch="one")

    if not store:
        return jsonify({"found": False})

    return jsonify({
        "found": True,
        "shop": store["SHOP"],
        "token": store["ACCESS_TOKEN"]
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
