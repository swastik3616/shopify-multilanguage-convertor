from flask import Flask, jsonify, request
from flask_cors import CORS

from database import db
from model import Translation

app = Flask(__name__)

# ----------------------------

# Database Configuration

# ----------------------------

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///translator.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    db.create_all()

CORS(app)

# ----------------------------

# Temporary Settings Storage

# ----------------------------

language_settings = {}
provider_settings = {}

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

@app.route("/save-languages", methods=["POST"])
def save_languages():
    data = request.json

    language_settings["source"] = data["source_language"]
    language_settings["targets"] = data["target_languages"]

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

@app.route("/save-provider", methods=["POST"])
def save_provider():
    data = request.json

  
    provider_settings["provider"] = data["provider"]
    provider_settings["api_key"] = data["api_key"]

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


# ----------------------------

# Run Application

# ----------------------------

if __name__ == "__main__":
    app.run(debug=True, port=5000)
