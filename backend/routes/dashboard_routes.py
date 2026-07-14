from flask import Blueprint, jsonify, request
from database import execute
from utils.helpers import get_setting, get_default_provider_settings
from datetime import datetime, timedelta
from langdetect import detect

dashboard_bp = Blueprint("dashboard_routes", __name__)


@dashboard_bp.route("/api/dashboard", methods=["GET", "OPTIONS"])
def get_dashboard_stats():
    if request.method == "OPTIONS":
        return "", 204

    lang_settings = get_setting("language_settings", {})
    targets = lang_settings.get("targets", [])
    active_languages = len(targets)

    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    api_keys = provider_settings.get("api_keys", {})
    active_providers = sum(1 for val in api_keys.values() if val)

    translation_count = execute("SELECT COUNT(*) AS CNT FROM TRANSLATIONS", fetch="one")["CNT"]

    first_log = execute(
        "SELECT CREATED_AT FROM AUDIT_LOGS ORDER BY CREATED_AT ASC LIMIT 1", fetch="one"
    )
    install_time = (
        first_log["CREATED_AT"].strftime("%Y-%m-%d %H:%M")
        if first_log and first_log.get("CREATED_AT")
        else "N/A"
    )

    today = datetime.utcnow().date()
    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    recent_rows = execute(
        "SELECT CREATED_AT FROM TRANSLATIONS WHERE CREATED_AT >= %s",
        (seven_days_ago,),
        fetch="all",
    ) or []

    counts_by_date = {}
    for row in recent_rows:
        d = row["CREATED_AT"].date() if row.get("CREATED_AT") else None
        if d:
            counts_by_date[d] = counts_by_date.get(d, 0) + 1

    volume_by_day, day_labels = [], []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        label = day.strftime("%a %d").replace(" 0", " ")
        day_labels.append(label)
        volume_by_day.append(counts_by_date.get(day, 0))

    log_rows = execute(
        "SELECT ACTION, CREATED_AT FROM AUDIT_LOGS ORDER BY CREATED_AT DESC LIMIT 8",
        fetch="all",
    ) or []
    recent_activity = [
        {
            "action": r["ACTION"],
            "time": r["CREATED_AT"].strftime("%Y-%m-%d %H:%M") if r.get("CREATED_AT") else "",
        }
        for r in log_rows
    ]

    return jsonify({
        "overview": {
            "activeLanguages": active_languages,
            "providers": active_providers,
            "translationRequests": translation_count,
            "installationTime": install_time,
        },
        "analytics": {
            "volumeByDay": volume_by_day,
            "dayLabels": day_labels,
        },
        "recentActivity": recent_activity,
    })


@dashboard_bp.route("/api/dashboard/extension", methods=["GET", "OPTIONS"])
def api_dashboard_extension():
    if request.method == "OPTIONS":
        return "", 204

    try:
        import requests as req

        total_translations = execute("SELECT COUNT(*) AS CNT FROM TRANSLATIONS", fetch="one")["CNT"]

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
                    timeout=5,
                )
                store_status = "Connected" if r.status_code == 200 else "Token error"
            except Exception:
                store_status = "Unreachable"

        page_count = execute(
            "SELECT COUNT(DISTINCT PAGE) AS CNT FROM PAGE_CONTENTS", fetch="one"
        )["CNT"]

        most_used_row = execute(
            "SELECT TARGET_LANGUAGE FROM TRANSLATIONS "
            "GROUP BY TARGET_LANGUAGE ORDER BY COUNT(*) DESC LIMIT 1",
            fetch="one",
        )
        most_used_lang = (
            most_used_row["TARGET_LANGUAGE"]
            if most_used_row
            else (targets[0] if targets else "—")
        )

        logs = execute(
            "SELECT ID, ACTION, CREATED_AT FROM AUDIT_LOGS ORDER BY ID DESC LIMIT 5",
            fetch="all",
        ) or []
        recent_activity = [
            {
                "id": r["ID"],
                "action": r["ACTION"],
                "time": r["CREATED_AT"].strftime("%b %d, %H:%M") if r.get("CREATED_AT") else "—",
                "status": "Success",
            }
            for r in logs
        ]

        return jsonify({
            "overview": {
                "totalPages": page_count,
                "activeLanguages": len(targets),
                "translationRequests": total_translations,
                "status": "Healthy",
            },
            "analytics": {
                "translatedPages": page_count,
                "mostUsedLanguage": most_used_lang,
            },
            "settings": {
                "currentProvider": provider,
                "storeConnection": store_status,
            },
            "recentActivity": recent_activity,
        })

    except Exception as e:
        print(f"[api/dashboard/extension] Error: {e}")
        return jsonify({"error": str(e)}), 500


@dashboard_bp.route("/analytics", methods=["GET"])
def analytics():
    total_translations = execute("SELECT COUNT(*) AS CNT FROM TRANSLATIONS", fetch="one")["CNT"]

    last_row = execute(
        "SELECT ID, SOURCE_TEXT, TARGET_LANGUAGE, TRANSLATED_TEXT "
        "FROM TRANSLATIONS ORDER BY ID DESC LIMIT 1",
        fetch="one",
    )

    language_settings = get_setting("language_settings", {})
    last_translation_data = None

    if last_row:
        source_language = language_settings.get("source", "en")
        try:
            detected_code = detect(last_row["SOURCE_TEXT"])
            if detected_code:
                source_language = detected_code
        except Exception as e:
            print(f"[analytics] Language detection failed: {e}")

        last_translation_data = {
            "id": last_row["ID"],
            "source_text": last_row["SOURCE_TEXT"],
            "target_language": last_row["TARGET_LANGUAGE"],
            "translated_text": last_row["TRANSLATED_TEXT"],
            "source_language": source_language,
        }

    provider_settings = get_setting("provider_settings", get_default_provider_settings())
    return jsonify({
        "total_translations": total_translations,
        "total_languages": len(language_settings.get("targets", [])),
        "providers": 1 if provider_settings else 0,
        "last_translation": last_translation_data or "No translations yet",
    })


@dashboard_bp.route("/audit-history", methods=["GET"])
def get_audit_history():
    days = request.args.get("days")

    if days and days.isdigit():
        threshold = datetime.utcnow() - timedelta(days=int(days))
        logs = execute(
            "SELECT ID, ACTION, CREATED_AT FROM AUDIT_LOGS "
            "WHERE CREATED_AT >= %s ORDER BY ID DESC",
            (threshold,),
            fetch="all",
        ) or []
        usage_rows = execute(
            "SELECT TARGET_LANGUAGE, COUNT(*) AS CNT FROM TRANSLATIONS "
            "WHERE CREATED_AT >= %s GROUP BY TARGET_LANGUAGE ORDER BY CNT DESC",
            (threshold,),
            fetch="all",
        ) or []
    else:
        logs = execute(
            "SELECT ID, ACTION, CREATED_AT FROM AUDIT_LOGS ORDER BY ID DESC",
            fetch="all",
        ) or []
        usage_rows = execute(
            "SELECT TARGET_LANGUAGE, COUNT(*) AS CNT FROM TRANSLATIONS "
            "GROUP BY TARGET_LANGUAGE ORDER BY CNT DESC",
            fetch="all",
        ) or []

    overview = [{"language": r["TARGET_LANGUAGE"], "count": r["CNT"]} for r in usage_rows]

    return jsonify({
        "logs": [
            {
                "id": r["ID"],
                "action": r["ACTION"],
                "created_at": str(r["CREATED_AT"]),
            }
            for r in logs
        ],
        "overview": overview,
    })
