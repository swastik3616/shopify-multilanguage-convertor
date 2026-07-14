from flask import Blueprint, jsonify, request
from database import execute
from utils.helpers import get_setting, get_default_provider_settings, get_shopify_credentials
from utils.shopify_client import fetch_shopify_pages, fetch_shopify_products, fetch_shopify_collections, extract_text_from_html
from utils.ai_provider import get_provider_response
from utils.translation_filter import TranslationFilter
from utils.url_validator import validate_shopify_url
import requests
from bs4 import BeautifulSoup
import re
import logging

logger = logging.getLogger(__name__)

content_bp = Blueprint("content_routes", __name__)


def push_update_to_shopify(page, key, text):
    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return
    headers = {"X-Shopify-Access-Token": access_token, "Content-Type": "application/json"}
    try:
        if page == "product" and key.startswith("product_"):
            parts = key.split("_")
            if len(parts) >= 3:
                product_id = parts[1]
                field = parts[2]
                payload = {"product": {"id": product_id}}
                if field == "title":
                    payload["product"]["title"] = text
                elif field == "desc":
                    payload["product"]["body_html"] = text
                requests.put(f"https://{store_url}/admin/api/2026-04/products/{product_id}.json", headers=headers, json=payload, timeout=10)

        elif page == "collection" and key.startswith("collection_"):
            parts = key.split("_")
            if len(parts) >= 3:
                collection_id = parts[1]
                field = parts[2]
                payload = {"custom_collection": {"id": collection_id}}
                if field == "title":
                    payload["custom_collection"]["title"] = text
                elif field == "desc":
                    payload["custom_collection"]["body_html"] = text
                requests.put(f"https://{store_url}/admin/api/2026-04/custom_collections/{collection_id}.json", headers=headers, json=payload, timeout=10)
    except Exception as e:
        print(f"Error updating Shopify: {e}")


def _pc_exists(page, key):
    """Check if a PageContent row exists."""
    row = execute(
        "SELECT ID FROM PAGE_CONTENTS WHERE PAGE = %s AND KEY = %s LIMIT 1",
        (page, key),
        fetch="one",
    )
    return row


def _pc_upsert(page, key, source_text, html_tag=None, section_id=None, resource_id=None):
    """Insert or update a PageContent row."""
    existing = _pc_exists(page, key)
    if existing:
        execute(
            "UPDATE PAGE_CONTENTS SET SOURCE_TEXT=%s, HTML_TAG=%s, SECTION_ID=%s, RESOURCE_ID=%s "
            "WHERE ID=%s",
            (source_text, html_tag, section_id, resource_id, existing["ID"]),
        )
        return existing["ID"]
    else:
        execute(
            "INSERT INTO PAGE_CONTENTS (PAGE, KEY, SOURCE_TEXT, HTML_TAG, SECTION_ID, RESOURCE_ID) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (page, key, source_text, html_tag, section_id, resource_id),
        )
        new_row = execute(
            "SELECT ID FROM PAGE_CONTENTS WHERE PAGE=%s AND KEY=%s LIMIT 1",
            (page, key),
            fetch="one",
        )
        return new_row["ID"] if new_row else None


