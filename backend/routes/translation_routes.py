from flask import Blueprint, jsonify, request
from database import db
from model import Translation, AuditLog
from utils.helpers import get_setting, get_default_provider_settings
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

    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    provider = provider_settings.get("provider", "openai")
    model = provider_settings.get("model", "gpt-3.5-turbo")
    api_key = provider_settings["api_keys"].get(provider, "")

    # ── Step 0: Filter out non-translatable content (emails, numbers, URLs) ──
    skip_indices = {}  # indices to skip with their original values
    for i, text in enumerate(texts):
        if TranslationFilter.should_skip(text):
            skip_indices[i] = text

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
        if i in skip_indices:
            # Skip non-translatable content - use original text
            cached_map[i] = text
        elif text in db_cache:
            cached_map[i] = db_cache[text]
        else:
            uncached_indices.append(i)

    cache_hits = len(texts) - len(uncached_indices) - len(skip_indices)
    print(f"[bulk-translate] cache={cache_hits}/{len(texts)} hits | skipped={len(skip_indices)} | need_ai={len(uncached_indices)} | lang='{target_language}'")

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
        "api_calls": len(uncached_indices),
        "skipped": len(skip_indices)
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

    # ── Step 0: Check if text should be skipped (email, number, URL) ────────
    if TranslationFilter.should_skip(source_text):
        print(f"[translate] Skipping non-translatable text: {source_text}")
        return jsonify({"translated_text": source_text, "skipped": True})

    existing = Translation.query.filter_by(
        source_text=source_text,
        target_language=target_language
    ).first()

    if existing:
        return jsonify({"translated_text": existing.translated_text, "cached": True})

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
        from bs4 import BeautifulSoup
        import re as _re
        import time
        from urllib.parse import urlparse, urlencode, parse_qsl

        # ── FIX ────────────────────────────────────────────────────────────
        # The previous cache-busting relied only on a `_nocache` query
        # param. Many caching layers (Shopify's own Fastly edge cache for
        # proxied/custom-domain stores, Cloudflare in front of a custom
        # domain, or a caching app on the theme) build their cache key
        # from the path only and silently ignore unrecognized query
        # params — so `_nocache=...` never actually reached the cache
        # key, and stale HTML kept getting served even after the
        # merchant updated the product in Shopify Admin.
        #
        # Fix: also send explicit HTTP cache-control headers, which is
        # the standards-based way to tell any compliant proxy/CDN "give
        # me the freshest copy, don't serve from cache." This is on top
        # of (not instead of) the query-param trick, since some CDNs key
        # off one, some off the other.
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; ShopifyTranslatorBot/1.0; +content-fetch)",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        }

        # Add a random cache-busting query parameter to force Shopify CDN to
        # return the freshest HTML rather than a stale cached version.
        parsed = urlparse(url)
        query_params = parse_qsl(parsed.query)
        query_params.append(("_nocache", str(int(time.time() * 1000))))
        fetch_url = parsed._replace(query=urlencode(query_params)).geturl()

        resp = requests.get(fetch_url, headers=headers, timeout=12)
        resp.raise_for_status()
        html = resp.text

        # ── Diagnostics ──────────────────────────────────────────────────
        # Log the caching-related response headers so you can confirm
        # whether a CDN/proxy is serving from cache. If `age` is present
        # and > 0, or `x-cache`/`cf-cache-status` says HIT, something
        # between us and Shopify is caching despite the headers above —
        # that points to a CDN/proxy config change being needed rather
        # than anything fixable purely from this backend.
        cache_debug = {
            "age": resp.headers.get("Age"),
            "cache-control": resp.headers.get("Cache-Control"),
            "x-cache": resp.headers.get("X-Cache"),
            "cf-cache-status": resp.headers.get("CF-Cache-Status"),
            "x-shopify-stage": resp.headers.get("X-Shopify-Stage"),
            "etag": resp.headers.get("ETag"),
            "last-modified": resp.headers.get("Last-Modified"),
        }
        print(f"[fetch-url] url={fetch_url} status={resp.status_code} cache_headers={cache_debug}")

        MAX_HTML_LENGTH = 500_000
        if len(html) > MAX_HTML_LENGTH:
            html = html[:MAX_HTML_LENGTH]

        # ── Strip navigation/chrome elements server-side ──────────────────
        soup = BeautifulSoup(html, "html.parser")

        # 1. Remove semantic landmark tags entirely
        for tag in soup.find_all(["header", "footer", "nav", "aside"]):
            tag.decompose()

        # 2. Remove elements whose id or class is a very specific Shopify chrome
        # pattern.  We intentionally use a TIGHT list so we don't accidentally
        # remove content sections (e.g. an announcement banner with real text,
        # or a hero section whose id contains the word "header").
        #
        # Removed from the old broad list:
        #   announcement, menu, topbar  ← too generic, kills real content
        #   header/footer/nav already handled above by semantic tag removal
        CHROME_RE = _re.compile(
            r"(^|[-_])(site-header|site-footer|site-nav|mobile-nav|mobile-menu|"
            r"cart-drawer|cart-notification|cart-popup|ajax-cart|minicart|"
            r"login-modal|account-modal|search-modal|search-drawer|"
            r"predictive-search|cookie-banner|gdpr-banner|"
            r"language-switcher|currency-switcher)([-_]|$)",
            _re.IGNORECASE,
        )
        for el in soup.find_all(True):
            if el.parent is None:          # already removed by a parent decompose
                continue
            el_id  = el.get("id", "") or ""
            el_cls = " ".join(el.get("class", []) or [])
            if CHROME_RE.search(el_id) or CHROME_RE.search(el_cls):
                el.decompose()

        # 3. Prefer <main> content if the theme uses it; otherwise use <body>
        main_tag = soup.find("main") or soup.find("body") or soup
        cleaned_html = str(main_tag)

        return jsonify({"success": True, "html": cleaned_html, "_cache_debug": cache_debug})
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

    existing = Translation.query.filter_by(source_text=source_text, target_language=target_language).first()
    if existing:
        existing.translated_text = translated_text
        db.session.commit()
        return jsonify({"success": True, "id": existing.id})

    new_t = Translation(source_text=source_text, target_language=target_language, translated_text=translated_text)
    db.session.add(new_t)
    db.session.commit()
    db.session.add(AuditLog(action=f"Manual Translation Created: {new_t.id}"))
    db.session.commit()
    return jsonify({"success": True, "id": new_t.id})



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