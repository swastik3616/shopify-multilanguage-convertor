from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

language_settings = {}
provider_settings = {}

@app.route("/")
def home():
    return jsonify({
        "message": "Shopify Translator Backend Running"
    })

@app.route("/save-languages", methods=["POST"])
def save_languages():
    data = request.json

    language_settings["source"] = data["source_language"]
    language_settings["targets"] = data["target_languages"]

    return jsonify({
        "success": True,
        "message": "Languages saved successfully"
    })

@app.route("/get-languages")
def get_languages():
    return jsonify(language_settings)

@app.route("/save-provider", methods=["POST"])
def save_provider():
    data = request.json

    provider_settings["provider"] = data["provider"]
    provider_settings["api_key"] = data["api_key"]

    return jsonify({
        "success": True,
        "message": "Provider saved successfully"
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)