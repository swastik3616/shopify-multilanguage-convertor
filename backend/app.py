from decorator import fix
from dotenv import load_dotenv
load_dotenv()

import os
from flask import Flask, jsonify
from flask_cors import CORS

from database import db

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
# ── Database (Snowflake) ────────────────────────────────────────────────────
db.init_app(app)   # no-op but keeps imports working

with app.app_context():
    try:
        db.create_all()   # creates Snowflake tables if missing
        print("[startup] Snowflake tables ready.")
    except Exception as e:
        print(f"[startup] WARNING: db.create_all() failed: {e}")

# Database configuration
db_url = os.getenv("DATABASE_URL", "sqlite:///translator.db")

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    db.create_all()

    # Import AFTER app has been created to avoid circular import
    from migrate_db import migrate
    migrate()


# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(translation_bp)
app.register_blueprint(content_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(seo_bp)
app.register_blueprint(overlay_bp)


@app.route("/")
def home():
    return jsonify({"message": "Shopify Translator Backend Running"})


@app.route("/wake", methods=["GET", "OPTIONS"])
def wake():
    return jsonify({"status": "awake"})


@app.route("/stores")
def stores():
    from model import ShopifyStore

    stores = ShopifyStore.query.all()

    return jsonify([
        {
            "id": s.id,
            "shop": s.shop
        }
        for s in stores
    ])


@app.route("/debug-store")
def debug_store():
    from flask import request
    from model import ShopifyStore

    shop = request.args.get("shop")
    store = ShopifyStore.query.filter_by(shop=shop).first()

    if not store:
        return jsonify({"found": False})

    return jsonify({
        "found": True,
        "shop": store.shop,
        "token": store.access_token
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)