def seed_shopify_page_contents_legacy(page):
    """Fallback legacy sync using Shopify Admin API."""
    imported = 0
    try:
        if page == "home":
            pages = fetch_shopify_pages()
            for shopify_page in pages:
                title = shopify_page.get("title", "")
                body = extract_text_from_html(shopify_page.get("body_html", ""))
                if title and not _pc_exists("home", title):
                    _pc_upsert("home", title, body or title)
                    imported += 1

            products = fetch_shopify_products(3)
            for idx, product in enumerate(products):
                title = product.get("title", f"Product {idx+1}")
                body = extract_text_from_html(product.get("body_html", ""))
                key = f"featured_product_{idx+1}_title"
                if not _pc_exists("home", key):
                    _pc_upsert("home", key, title)
                    imported += 1
                key = f"featured_product_{idx+1}_desc"
                if body and not _pc_exists("home", key):
                    _pc_upsert("home", key, body)
                    imported += 1

        elif page == "product":
            products = fetch_shopify_products(10)
            for idx, product in enumerate(products):
                title = product.get("title", "")
                body = extract_text_from_html(product.get("body_html", ""))
                key = f"product_{product.get('id', idx)}_title"
                if title and not _pc_exists("product", key):
                    _pc_upsert("product", key, title)
                    imported += 1
                if body:
                    key = f"product_{product.get('id', idx)}_desc"
                    if not _pc_exists("product", key):
                        _pc_upsert("product", key, body)
                        imported += 1

        elif page == "collection":
            collections = fetch_shopify_collections(10)
            for idx, collection in enumerate(collections):
                title = collection.get("title", "")
                body = extract_text_from_html(collection.get("body_html", ""))
                key = f"collection_{collection.get('id', idx)}_title"
                if title and not _pc_exists("collection", key):
                    _pc_upsert("collection", key, title)
                    imported += 1
                if body:
                    key = f"collection_{collection.get('id', idx)}_desc"
                    if not _pc_exists("collection", key):
                        _pc_upsert("collection", key, body)
                        imported += 1

        print(f"Seeded {imported} {page} content item(s) from Shopify store")
    except Exception as e:
        print(f"Error seeding {page} content from Shopify: {str(e)}")
    return imported


def seed_shopify_page_contents(page):
    """Scrape live storefront HTML to extract real sections and tags."""
    store_url, access_token = get_shopify_credentials()
    if not store_url:
        return 0

    imported = 0
    headers = {"User-Agent": "Mozilla/5.0 (compatible; ShopifyTranslatorBot/1.0; +content-fetch)"}
    urls_to_scrape = []

    if page == "home":
        urls_to_scrape.append((f"https://{store_url}/", None))
    elif page == "product":
        products = fetch_shopify_products(3)
        for p in products:
            handle = p.get("handle")
            pid = p.get("id")
            if handle:
                urls_to_scrape.append((f"https://{store_url}/products/{handle}", pid))
    elif page == "collection":
        collections = fetch_shopify_collections(3)
        for c in collections:
            handle = c.get("handle")
            cid = c.get("id")
            if handle:
                urls_to_scrape.append((f"https://{store_url}/collections/{handle}", cid))

    if not urls_to_scrape:
        return seed_shopify_page_contents_legacy(page)

    target_tags = ["h1", "h2", "h3", "h4", "h5", "h6", "p"]

    for url, page_resource_id in urls_to_scrape:
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code != 200:
                print(f"Failed to fetch {url}: Status {resp.status_code}")
                continue
            html = resp.text
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            continue

        soup = BeautifulSoup(html, "html.parser")
        sections = soup.find_all("div", id=re.compile(r"^shopify-section-"))

        for section_idx, section in enumerate(sections):
            section_id = section.get("id")
            for elem_idx, element in enumerate(section.find_all(target_tags)):
                text = element.get_text(separator=" ", strip=True)
                if not text or len(text) < 2:
                    continue
                html_tag = element.name.lower()
                item_resource_id = page_resource_id
                if not item_resource_id:
                    prod_div = element.find_parent(attrs={"data-product-id": True})
                    if prod_div:
                        try:
                            item_resource_id = int(prod_div["data-product-id"])
                        except Exception:
                            pass
                key = f"{section_id}_{html_tag}_{section_idx}_{elem_idx}"
                _pc_upsert(page, key, text, html_tag, section_id, item_resource_id)
                imported += 1

    if imported > 0:
        print(f"Scraped {imported} {page} content item(s) from live storefront")
    else:
        print(f"Scraping returned 0 items for {page}. Falling back to legacy API sync.")
        return seed_shopify_page_contents_legacy(page)

    return imported


@content_bp.route("/contents/store-status", methods=["GET", "OPTIONS"])
def get_contents_store_status():
    if request.method == "OPTIONS":
        return "", 204
    store_url, access_token = get_shopify_credentials()
    return jsonify({"connected": bool(store_url and access_token), "store_url": store_url or None})


