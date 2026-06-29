from flask import Blueprint, jsonify, request
from database import db
from model import Translation, AuditLog
from utils.helpers import get_setting, get_default_provider_settings
from utils.ai_provider import get_provider_response, get_bulk_provider_response
import requests

translation_bp = Blueprint("translation_routes", __name__)


@translation_bp.route("/bulk-translate", methods=["POST", "OPTIONS"])
def bulk_translate():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    texts = data.get("texts", [])
    target_language = data.get("target_language", "")

    if not texts or not target_language:
        return jsonify({"success": False, "message": "Missing texts or language"}), 400

    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    provider = provider_settings.get("provider", "openai")
    model = provider_settings.get("model", "gpt-3.5-turbo")
    api_key = provider_settings["api_keys"].get(provider, "")

    # ── Step 1: Translation Cache Lookup ──────────────────────────────────
    cached_map = {}
    uncached_indices = []
    db_cache = {}
    chunk_size = 500
    unique_texts = list(set(texts))

    for i in range(0, len(unique_texts), chunk_size):
        chunk = unique_texts[i:i + chunk_size]
        existing = Translation.query.filter(
            Translation.target_language == target_language,
            Translation.source_text.in_(chunk)
        ).all()
        for t in existing:
            db_cache[t.source_text] = t.translated_text

    for i, text in enumerate(texts):
        if text in db_cache:
            cached_map[i] = db_cache[text]
        else:
            uncached_indices.append(i)

    cache_hits = len(texts) - len(uncached_indices)
    print(f"[bulk-translate] cache={cache_hits}/{len(texts)} hits | need_ai={len(uncached_indices)} | lang='{target_language}'")

    # ── Step 2: Call AI only for uncached texts ───────────────────────────
    if uncached_indices:
        uncached_dict = {
            str(j): texts[orig_idx]
            for j, orig_idx in enumerate(uncached_indices)
        }

        try:
            translated_dict = get_bulk_provider_response(
                provider, model, api_key, uncached_dict, target_language
            )
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 500

        for j, orig_idx in enumerate(uncached_indices):
            source = texts[orig_idx]
            translated = translated_dict.get(str(j), source)
            cached_map[orig_idx] = translated
            db.session.add(Translation(
                source_text=source,
                target_language=target_language,
                translated_text=translated
            ))

        db.session.commit()

    # ── Step 3: Rebuild final ordered list ───────────────────────────────
    translated_texts = [cached_map.get(i, texts[i]) for i in range(len(texts))]

    return jsonify({
        "translations": translated_texts,
        "cache_hits": cache_hits,
        "api_calls": len(uncached_indices)
    })


@translation_bp.route("/translate", methods=["POST", "OPTIONS"])
def translate_text():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    source_text = data.get("source_text", "")
    target_language = data.get("target_language", "")

    if not source_text or not target_language:
        return jsonify({"success": False, "message": "Missing text or language"}), 400

    existing = Translation.query.filter_by(
        source_text=source_text,
        target_language=target_language
    ).first()

    if existing:
        return jsonify({"translated_text": existing.translated_text})

    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    provider = provider_settings.get("provider", "openai")
    model = provider_settings.get("model", "gpt-3.5-turbo")
    api_key = provider_settings["api_keys"].get(provider, "")

    try:
        translated_text = get_provider_response(provider, model, api_key, source_text, target_language)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    db.session.add(Translation(
        source_text=source_text,
        target_language=target_language,
        translated_text=translated_text
    ))
    db.session.commit()

    return jsonify({"translated_text": translated_text})


@translation_bp.route("/fetch-url", methods=["POST", "OPTIONS"])
@translation_bp.route("/api/fetch-url", methods=["POST", "OPTIONS"])
def fetch_url_content():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"success": False, "message": "URL is required"}), 400

    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; ShopifyTranslatorBot/1.0; +content-fetch)"
        }
        resp = requests.get(url, headers=headers, timeout=12)
        resp.raise_for_status()
        html = resp.text
        MAX_HTML_LENGTH = 500_000
        if len(html) > MAX_HTML_LENGTH:
            html = html[:MAX_HTML_LENGTH]

        return jsonify({"success": True, "html": html})
    except Exception as e:
        return jsonify({"success": False, "message": f"Unable to fetch content: {str(e)}"}), 500


@translation_bp.route("/translations", methods=["GET"])
def get_translations():
    records = Translation.query.all()
    return jsonify([{
        "id": item.id,
        "source_text": item.source_text,
        "target_language": item.target_language,
        "translated_text": item.translated_text
    } for item in records])


@translation_bp.route("/translations/<int:translation_id>", methods=["PUT", "OPTIONS"])
def update_translation(translation_id):
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    translation = Translation.query.get(translation_id)

    if not translation:
        return jsonify({"success": False, "message": "Translation not found"}), 404

    translation.translated_text = data.get("translated_text", translation.translated_text)
    db.session.commit()

    db.session.add(AuditLog(action=f"Translation Updated: {translation_id}"))
    db.session.commit()

    return jsonify({"success": True, "message": "Translation updated", "id": translation.id})


@translation_bp.route("/translations/<int:translation_id>", methods=["DELETE", "OPTIONS"])
def delete_translation(translation_id):
    if request.method == "OPTIONS":
        return "", 204

    translation = Translation.query.get(translation_id)

    if not translation:
        return jsonify({"success": False, "message": "Translation not found"}), 404

    db.session.delete(translation)
    db.session.commit()

    db.session.add(AuditLog(action=f"Translation Deleted: {translation_id}"))
    db.session.commit()

    return jsonify({"success": True, "message": "Translation deleted"})
