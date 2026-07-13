from flask import Blueprint, jsonify, request
from database import execute
from utils.helpers import get_setting, get_default_provider_settings, get_provider_settings
from utils.ai_provider import get_provider_response, get_bulk_provider_response
from utils.translation_filter import TranslationFilter
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

    provider_settings = get_provider_settings()
    provider = provider_settings.get("provider", "openai")
    model = provider_settings.get("model", "gpt-3.5-turbo")
    api_key = provider_settings.get("api_keys", {}).get(provider, "")

    skip_indices = {}
    for i, text in enumerate(texts):
        if TranslationFilter.should_skip(text):
            skip_indices[i] = text

    db_cache = {}
    chunk_size = 500
    unique_texts = list(set(texts))

    for i in range(0, len(unique_texts), chunk_size):
        chunk = unique_texts[i : i + chunk_size]
        placeholders = ", ".join(["%s"] * len(chunk))
        rows = execute(
            f"SELECT SOURCE_TEXT, TRANSLATED_TEXT FROM TRANSLATIONS "
            f"WHERE TARGET_LANGUAGE = %s AND SOURCE_TEXT IN ({placeholders})",
            (target_language, *chunk),
            fetch="all",
        ) or []
        for r in rows:
            db_cache[r["SOURCE_TEXT"]] = r["TRANSLATED_TEXT"]

    cached_map = {}
    uncached_indices = []

    for i, text in enumerate(texts):
        if i in skip_indices:
            cached_map[i] = text
        elif text in db_cache:
            cached_map[i] = db_cache[text]
        else:
            uncached_indices.append(i)

    cache_hits = len(texts) - len(uncached_indices) - len(skip_indices)
    print(
        f"[bulk-translate] cache={cache_hits}/{len(texts)} hits | "
        f"skipped={len(skip_indices)} | need_ai={len(uncached_indices)} | lang='{target_language}'"
    )

    if uncached_indices:
        uncached_dict = {str(j): texts[orig_idx] for j, orig_idx in enumerate(uncached_indices)}

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
            execute(
                "INSERT INTO TRANSLATIONS (SOURCE_TEXT, TARGET_LANGUAGE, TRANSLATED_TEXT, CREATED_AT) "
                "VALUES (%s, %s, %s, CURRENT_TIMESTAMP())",
                (source, target_language, translated),
            )

    translated_texts = [cached_map.get(i, texts[i]) for i in range(len(texts))]

    return jsonify({
        "translations": translated_texts,
        "cache_hits": cache_hits,
        "api_calls": len(uncached_indices),
        "skipped": len(skip_indices),
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

    if TranslationFilter.should_skip(source_text):
        print(f"[translate] Skipping non-translatable text: {source_text}")
        return jsonify({"translated_text": source_text, "skipped": True})

    existing = execute(
        "SELECT TRANSLATED_TEXT FROM TRANSLATIONS "
        "WHERE SOURCE_TEXT = %s AND TARGET_LANGUAGE = %s LIMIT 1",
        (source_text, target_language),
        fetch="one",
    )
    if existing:
        return jsonify({"translated_text": existing["TRANSLATED_TEXT"], "cached": True})

    provider_settings = get_provider_settings()
    provider = provider_settings.get("provider", "openai")
    model = provider_settings.get("model", "gpt-3.5-turbo")
    api_key = provider_settings.get("api_keys", {}).get(provider, "")

    try:
        translated_text = get_provider_response(provider, model, api_key, source_text, target_language)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    execute(
        "INSERT INTO TRANSLATIONS (SOURCE_TEXT, TARGET_LANGUAGE, TRANSLATED_TEXT, CREATED_AT) "
        "VALUES (%s, %s, %s, CURRENT_TIMESTAMP())",
        (source_text, target_language, translated_text),
    )

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
        from bs4 import BeautifulSoup
        import re as _re
        import time
        from urllib.parse import urlparse, urlencode, parse_qsl

        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; ShopifyTranslatorBot/1.0; +content-fetch)",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        }
        parsed = urlparse(url)
        query_params = parse_qsl(parsed.query)
        query_params.append(("_nocache", str(int(time.time() * 1000))))
        fetch_url = parsed._replace(query=urlencode(query_params)).geturl()
        session = requests.Session()
        resp = session.get(fetch_url, headers=headers, timeout=12)
        resp.raise_for_status()
        html = resp.text

        looks_like_password_gate = (
            'name="password"' in html
            or 'id="password"' in html
            or "/password" in (resp.url or "")
            or "storefront_password" in html.lower()
        )

        if looks_like_password_gate:
            store_password = get_setting("store_password", "")
            origin = f"{parsed.scheme}://{parsed.netloc}"
            if store_password:
                session.post(
                    f"{origin}/password",
                    data={"form_type": "storefront_password", "password": store_password},
                    headers=headers,
                    timeout=12,
                    allow_redirects=True,
                )
                resp = session.get(fetch_url, headers=headers, timeout=12)
                resp.raise_for_status()
                html = resp.text

                still_gated = (
                    'name="password"' in html
                    or 'id="password"' in html
                    or "storefront_password" in html.lower()
                )
                if still_gated:
                    return jsonify({
                        "success": False,
                        "message": (
                            "This store is password-protected and the configured "
                            "store password didn't unlock it."
                        ),
                    }), 401
            else:
                return jsonify({
                    "success": False,
                    "message": (
                        "This store is password-protected. Add the store's storefront "
                        "password in Settings."
                    ),
                }), 401

        cache_debug = {
            "age": resp.headers.get("Age"),
            "cache-control": resp.headers.get("Cache-Control"),
            "x-cache": resp.headers.get("X-Cache"),
            "cf-cache-status": resp.headers.get("CF-Cache-Status"),
        }

        MAX_HTML_LENGTH = 500_000
        if len(html) > MAX_HTML_LENGTH:
            html = html[:MAX_HTML_LENGTH]
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup.find_all(["header", "footer", "nav", "aside"]):
            tag.decompose()
        CHROME_RE = _re.compile(
            r"(^|[-_])(site-header|site-footer|site-nav|mobile-nav|mobile-menu|"
            r"cart-drawer|cart-notification|language-switcher|currency-switcher|"
            r"facets?|facet-filters?|active-facets|sort-by|filter-drawer|"
            r"cookie-banner|gdpr-banner|skip-to-content)([-_]|$)",
            _re.IGNORECASE,
        )
        for el in soup.find_all(True):
            if el.parent is None:
                continue
            el_id = el.get("id", "") or ""
            el_cls = " ".join(el.get("class", []) or [])
            if CHROME_RE.search(el_id) or CHROME_RE.search(el_cls):
                el.decompose()
        main_tag = soup.find("main") or soup.find("body") or soup
        cleaned_html = str(main_tag)

        return jsonify({"success": True, "html": cleaned_html, "_cache_debug": cache_debug})
    except Exception as e:
        return jsonify({"success": False, "message": f"Unable to fetch content: {str(e)}"}), 500


@translation_bp.route("/translations", methods=["GET"])
def get_translations():
    rows = execute(
        "SELECT ID, SOURCE_TEXT, TARGET_LANGUAGE, TRANSLATED_TEXT FROM TRANSLATIONS",
        fetch="all",
    ) or []
    return jsonify([{
        "id": r["ID"],
        "source_text": r["SOURCE_TEXT"],
        "target_language": r["TARGET_LANGUAGE"],
        "translated_text": r["TRANSLATED_TEXT"],
    } for r in rows])


@translation_bp.route("/translations/manual", methods=["POST", "OPTIONS"])
def create_manual_translation():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    source_text = data.get("source_text")
    target_language = data.get("target_language")
    translated_text = data.get("translated_text")

    if not source_text or not target_language or not translated_text:
        return jsonify({"success": False, "message": "Missing fields"}), 400

    existing = execute(
        "SELECT ID FROM TRANSLATIONS WHERE SOURCE_TEXT = %s AND TARGET_LANGUAGE = %s LIMIT 1",
        (source_text, target_language),
        fetch="one",
    )
    if existing:
        execute(
            "UPDATE TRANSLATIONS SET TRANSLATED_TEXT = %s WHERE ID = %s",
            (translated_text, existing["ID"]),
        )
        execute(
            "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, CURRENT_TIMESTAMP())",
            (f"Manual Translation Updated: {existing['ID']}",),
        )
        return jsonify({"success": True, "id": existing["ID"]})

    execute(
        "INSERT INTO TRANSLATIONS (SOURCE_TEXT, TARGET_LANGUAGE, TRANSLATED_TEXT, CREATED_AT) "
        "VALUES (%s, %s, %s, CURRENT_TIMESTAMP())",
        (source_text, target_language, translated_text),
    )
    new_row = execute(
        "SELECT ID FROM TRANSLATIONS WHERE SOURCE_TEXT = %s AND TARGET_LANGUAGE = %s "
        "ORDER BY ID DESC LIMIT 1",
        (source_text, target_language),
        fetch="one",
    )
    new_id = new_row["ID"] if new_row else None
    execute(
        "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, CURRENT_TIMESTAMP())",
        (f"Manual Translation Created: {new_id}",),
    )
    return jsonify({"success": True, "id": new_id})


@translation_bp.route("/translations/<int:translation_id>", methods=["PUT", "OPTIONS"])
def update_translation(translation_id):
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    row = execute(
        "SELECT ID, TRANSLATED_TEXT FROM TRANSLATIONS WHERE ID = %s LIMIT 1",
        (translation_id,),
        fetch="one",
    )
    if not row:
        return jsonify({"success": False, "message": "Translation not found"}), 404

    new_text = data.get("translated_text", row["TRANSLATED_TEXT"])
    execute(
        "UPDATE TRANSLATIONS SET TRANSLATED_TEXT = %s WHERE ID = %s",
        (new_text, translation_id),
    )
    execute(
        "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, CURRENT_TIMESTAMP())",
        (f"Translation Updated: {translation_id}",),
    )
    return jsonify({"success": True, "message": "Translation updated", "id": translation_id})


@translation_bp.route("/translations/<int:translation_id>", methods=["DELETE", "OPTIONS"])
def delete_translation(translation_id):
    if request.method == "OPTIONS":
        return "", 204

    row = execute(
        "SELECT ID FROM TRANSLATIONS WHERE ID = %s LIMIT 1",
        (translation_id,),
        fetch="one",
    )
    if not row:
        return jsonify({"success": False, "message": "Translation not found"}), 404

    execute("DELETE FROM TRANSLATIONS WHERE ID = %s", (translation_id,))
    execute(
        "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, CURRENT_TIMESTAMP())",
        (f"Translation Deleted: {translation_id}",),
    )
    return jsonify({"success": True, "message": "Translation deleted"})