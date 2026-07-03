from flask import Blueprint, jsonify, request
from database import db
from model import OverlayEdit

overlay_bp = Blueprint("overlay_routes", __name__)

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
        
        if not orig_text or not new_text:
            continue
            
        existing = OverlayEdit.query.filter_by(
            url=url,
            original_text=orig_text,
            is_translation=is_trans,
            target_language=target_lang
        ).first()
        
        if existing:
            existing.new_text = new_text
        else:
            db.session.add(OverlayEdit(
                url=url,
                original_text=orig_text,
                new_text=new_text,
                is_translation=is_trans,
                target_language=target_lang
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
        
    # Get direct original text edits (non-translations)
    base_edits = OverlayEdit.query.filter_by(url=url, is_translation=False).all()
    replacements = {e.original_text: e.new_text for e in base_edits}
    
    # If a language is requested, overlay translation edits
    if target_lang:
        trans_edits = OverlayEdit.query.filter_by(url=url, is_translation=True, target_language=target_lang).all()
        for e in trans_edits:
            # Overwrite original text with the translation
            replacements[e.original_text] = e.new_text
            
    return jsonify({"replacements": replacements})
