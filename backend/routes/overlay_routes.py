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
    base_edits = (
        OverlayEdit.query
        .filter(OverlayEdit.url.in_(candidate_urls), OverlayEdit.is_translation.is_(False))
        .order_by(OverlayEdit.id.asc())
        .all()
    )
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
        trans_edits = (
            OverlayEdit.query
            .filter_by(url=url, is_translation=True, target_language=target_lang)
            .order_by(OverlayEdit.id.asc())
            .all()
        )
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

@overlay_bp.route("/overlay/cleanup-bad-edits", methods=["POST", "DELETE"])
def cleanup_bad_edits():
    try:
        # Get stats before
        total_before = OverlayEdit.query.count()
        with_selector = OverlayEdit.query.filter(OverlayEdit.selector.isnot(None)).count()
        without_selector = OverlayEdit.query.filter(OverlayEdit.selector.is_(None)).count()

        # Delete bad edits
        deleted_count = OverlayEdit.query.filter(OverlayEdit.selector.is_(None)).delete()
        db.session.commit()

        # Get stats after
        total_after = OverlayEdit.query.count()

        return jsonify({
            "success": True,
            "message": f"Cleaned up {deleted_count} bad edits without selectors",
            "stats": {
                "before": {
                    "total": total_before,
                    "with_selector": with_selector,
                    "without_selector": without_selector
                },
                "after": {
                    "total": total_after,
                    "deleted": deleted_count
                }
            }
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@overlay_bp.route("/overlay/dedupe", methods=["POST"])
def dedupe_overlay_edits():
    try:
        all_edits = OverlayEdit.query.order_by(OverlayEdit.id.asc()).all()

        groups = {}
        for edit in all_edits:
            key = (edit.url, edit.original_text, edit.is_translation, edit.target_language)
            groups.setdefault(key, []).append(edit)

        deleted_count = 0
        kept_count = 0
        for key, rows in groups.items():
            if len(rows) <= 1:
                kept_count += len(rows)
                continue
            *stale, latest = rows
            for row in stale:
                db.session.delete(row)
                deleted_count += 1
            kept_count += 1

        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Removed {deleted_count} duplicate overlay edit(s), kept {kept_count}.",
            "stats": {
                "groups_found": len(groups),
                "duplicates_removed": deleted_count,
                "rows_kept": kept_count,
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@overlay_bp.route("/overlay/clear-all", methods=["POST", "DELETE", "GET"])
def clear_all_overlay_edits():
    """
    ADMIN ONLY: Completely wipe the OverlayEdit database table to start fresh.
    """
    try:
        deleted_count = OverlayEdit.query.delete()
        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Successfully deleted all {deleted_count} saved overlay edits/translations from the database."
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500