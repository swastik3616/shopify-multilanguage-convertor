from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

language_settings = {}
provider_settings = {}
translations = []


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



@app.route("/translate", methods=["POST"])
def translate_text():
    data = request.json

    source_text = data["source_text"]
    target_language = data["target_language"]

    translated_text = (
        f"{source_text} translated to {target_language}"
    )

    translations.append({
        "source_text": source_text,
        "target_language": target_language,
        "translated_text": translated_text
    })

    return jsonify({
        "translated_text": translated_text
    })
    
@app.route("/translations", methods=["GET"])
def get_translations():
    return jsonify(translations)


@app.route("/update-translation", methods=["POST"])
def update_translation():
    data = request.json

    index = data["index"]
    translated_text = data["translated_text"]

    translations[index]["translated_text"] = translated_text

    return jsonify({
        "success": True,
        "message": "Translation updated"
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)