@content_bp.route("/contents/fetch-and-parse", methods=["POST", "OPTIONS"])
def fetch_and_parse_url():
    """
    Fetch a URL and parse HTML to extract translatable content.
    
    Security: Only URLs from the configured Shopify store are allowed.
    
    Request body:
        {
            "url": "https://mystore.myshopify.com/products/example",
            "page": "product" (optional)
        }
    
    Response:
        {
            "success": true,
            "message": "Extracted and saved X elements.",
            "imported": X
        }
    """
    if request.method == "OPTIONS":
        return "", 204

    data = request.json or {}
    url = data.get("url", "").strip()
    page = data.get("page", "other").strip()

    if not url:
        logger.warning("[fetch_and_parse_url] Missing URL in request")
        return jsonify({"success": False, "message": "URL is required"}), 400

    # Add scheme if missing
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"

    # ────────────────────────────────────────────────────────────────────────────
    # URL SECURITY: Validate that URL belongs to configured Shopify store
    # ────────────────────────────────────────────────────────────────────────────
    validation = validate_shopify_url(url)
    if not validation['valid']:
        logger.warning(f"[fetch_and_parse_url] URL validation failed: {validation['message']}")
        return jsonify({"success": False, "message": validation['message']}), 403

    headers = {"User-Agent": "Mozilla/5.0 (compatible; ShopifyTranslatorBot/1.0; +content-fetch)"}
    try:
        logger.info(f"[fetch_and_parse_url] Fetching validated URL: {url}")
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"[fetch_and_parse_url] Failed to fetch URL: status_code={resp.status_code}")
            return jsonify({"success": False, "message": f"Failed to fetch {url}. Status: {resp.status_code}"}), 400
        html = resp.text
    except requests.Timeout:
        logger.error(f"[fetch_and_parse_url] Request timeout for URL: {url}")
        return jsonify({"success": False, "message": "Request timed out while fetching the URL"}), 504
    except requests.RequestException as e:
        logger.error(f"[fetch_and_parse_url] Request error: {e}")
        return jsonify({"success": False, "message": f"Error fetching url: {str(e)}"}), 503
    except Exception as e:
        logger.error(f"[fetch_and_parse_url] Unexpected error: {e}")
        return jsonify({"success": False, "message": f"Error fetching url: {str(e)}"}), 500

    try:
        soup = BeautifulSoup(html, "html.parser")
        target_tags = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "button", "a", "span", "label"]
        imported = 0

        title_tag = soup.find("title")
        if title_tag and title_tag.text:
            text = title_tag.get_text(strip=True)
            if text:
                _pc_upsert(page, "meta_title", text, "title", "META")
                imported += 1

        sections = soup.find_all("div", id=re.compile(r"^shopify-section-"))
        if not sections:
            body = soup.find("body")
            sections = [body] if body else [soup]

        for section_idx, section in enumerate(sections):
            if not section:
                continue
            section_id = section.get("id") or "main_body"
            for elem_idx, element in enumerate(section.find_all(target_tags)):
                text = element.get_text(separator=" ", strip=True)
                if not text or len(text) < 2:
                    continue
                html_tag = element.name.lower()
                key = f"{section_id}_{html_tag}_{section_idx}_{elem_idx}"
                _pc_upsert(page, key, text, html_tag, section_id)
                imported += 1

        logger.info(f"[fetch_and_parse_url] Successfully parsed URL and extracted {imported} elements")
        return jsonify({"success": True, "message": f"Extracted and saved {imported} elements.", "imported": imported})
    
    except Exception as e:
        logger.error(f"[fetch_and_parse_url] Error parsing HTML: {e}")
        return jsonify({"success": False, "message": f"Error parsing content: {str(e)}"}), 500


@content_bp.route("/contents/sync", methods=["POST", "OPTIONS"])
def sync_contents():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json or {}
    page = (data.get("page") or "home").strip()

    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return jsonify({"success": False, "message": "No Shopify store connected.", "imported": 0}), 400

    if page not in ["home", "product", "collection"]:
        return jsonify({"success": False, "message": f"The '{page}' page is not synced from Shopify.", "imported": 0}), 400

    imported = seed_shopify_page_contents(page)
    total_row = execute(
        "SELECT COUNT(*) AS CNT FROM PAGE_CONTENTS WHERE PAGE = %s", (page,), fetch="one"
    )
    total = total_row["CNT"] if total_row else 0

    return jsonify({
        "success": True,
        "message": f"Imported {imported} new item(s) from Shopify. {total} total item(s) on this page.",
        "imported": imported,
        "total": total,
    })


