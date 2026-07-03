from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify
from flask_cors import CORS
import os

from database import db

# ── Import Blueprints ────────────────────────────────────────────────────────
from routes.auth_routes import auth_bp
from routes.translation_routes import translation_bp
from routes.content_routes import content_bp
from routes.settings_routes import settings_bp
from routes.dashboard_routes import dashboard_bp
from routes.seo_routes import seo_bp
from routes.overlay_routes import overlay_bp

# ── App Factory ───────────────────────────────────────────────────────────────
app = Flask(__name__)

CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    allow_headers=["Content-Type", "X-Shopify-Shop-Domain", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    supports_credentials=False,
)

# ── Database ──────────────────────────────────────────────────────────────────
db_url = os.getenv("DATABASE_URL", "sqlite:///translator.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    db.create_all()
    
    # Auto-run basic migrations to add missing columns if they don't exist
    from migrate_db import migrate
    migrate()

# ── Register Blueprints ───────────────────────────────────────────────────────
app.register_blueprint(auth_bp)
app.register_blueprint(translation_bp)
app.register_blueprint(content_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(seo_bp)
app.register_blueprint(overlay_bp)

# ── Core Routes ───────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return jsonify({"message": "Shopify Translator Backend Running"})

@app.route("/wake", methods=["GET", "OPTIONS"])
def wake():
    """Pre-warm the server on cold start (called by the storefront widget)."""
    return jsonify({"status": "awake"})

@app.route("/stores")
def stores():
    from model import ShopifyStore
    all_stores = ShopifyStore.query.all()
    return jsonify([{"id": s.id, "shop": s.shop} for s in all_stores])

@app.route("/debug-store")
def debug_store():
    from flask import request
    from model import ShopifyStore
    shop = request.args.get("shop")
    store = ShopifyStore.query.filter_by(shop=shop).first()
    if not store:
        return jsonify({"found": False})
    return jsonify({"found": True, "shop": store.shop, "token": store.access_token})

# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)