from flask import Blueprint, jsonify, request
from urllib.parse import urlparse
from database import db
from model import OverlayEdit

overlay_bp = Blueprint("overlay_routes", __name__)

def _candidate_urls(raw_url):
    variants = set()
    if not raw_url:
        return variants

    raw_url = raw_url.strip()
    variants.add(raw_url)

    parsed = urlparse(raw_url)
    if not parsed.scheme or not parsed.netloc:
        return variants

    base = f"{parsed.scheme}://{parsed.netloc}"
    path = parsed.path or "/"
    variants.add(base + path)
    variants.add(base + path.rstrip("/"))
    variants.add(base + (path if path != "/" else ""))
    if path.endswith("/"):
        variants.add(base + path[:-1])
    else:
        variants.add(base + path + "/")
    return variants


@overlay_bp.route("/overlay/save", methods=["POST", "OPTIONS"])
def save_overlay_edits():
    if request.method == "OPTIONS":
        return "", 204
    
    data = request.json
    url = data.get("url", "").strip()
    edits = data.get("edits", [])
    
    if not url:
        return jsonify({"success": False, "message": "URL is required"}), 400

    saved_count = 0
    for edit in edits:
        orig_text = edit.get("original_text", "").strip()
        new_text = edit.get("new_text", "").strip()
        is_trans = edit.get("is_translation", False)
        target_lang = edit.get("target_language")
        selector = edit.get("selector") or edit.get("target_selector")
        element_tag = edit.get("element_tag")
        field_name = edit.get("field_name")
        
        if not orig_text or not new_text:
            continue

        filter_kwargs = {
            "url": url,
            "original_text": orig_text,
            "is_translation": is_trans,
            "target_language": target_lang,
        }
        if selector:
            filter_kwargs["selector"] = selector

        existing = OverlayEdit.query.filter_by(**filter_kwargs).first()
        
        if existing:
            existing.new_text = new_text
            existing.selector = selector
            existing.element_tag = element_tag
            existing.field_name = field_name
        else:
            db.session.add(OverlayEdit(
                url=url,
                original_text=orig_text,
                new_text=new_text,
                is_translation=is_trans,
                target_language=target_lang,
                selector=selector,
                element_tag=element_tag,
                field_name=field_name,
            ))
        saved_count += 1
        
    db.session.commit()
    return jsonify({"success": True, "message": f"Saved {saved_count} overlay edits."})

@overlay_bp.route("/overlay/replacements", methods=["GET", "OPTIONS"])
def get_replacements():
    if request.method == "OPTIONS":
        return "", 204
        
    url = request.args.get("url", "").strip()
    target_lang = request.args.get("target_language")
    
    if not url:
        return jsonify({"replacements": {}})

    candidate_urls = list(_candidate_urls(url))
    replacements = []
    base_edits = OverlayEdit.query.filter(OverlayEdit.url.in_(candidate_urls), OverlayEdit.is_translation.is_(False)).all()
    for edit in base_edits:
        replacements.append({
            "original_text": edit.original_text,
            "new_text": edit.new_text,
            "selector": edit.selector,
            "element_tag": edit.element_tag,
            "field_name": edit.field_name,
            "is_translation": False,
            "target_language": None,
        })

    if target_lang:
        trans_edits = OverlayEdit.query.filter_by(url=url, is_translation=True, target_language=target_lang).all()
        for edit in trans_edits:
            replacements.append({
                "original_text": edit.original_text,
                "new_text": edit.new_text,
                "selector": edit.selector,
                "element_tag": edit.element_tag,
                "field_name": edit.field_name,
                "is_translation": True,
                "target_language": edit.target_language,
            })
            
    return jsonify({"replacements": replacements})
