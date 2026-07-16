from flask import Blueprint, jsonify, request
from urllib.parse import urlparse
from database import execute
from utils.url_validator import validate_shopify_url
import logging

logger = logging.getLogger(__name__)
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

    data = request.json or {}
    url = data.get("url", "").strip()
    edits = data.get("edits", [])

    if not url:
        logger.warning("[save_overlay_edits] Missing URL in request")
        return jsonify({"success": False, "message": "URL is required"}), 400

    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"

    validation = validate_shopify_url(url)
    if not validation['valid']:
        logger.warning(f"[save_overlay_edits] URL validation failed: {validation['message']}")
        return jsonify({"success": False, "message": validation['message']}), 403

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

        existing = execute(
            "SELECT ID FROM OVERLAY_EDITS "
            "WHERE URL = %s AND ORIGINAL_TEXT = %s AND IS_TRANSLATION = %s AND TARGET_LANGUAGE IS NOT DISTINCT FROM %s "
            "LIMIT 1",
            (url, orig_text, is_trans, target_lang),
            fetch="one",
        )

        if existing:
            execute(
                "UPDATE OVERLAY_EDITS SET NEW_TEXT=%s, SELECTOR=%s, ELEMENT_TAG=%s, FIELD_NAME=%s "
                "WHERE ID=%s",
                (new_text, selector, element_tag, field_name, existing["ID"]),
            )
        else:
            execute(
                "INSERT INTO OVERLAY_EDITS "
                "(URL, ORIGINAL_TEXT, NEW_TEXT, IS_TRANSLATION, TARGET_LANGUAGE, SELECTOR, ELEMENT_TAG, FIELD_NAME) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (url, orig_text, new_text, is_trans, target_lang, selector, element_tag, field_name),
            )
        saved_count += 1

    logger.info(f"[save_overlay_edits] Saved {saved_count} overlay edits for URL: {url}")
    return jsonify({"success": True, "message": f"Saved {saved_count} overlay edits."})


@overlay_bp.route("/overlay/replacements", methods=["GET", "OPTIONS"])
def get_replacements():

    if request.method == "OPTIONS":
        return "", 204

    url = request.args.get("url", "").strip()
    target_lang = request.args.get("target_language")

    if not url:
        logger.warning("[get_replacements] Missing URL in request")
        return jsonify({"replacements": {}})

    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"


    validation = validate_shopify_url(url)
    if not validation['valid']:
        logger.warning(f"[get_replacements] URL validation failed: {validation['message']}")
        return jsonify({"success": False, "message": validation['message']}), 403

    candidate_urls = list(_candidate_urls(url))
    replacements = []

    placeholders = ", ".join(["%s"] * len(candidate_urls))
    base_rows = execute(
        f"SELECT ORIGINAL_TEXT, NEW_TEXT, SELECTOR, ELEMENT_TAG, FIELD_NAME "
        f"FROM OVERLAY_EDITS WHERE URL IN ({placeholders}) AND IS_TRANSLATION = FALSE "
        f"ORDER BY ID ASC",
        tuple(candidate_urls),
        fetch="all",
    ) or []

    for r in base_rows:
        replacements.append({
            "original_text": r["ORIGINAL_TEXT"],
            "new_text": r["NEW_TEXT"],
            "selector": r["SELECTOR"],
            "element_tag": r["ELEMENT_TAG"],
            "field_name": r["FIELD_NAME"],
            "is_translation": False,
            "target_language": None,
        })

    if target_lang:
        trans_rows = execute(
            "SELECT ORIGINAL_TEXT, NEW_TEXT, SELECTOR, ELEMENT_TAG, FIELD_NAME, TARGET_LANGUAGE "
            "FROM OVERLAY_EDITS WHERE URL = %s AND IS_TRANSLATION = TRUE AND TARGET_LANGUAGE = %s "
            "ORDER BY ID ASC",
            (url, target_lang),
            fetch="all",
        ) or []
        for r in trans_rows:
            replacements.append({
                "original_text": r["ORIGINAL_TEXT"],
                "new_text": r["NEW_TEXT"],
                "selector": r["SELECTOR"],
                "element_tag": r["ELEMENT_TAG"],
                "field_name": r["FIELD_NAME"],
                "is_translation": True,
                "target_language": r["TARGET_LANGUAGE"],
            })

    logger.info(f"[get_replacements] Retrieved {len(replacements)} replacements for URL: {url}")
    return jsonify({"replacements": replacements})


@overlay_bp.route("/overlay/cleanup-bad-edits", methods=["POST", "DELETE"])
def cleanup_bad_edits():
    try:
        total_before = execute("SELECT COUNT(*) AS CNT FROM OVERLAY_EDITS", fetch="one")["CNT"]
        without_selector = execute(
            "SELECT COUNT(*) AS CNT FROM OVERLAY_EDITS WHERE SELECTOR IS NULL", fetch="one"
        )["CNT"]
        with_selector = total_before - without_selector

        execute("DELETE FROM OVERLAY_EDITS WHERE SELECTOR IS NULL")
        total_after = execute("SELECT COUNT(*) AS CNT FROM OVERLAY_EDITS", fetch="one")["CNT"]

        return jsonify({
            "success": True,
            "message": f"Cleaned up {without_selector} bad edits without selectors",
            "stats": {
                "before": {"total": total_before, "with_selector": with_selector, "without_selector": without_selector},
                "after": {"total": total_after, "deleted": without_selector},
            },
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@overlay_bp.route("/overlay/dedupe", methods=["POST"])
def dedupe_overlay_edits():
    try:
        all_rows = execute(
            "SELECT ID, URL, ORIGINAL_TEXT, IS_TRANSLATION, TARGET_LANGUAGE "
            "FROM OVERLAY_EDITS ORDER BY ID ASC",
            fetch="all",
        ) or []

        groups = {}
        for row in all_rows:
            key = (row["URL"], row["ORIGINAL_TEXT"], row["IS_TRANSLATION"], row["TARGET_LANGUAGE"])
            groups.setdefault(key, []).append(row["ID"])

        deleted_count = 0
        kept_count = 0
        for key, ids in groups.items():
            if len(ids) <= 1:
                kept_count += len(ids)
                continue
            *stale_ids, _ = ids
            for stale_id in stale_ids:
                execute("DELETE FROM OVERLAY_EDITS WHERE ID = %s", (stale_id,))
                deleted_count += 1
            kept_count += 1

        return jsonify({
            "success": True,
            "message": f"Removed {deleted_count} duplicate overlay edit(s), kept {kept_count}.",
            "stats": {
                "groups_found": len(groups),
                "duplicates_removed": deleted_count,
                "rows_kept": kept_count,
            },
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@overlay_bp.route("/overlay/clear-all", methods=["POST", "DELETE", "GET"])
def clear_all_overlay_edits():
    try:
        deleted_count = execute("SELECT COUNT(*) AS CNT FROM OVERLAY_EDITS", fetch="one")["CNT"]
        execute("DELETE FROM OVERLAY_EDITS")
        return jsonify({
            "success": True,
            "message": f"Successfully deleted all {deleted_count} saved overlay edits/translations from the database.",
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500