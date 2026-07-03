from flask import Blueprint, jsonify, request
from database import db
from model import PageContent, Translation, AuditLog
from utils.helpers import get_setting, get_default_provider_settings, get_shopify_credentials
from utils.shopify_client import fetch_shopify_pages, fetch_shopify_products, fetch_shopify_collections, extract_text_from_html
from utils.ai_provider import get_provider_response
from utils.translation_filter import TranslationFilter
import requests
from bs4 import BeautifulSoup
import re

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


def seed_shopify_page_contents_legacy(page):
    """Fallback legacy sync using Shopify Admin API."""
    imported = 0
    try:
        if page == "home":
            pages = fetch_shopify_pages()
            for shopify_page in pages:
                title = shopify_page.get("title", "")
                body = extract_text_from_html(shopify_page.get("body_html", ""))
                if title and not PageContent.query.filter_by(page="home", key=title).first():
                    db.session.add(PageContent(page="home", key=title, source_text=body or title))
                    imported += 1

            products = fetch_shopify_products(3)
            for idx, product in enumerate(products):
                title = product.get("title", f"Product {idx+1}")
                body = extract_text_from_html(product.get("body_html", ""))
                key = f"featured_product_{idx+1}_title"
                if not PageContent.query.filter_by(page="home", key=key).first():
                    db.session.add(PageContent(page="home", key=key, source_text=title))
                    imported += 1
                key = f"featured_product_{idx+1}_desc"
                if body and not PageContent.query.filter_by(page="home", key=key).first():
                    db.session.add(PageContent(page="home", key=key, source_text=body))
                    imported += 1

        elif page == "product":
            products = fetch_shopify_products(10)
            for idx, product in enumerate(products):
                title = product.get("title", "")
                body = extract_text_from_html(product.get("body_html", ""))
                key = f"product_{product.get('id', idx)}_title"
                if title and not PageContent.query.filter_by(page="product", key=key).first():
                    db.session.add(PageContent(page="product", key=key, source_text=title))
                    imported += 1
                if body:
                    key = f"product_{product.get('id', idx)}_desc"
                    if not PageContent.query.filter_by(page="product", key=key).first():
                        db.session.add(PageContent(page="product", key=key, source_text=body))
                        imported += 1

        elif page == "collection":
            collections = fetch_shopify_collections(10)
            for idx, collection in enumerate(collections):
                title = collection.get("title", "")
                body = extract_text_from_html(collection.get("body_html", ""))
                key = f"collection_{collection.get('id', idx)}_title"
                if title and not PageContent.query.filter_by(page="collection", key=key).first():
                    db.session.add(PageContent(page="collection", key=key, source_text=title))
                    imported += 1
                if body:
                    key = f"collection_{collection.get('id', idx)}_desc"
                    if not PageContent.query.filter_by(page="collection", key=key).first():
                        db.session.add(PageContent(page="collection", key=key, source_text=body))
                        imported += 1

        if imported:
            db.session.commit()
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
                
                # Resolve product ID if this block is a product card
                item_resource_id = page_resource_id
                if not item_resource_id:
                    prod_div = element.find_parent(attrs={"data-product-id": True})
                    if prod_div:
                        try:
                            item_resource_id = int(prod_div["data-product-id"])
                        except:
                            pass
                
                key = f"{section_id}_{html_tag}_{section_idx}_{elem_idx}"
                
                existing = PageContent.query.filter_by(page=page, key=key).first()
                if existing:
                    existing.source_text = text
                    existing.html_tag = html_tag
                    existing.section_id = section_id
                    existing.resource_id = item_resource_id
                else:
                    db.session.add(PageContent(
                        page=page,
                        key=key,
                        source_text=text,
                        html_tag=html_tag,
                        section_id=section_id,
                        resource_id=item_resource_id
                    ))
                imported += 1

    if imported > 0:
        db.session.commit()
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
    return jsonify({
        "connected": bool(store_url and access_token),
        "store_url": store_url or None,
    })


@content_bp.route("/contents/fetch-and-parse", methods=["POST", "OPTIONS"])
def fetch_and_parse_url():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json or {}
    url = data.get("url", "").strip()
    page = data.get("page", "other").strip()

    if not url:
        return jsonify({"success": False, "message": "URL is required"}), 400

    headers = {"User-Agent": "Mozilla/5.0 (compatible; ShopifyTranslatorBot/1.0; +content-fetch)"}
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code != 200:
            return jsonify({"success": False, "message": f"Failed to fetch {url}. Status: {resp.status_code}"}), 400
        html = resp.text
    except Exception as e:
        return jsonify({"success": False, "message": f"Error fetching url: {str(e)}"}), 400

    soup = BeautifulSoup(html, "html.parser")
    target_tags = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "button", "a", "span", "label"]
    
    imported = 0
    title_tag = soup.find("title")
    if title_tag and title_tag.text:
        text = title_tag.get_text(strip=True)
        if text:
            existing = PageContent.query.filter_by(page=page, key="meta_title").first()
            if existing:
                existing.source_text = text
            else:
                db.session.add(PageContent(page=page, key="meta_title", source_text=text, html_tag="title", section_id="META"))
            imported += 1

    sections = soup.find_all("div", id=re.compile(r"^shopify-section-"))
    if not sections:
        body = soup.find("body")
        if body:
            sections = [body]
        else:
            sections = [soup]
    
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
            
            existing = PageContent.query.filter_by(page=page, key=key).first()
            if existing:
                existing.source_text = text
                existing.html_tag = html_tag
                existing.section_id = section_id
            else:
                db.session.add(PageContent(
                    page=page,
                    key=key,
                    source_text=text,
                    html_tag=html_tag,
                    section_id=section_id
                ))
            imported += 1

    db.session.commit()
    return jsonify({"success": True, "message": f"Extracted and saved {imported} elements.", "imported": imported})


