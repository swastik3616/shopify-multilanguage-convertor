from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

language_settings = {}

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

if __name__ == "__main__":
    app.run(debug=True, port=5000)