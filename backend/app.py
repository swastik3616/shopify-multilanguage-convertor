from dotenv import load_dotenv
load_dotenv()

import os
from flask import Flask, jsonify
from flask_cors import CORS

# Blueprints
from routes.auth_routes import auth_bp
from routes.translation_routes import translation_bp
from routes.content_routes import content_bp
from routes.settings_routes import settings_bp
from routes.dashboard_routes import dashboard_bp
from routes.seo_routes import seo_bp
from routes.overlay_routes import overlay_bp

print("DATABASE_URL =", os.getenv("DATABASE_URL"))

app = Flask(__name__)

CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    allow_headers=["Content-Type", "X-Shopify-Shop-Domain", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    supports_credentials=False,
)

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(translation_bp)
app.register_blueprint(content_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(seo_bp)
app.register_blueprint(overlay_bp)

# ── Ensure PROVIDER_SETTINGS table exists (idempotent) ────────────────────────
try:
    from database import execute as _execute
    _execute("""
        CREATE TABLE IF NOT EXISTS PROVIDER_SETTINGS (
            ID SERIAL PRIMARY KEY,
            PROVIDER VARCHAR(50) NOT NULL UNIQUE,
            MODEL VARCHAR(100) NOT NULL,
            API_KEY TEXT NOT NULL DEFAULT '',
            UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
except Exception as _e:
    print(f"[startup] PROVIDER_SETTINGS table check failed: {_e}")


@app.route("/")
def home():
    return jsonify({"message": "Shopify Translator Backend Running"})


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