@content_bp.route("/contents/sync", methods=["POST", "OPTIONS"])
def sync_contents():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json or {}
    page = (data.get("page") or "home").strip()

    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return jsonify({
            "success": False,
            "message": "No Shopify store connected. Add your store URL and access token in Store Settings.",
            "imported": 0,
        }), 400

    if page not in ["home", "product", "collection"]:
        return jsonify({
            "success": False,
            "message": f"The '{page}' page is not synced from Shopify.",
            "imported": 0,
        }), 400

    imported = seed_shopify_page_contents(page)
    total = PageContent.query.filter_by(page=page).count()

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
        records = PageContent.query.filter_by(page=page).order_by(PageContent.key).all()
    else:
        records = PageContent.query.order_by(PageContent.page, PageContent.key).all()

    return jsonify([{
        "id": item.id,
        "page": item.page,
        "key": item.key,
        "source_text": item.source_text,
        "html_tag": getattr(item, 'html_tag', None),
        "section_id": getattr(item, 'section_id', None),
        "resource_id": getattr(item, 'resource_id', None)
    } for item in records])


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

    if PageContent.query.filter_by(page=page, key=key).first():
        return jsonify({"success": False, "message": "Content item already exists for this page and key"}), 400

    content = PageContent(page=page, key=key, source_text=source_text)
    db.session.add(content)
    db.session.commit()

    return jsonify({"success": True, "content": {
        "id": content.id, "page": content.page,
        "key": content.key, "source_text": content.source_text
    }})


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

    existing = PageContent.query.filter_by(page=page, key=key).first()
    if existing:
        existing.source_text = source_text
        content = existing
        updated = True
    else:
        content = PageContent(page=page, key=key, source_text=source_text)
        db.session.add(content)
        updated = False

    translation_saved = False
    if target_language and translated_text:
        existing_t = Translation.query.filter_by(
            source_text=content.source_text,
            target_language=target_language
        ).first()
        if existing_t:
            existing_t.translated_text = translated_text
        else:
            db.session.add(Translation(
                source_text=content.source_text,
                target_language=target_language,
                translated_text=translated_text
            ))
        translation_saved = True

    db.session.commit()
    audit_action = f"Content Imported: {page}/{key}"
    if source_url:
        audit_action += f" from {source_url}"
    db.session.add(AuditLog(action=audit_action))
    db.session.commit()

    return jsonify({
        "success": True, "updated": updated, "translation_saved": translation_saved,
        "message": f"Content {'updated' if updated else 'saved'} to Translations library.",
        "content": {"id": content.id, "page": content.page, "key": content.key, "source_text": content.source_text}
    })


@content_bp.route("/contents/<int:content_id>", methods=["PUT", "OPTIONS"])
def update_content(content_id):
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    content = PageContent.query.get(content_id)
    if not content:
        return jsonify({"success": False, "message": "Content item not found"}), 404

    page = data.get("page", content.page).strip()
    key = data.get("key", content.key).strip()
    source_text = data.get("source_text", content.source_text).strip()

    if not page or not key or not source_text:
        return jsonify({"success": False, "message": "page, key, and source_text are required"}), 400

    if PageContent.query.filter(PageContent.page == page, PageContent.key == key, PageContent.id != content_id).first():
        return jsonify({"success": False, "message": "Another content item already uses this page and key"}), 400

    content.page = page
    content.key = key
    content.source_text = source_text
    db.session.commit()

    # Push to Shopify so it shows on the website
    push_update_to_shopify(page, key, source_text)

    return jsonify({"success": True, "content": {
        "id": content.id, "page": content.page,
        "key": content.key, "source_text": content.source_text
    }})


@content_bp.route("/contents/<int:content_id>", methods=["DELETE"])
def delete_content(content_id):
    content = PageContent.query.get(content_id)
    if not content:
        return jsonify({"success": False, "message": "Content item not found"}), 404
    db.session.delete(content)
    db.session.commit()
    return jsonify({"success": True, "message": "Content item deleted"})


@content_bp.route("/contents/<int:content_id>/translate", methods=["POST", "OPTIONS"])
def translate_content(content_id):
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    target_language = data.get("target_language", "").strip()
    if not target_language:
        return jsonify({"success": False, "message": "Missing target language"}), 400

    content = PageContent.query.get(content_id)
    if not content:
        return jsonify({"success": False, "message": "Content item not found"}), 404

    # ── Check if content should be skipped (email, number, URL) ────────────
    if TranslationFilter.should_skip(content.source_text):
        print(f"[translate_content] Skipping non-translatable content: {content.source_text}")
        return jsonify({
            "success": True,
            "translated_text": content.source_text,
            "skipped": True,
            "message": "Content excluded from translation (email, number, or URL)"
        })

    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    provider = provider_settings.get("provider", "openai")
    model = provider_settings.get("model", "gpt-3.5-turbo")
    api_key = provider_settings["api_keys"].get(provider, "")

    try:
        translated_text = get_provider_response(provider, model, api_key, content.source_text, target_language)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    db.session.add(Translation(
        source_text=content.source_text,
        target_language=target_language,
        translated_text=translated_text
    ))
    db.session.commit()

    return jsonify({"success": True, "translated_text": translated_text})
