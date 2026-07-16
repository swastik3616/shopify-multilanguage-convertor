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
# Added secret key for secure Flask sessions (required for OAuth state verification)
app.secret_key = os.getenv("FLASK_SECRET_KEY", os.urandom(24))

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

# ── Ensure AI_PROVIDERS table exists (idempotent) ────────────────────────
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