@content_bp.route("/contents", methods=["GET", "OPTIONS"])
def get_contents():
    if request.method == "OPTIONS":
        return "", 204
    page = request.args.get("page")
    if page:
        if page in ["home", "product", "collection"]:
            seed_shopify_page_contents(page)
        rows = execute(
            "SELECT ID, PAGE, KEY, SOURCE_TEXT, HTML_TAG, SECTION_ID, RESOURCE_ID "
            "FROM PAGE_CONTENTS WHERE PAGE = %s ORDER BY KEY",
            (page,),
            fetch="all",
        ) or []
    else:
        rows = execute(
            "SELECT ID, PAGE, KEY, SOURCE_TEXT, HTML_TAG, SECTION_ID, RESOURCE_ID "
            "FROM PAGE_CONTENTS ORDER BY PAGE, KEY",
            fetch="all",
        ) or []

    return jsonify([{
        "id": r["ID"], "page": r["PAGE"], "key": r["KEY"],
        "source_text": r["SOURCE_TEXT"], "html_tag": r["HTML_TAG"],
        "section_id": r["SECTION_ID"], "resource_id": r["RESOURCE_ID"],
    } for r in rows])


@content_bp.route("/contents", methods=["POST", "OPTIONS"])
def create_content():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    page = data.get("page", "home").strip()
    key = data.get("key", "").strip()
    source_text = data.get("source_text", "").strip()

    if not page or not key or not source_text:
        return jsonify({"success": False, "message": "page, key, and source_text are required"}), 400

    if _pc_exists(page, key):
        return jsonify({"success": False, "message": "Content item already exists for this page and key"}), 400

    new_id = _pc_upsert(page, key, source_text)
    return jsonify({"success": True, "content": {"id": new_id, "page": page, "key": key, "source_text": source_text}})


@content_bp.route("/contents/import", methods=["POST", "OPTIONS"])
def import_content():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json or {}
    page = (data.get("page") or "other").strip()
    key = (data.get("key") or "").strip()
    source_text = (data.get("source_text") or "").strip()
    source_url = (data.get("source_url") or "").strip()
    target_language = (data.get("target_language") or "").strip()
    translated_text = (data.get("translated_text") or "").strip()

    if not key or not source_text:
        return jsonify({"success": False, "message": "key and source_text are required"}), 400

    existing = _pc_exists(page, key)
    if existing:
        execute(
            "UPDATE PAGE_CONTENTS SET SOURCE_TEXT=%s WHERE ID=%s",
            (source_text, existing["ID"]),
        )
        content_id = existing["ID"]
        updated = True
    else:
        content_id = _pc_upsert(page, key, source_text)
        updated = False

    translation_saved = False
    if target_language and translated_text:
        t_existing = execute(
            "SELECT ID FROM TRANSLATIONS WHERE SOURCE_TEXT=%s AND TARGET_LANGUAGE=%s LIMIT 1",
            (source_text, target_language),
            fetch="one",
        )
        if t_existing:
            execute(
                "UPDATE TRANSLATIONS SET TRANSLATED_TEXT=%s WHERE ID=%s",
                (translated_text, t_existing["ID"]),
            )
        else:
            execute(
                "INSERT INTO TRANSLATIONS (SOURCE_TEXT, TARGET_LANGUAGE, TRANSLATED_TEXT, CREATED_AT) "
                "VALUES (%s, %s, %s, CURRENT_TIMESTAMP())",
                (source_text, target_language, translated_text),
            )
        translation_saved = True

    audit_action = f"Content Imported: {page}/{key}"
    if source_url:
        audit_action += f" from {source_url}"
    execute(
        "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, CURRENT_TIMESTAMP())",
        (audit_action,),
    )

    return jsonify({
        "success": True, "updated": updated, "translation_saved": translation_saved,
        "message": f"Content {'updated' if updated else 'saved'} to Translations library.",
        "content": {"id": content_id, "page": page, "key": key, "source_text": source_text},
    })


