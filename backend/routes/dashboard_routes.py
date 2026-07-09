from flask import Blueprint, jsonify, request
from database import db
from model import Translation, PageContent, AuditLog
from utils.helpers import get_setting, get_default_provider_settings
from sqlalchemy import func
from datetime import datetime, timedelta

dashboard_bp = Blueprint("dashboard_routes", __name__)


@dashboard_bp.route("/api/dashboard", methods=["GET", "OPTIONS"])
def get_dashboard_stats():
    if request.method == "OPTIONS":
        return "", 204

    lang_settings = get_setting("language_settings", {})
    targets = lang_settings.get("targets", [])
    active_languages = len(targets)
    if lang_settings.get("source"):
        active_languages += 1

    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    api_keys = provider_settings.get("api_keys", {})
    active_providers = sum(1 for key, val in api_keys.items() if val)

    translation_count = Translation.query.count()

    first_log = AuditLog.query.order_by(AuditLog.created_at.asc()).first()
    install_time = first_log.created_at.strftime("%Y-%m-%d %H:%M") if first_log and first_log.created_at else "N/A"
    today = datetime.utcnow().date()
    volume_by_day = []
    day_labels = []

    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_translations = Translation.query.filter(Translation.created_at >= seven_days_ago).all()
    
    counts_by_date = {}
    for t in recent_translations:
        if t.created_at:
            d = t.created_at.date()
            counts_by_date[d] = counts_by_date.get(d, 0) + 1

    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        label = day.strftime("%a %d").replace(" 0", " ")
        day_labels.append(label)
        volume_by_day.append(counts_by_date.get(day, 0))

    # ── Recent activity ───────────────────────────────────────────────────
    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(8).all()
    recent_activity = [{
        "action": log.action,
        "time": log.created_at.strftime("%Y-%m-%d %H:%M") if log.created_at else ""
    } for log in logs]

    return jsonify({
        "overview": {
            "activeLanguages": active_languages,
            "providers": active_providers,
            "translationRequests": translation_count,
            "installationTime": install_time
        },
        "analytics": {
            "volumeByDay": volume_by_day,
            "dayLabels": day_labels,
        },
        "recentActivity": recent_activity
    })


@dashboard_bp.route("/api/dashboard/extension", methods=["GET", "OPTIONS"])
def api_dashboard_extension():
    """Richer dashboard endpoint for the Shopify app-home extension."""
    if request.method == "OPTIONS":
        return "", 204

    try:
        import requests as req
        total_translations = Translation.query.count()
        lang_settings = get_setting("language_settings", {})
        targets = lang_settings.get("targets", [])
        provider_settings = get_setting("provider_settings", get_default_provider_settings())
        provider = provider_settings.get("provider", "Not configured")

        store_setting = get_setting("store_setting", {})
        store_url = store_setting.get("store_url", "")
        store_status = "Not configured"
        if store_url:
            try:
                token = store_setting.get("access_token", "")
                r = req.get(
                    f"https://{store_url}/admin/api/2026-04/shop.json",
                    headers={"X-Shopify-Access-Token": token},
                    timeout=5
                )
                store_status = "Connected" if r.status_code == 200 else "Token error"
            except Exception:
                store_status = "Unreachable"

        page_count = db.session.query(PageContent.page).distinct().count()

        most_used_row = (
            db.session.query(Translation.target_language, func.count(Translation.id).label("cnt"))
            .group_by(Translation.target_language)
            .order_by(func.count(Translation.id).desc())
            .first()
        )
        most_used_lang = most_used_row[0] if most_used_row else (targets[0] if targets else "—")

        logs = AuditLog.query.order_by(AuditLog.id.desc()).limit(5).all()
        recent_activity = [{
            "id": log.id,
            "action": log.action,
            "time": log.created_at.strftime("%b %d, %H:%M") if log.created_at else "—",
            "status": "Success"
        } for log in logs]

        return jsonify({
            "overview": {
                "totalPages": page_count,
                "activeLanguages": len(targets),
                "translationRequests": total_translations,
                "status": "Healthy"
            },
            "analytics": {
                "translatedPages": page_count,
                "mostUsedLanguage": most_used_lang,
            },
            "settings": {
                "currentProvider": provider,
                "storeConnection": store_status
            },
            "recentActivity": recent_activity
        })

    except Exception as e:
        print(f"[api/dashboard/extension] Error: {e}")
        return jsonify({"error": str(e)}), 500


@dashboard_bp.route("/analytics", methods=["GET"])
def analytics():
    total_translations = Translation.query.count()
    last_translation = Translation.query.order_by(Translation.id.desc()).first()
    language_settings = get_setting("language_settings", {})
    last_translation_data = None
    if last_translation:
        last_translation_data = {
            "id": last_translation.id,
            "source_text": last_translation.source_text,
            "target_language": last_translation.target_language,
            "translated_text": last_translation.translated_text,
            "source_language": language_settings.get("source", "en")
        }
    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    return jsonify({
        "total_translations": total_translations,
        "total_languages": len(language_settings.get("targets", [])),
        "providers": 1 if provider_settings else 0,
        "last_translation": last_translation_data or "No translations yet"
    })


@dashboard_bp.route("/audit-history", methods=["GET"])
def get_audit_history():
    logs = AuditLog.query.order_by(AuditLog.id.desc()).all()
    return jsonify([{
        "id": log.id,
        "action": log.action,
        "created_at": str(log.created_at)
    } for log in logs])
