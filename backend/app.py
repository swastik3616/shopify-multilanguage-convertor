from flask import Flask, jsonify, request
from flask_cors import CORS

from database import db
from model import Translation,AuditLog

app = Flask(__name__)

# ----------------------------

# Database Configuration

# ----------------------------

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///translator.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    db.create_all()

# Configure CORS
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type"]}})

# ----------------------------

# Temporary Settings Storage

# ----------------------------

language_settings = {}
provider_settings = {}
store_setting={}

# ----------------------------

# Home Route

# ----------------------------

@app.route("/")
def home():
    return jsonify({
    "message": "Shopify Translator Backend Running"
})

# ----------------------------

# Save Languages

# ----------------------------

@app.route("/save-languages", methods=["POST", "OPTIONS"])
def save_languages():
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json

    language_settings["source"] = data["source_language"]
    language_settings["targets"] = data["target_languages"]
    audit = AuditLog(
    action="Language Settings Updated"
)

    db.session.add(audit)
    db.session.commit()

    return jsonify({
    "success": True,
    "message": "Languages saved successfully"
})


# ----------------------------

# Get Languages

# ----------------------------

@app.route("/get-languages", methods=["GET"])
def get_languages():
    return jsonify(language_settings)

# ----------------------------

# Save Provider

# ----------------------------

@app.route("/save-provider", methods=["POST", "OPTIONS"])
def save_provider():
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json

  
    provider_settings["provider"] = data["provider"]
    provider_settings["api_key"] = data["api_key"]
    audit = AuditLog(
    action="Provider Updated"
)

    db.session.add(audit)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Provider saved successfully"
    })


# ----------------------------

# Translate Text

# ----------------------------

@app.route("/translate", methods=["POST"])
def translate_text():
    data = request.json


    source_text = data["source_text"]
    target_language = data["target_language"]

    translated_text = (
    f"{source_text} translated to {target_language}"
)

    translation = Translation(
    source_text=source_text,
    target_language=target_language,
    translated_text=translated_text
)

    db.session.add(translation)
    db.session.commit()

    return jsonify({
    "translated_text": translated_text
})


# ----------------------------

# Get All Translations

# ----------------------------

@app.route("/translations", methods=["GET"])
def get_translations():
    records = Translation.query.all()

    return jsonify([
    {
        "id": item.id,
        "source_text": item.source_text,
        "target_language": item.target_language,
        "translated_text": item.translated_text
    }
    for item in records
])

# ----------------------------

# Update Translation

# ----------------------------

@app.route("/update-translation", methods=["POST"])
def update_translation():
    data = request.json

    translation = Translation.query.get(data["id"])

    if not translation:
        return jsonify({
        "success": False,
        "message": "Translation not found"
    }), 404

    translation.translated_text = data["translated_text"]

    db.session.commit()

    return jsonify({
    "success": True,
    "message": "Translation updated successfully"
})



@app.route('/analytics', methods=['GET'])
def analytics():
    total_translations = Translation.query.count()
    last_translation = Translation.query.order_by(Translation.id.desc()).first()
    
    last_translation_data = None
    if last_translation:
        last_translation_data = {
            "id": last_translation.id,
            "source_text": last_translation.source_text,
            "target_language": last_translation.target_language,
            "translated_text": last_translation.translated_text
        }
    
    return jsonify({
        "total_translations": total_translations,
        "total_languages": len(language_settings.get("targets", [])),
        "providers": 1 if provider_settings else 0,
        "last_translation": last_translation_data or "No translations yet"
    })


@app.route("/audit-history", methods=["GET"])
def get_audit_history():

    logs = AuditLog.query.order_by(
        AuditLog.id.desc()
    ).all()

    return jsonify([
        {
            "id": log.id,
            "action": log.action,
            "created_at": str(log.created_at)
        }
        for log in logs
    ])
    
@app.route('/save-store-settings', methods=['POST', 'OPTIONS'])
def save_store_settings():
    if request.method == 'OPTIONS':
        return '', 204

    data = request.json

    print("Received Data:", data)

    store_setting["store_url"] = data["store_url"]
    store_setting["access_token"] = data["access_token"]

    print("Saved Settings:", store_setting)

    audit = AuditLog(
        action="Store Settings Updated"
    )

    db.session.add(audit)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Store settings saved successfully"
    })
    

@app.route("/get-store-settings", methods=['GET', 'OPTIONS'])
def get_store_settings():
    if request.method == 'OPTIONS':
        return '', 204
    
    return jsonify(store_setting)
# ----------------------------

# Run Application

# ----------------------------

if __name__ == "__main__":
    app.run(debug=True, port=5000)