@content_bp.route("/contents/<int:content_id>", methods=["PUT", "OPTIONS"])
def update_content(content_id):
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    row = execute(
        "SELECT ID, PAGE, KEY, SOURCE_TEXT FROM PAGE_CONTENTS WHERE ID=%s LIMIT 1",
        (content_id,), fetch="one",
    )
    if not row:
        return jsonify({"success": False, "message": "Content item not found"}), 404

    page = data.get("page", row["PAGE"]).strip()
    key = data.get("key", row["KEY"]).strip()
    source_text = data.get("source_text", row["SOURCE_TEXT"]).strip()

    if not page or not key or not source_text:
        return jsonify({"success": False, "message": "page, key, and source_text are required"}), 400

    conflict = execute(
        "SELECT ID FROM PAGE_CONTENTS WHERE PAGE=%s AND KEY=%s AND ID != %s LIMIT 1",
        (page, key, content_id), fetch="one",
    )
    if conflict:
        return jsonify({"success": False, "message": "Another content item already uses this page and key"}), 400

    execute(
        "UPDATE PAGE_CONTENTS SET PAGE=%s, KEY=%s, SOURCE_TEXT=%s WHERE ID=%s",
        (page, key, source_text, content_id),
    )
    push_update_to_shopify(page, key, source_text)

    return jsonify({"success": True, "content": {"id": content_id, "page": page, "key": key, "source_text": source_text}})


@content_bp.route("/contents/<int:content_id>", methods=["DELETE"])
def delete_content(content_id):
    row = execute(
        "SELECT ID FROM PAGE_CONTENTS WHERE ID=%s LIMIT 1", (content_id,), fetch="one"
    )
    if not row:
        return jsonify({"success": False, "message": "Content item not found"}), 404
    execute("DELETE FROM PAGE_CONTENTS WHERE ID=%s", (content_id,))
    return jsonify({"success": True, "message": "Content item deleted"})


@content_bp.route("/contents/<int:content_id>/translate", methods=["POST", "OPTIONS"])
def translate_content(content_id):
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    target_language = data.get("target_language", "").strip()
    if not target_language:
        return jsonify({"success": False, "message": "Missing target language"}), 400

    row = execute(
        "SELECT ID, SOURCE_TEXT FROM PAGE_CONTENTS WHERE ID=%s LIMIT 1",
        (content_id,), fetch="one",
    )
    if not row:
        return jsonify({"success": False, "message": "Content item not found"}), 404

    source_text = row["SOURCE_TEXT"]

    if TranslationFilter.should_skip(source_text):
        return jsonify({
            "success": True, "translated_text": source_text, "skipped": True,
            "message": "Content excluded from translation (email, number, or URL)",
        })

    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    provider = provider_settings.get("provider", "openai")
    model = provider_settings.get("model", "gpt-3.5-turbo")
    api_key = provider_settings["api_keys"].get(provider, "")

    try:
        translated_text = get_provider_response(provider, model, api_key, source_text, target_language)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    existing_translation = execute(
        """
        SELECT ID
        FROM TRANSLATIONS
        WHERE SOURCE_TEXT = %s
        AND TARGET_LANGUAGE = %s
        LIMIT 1
        """,
        (source_text, target_language),
        fetch="one",
    )

    if existing_translation:
        execute(
            "UPDATE TRANSLATIONS SET TRANSLATED_TEXT = %s, CREATED_AT = CURRENT_TIMESTAMP() WHERE ID = %s",
            (translated_text, existing_translation["ID"]),
        )
    else:
        execute(
            "INSERT INTO TRANSLATIONS (SOURCE_TEXT, TARGET_LANGUAGE, TRANSLATED_TEXT, CREATED_AT) "
            "VALUES (%s, %s, %s, CURRENT_TIMESTAMP())",
            (source_text, target_language, translated_text),
        )

    return jsonify({"success": True, "translated_text": translated_text})
