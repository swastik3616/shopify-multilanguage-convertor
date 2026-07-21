from flask import Blueprint, jsonify, request
from database import execute

search_bp = Blueprint("search_routes", __name__)


@search_bp.route("/api/multilingual-search", methods=["POST", "OPTIONS"])
def multilingual_search():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json or {}
    query = (data.get("query") or "").strip()
    target_language = data.get("target_language") or ""
    page_type = data.get("page_type") or ""
    limit = min(int(data.get("limit", 50)), 200)
    offset = int(data.get("offset", 0))

    if not query:
        return jsonify({"success": False, "message": "Query is required"}), 400

    like_pattern = f"%{query}%"
    params = {"like_src": like_pattern, "limit": limit, "offset": offset}
    conditions = ["pc.SOURCE_TEXT ILIKE %(like_src)s"]

    if page_type:
        params["page_type"] = page_type
        conditions.append("pc.PAGE = %(page_type)s")

    where_clause = " AND ".join(conditions)

    if target_language:
        params["target_lang"] = target_language
        params["like_tr"] = like_pattern
        sql = f"""
            SELECT DISTINCT ON (pc.ID)
                pc.ID,
                pc.PAGE,
                pc.KEY,
                pc.SOURCE_TEXT,
                pc.HTML_TAG,
                pc.SECTION_ID,
                pc.RESOURCE_ID,
                t.ID AS TRANSLATION_ID,
                t.TRANSLATED_TEXT,
                t.TARGET_LANGUAGE
            FROM PAGE_CONTENTS pc
            LEFT JOIN TRANSLATIONS t
                ON t.SOURCE_TEXT = pc.SOURCE_TEXT
                AND t.TARGET_LANGUAGE = %(target_lang)s
            WHERE ({where_clause}) OR t.TRANSLATED_TEXT ILIKE %(like_tr)s
            ORDER BY pc.ID
            LIMIT %(limit)s OFFSET %(offset)s
        """
    else:
        sql = f"""
            SELECT
                pc.ID,
                pc.PAGE,
                pc.KEY,
                pc.SOURCE_TEXT,
                pc.HTML_TAG,
                pc.SECTION_ID,
                pc.RESOURCE_ID,
                NULL AS TRANSLATION_ID,
                NULL AS TRANSLATED_TEXT,
                NULL AS TARGET_LANGUAGE
            FROM PAGE_CONTENTS pc
            WHERE {where_clause}
            ORDER BY pc.ID
            LIMIT %(limit)s OFFSET %(offset)s
        """

    rows = execute(sql, params, fetch="all") or []

    # ── Reverse-translation fallback ─────────────────────────────────────────
    # If the query is in a non-source language and the DB returned no rows,
    # translate the query back into the source (English) language using AI,
    # then retry the search with the English equivalent.
    translated_query = None
    if target_language and not rows:
        translated_query = _translate_query_to_source(query, target_language)
        if translated_query and translated_query.lower().strip() != query.lower().strip():
            like_src_translated = f"%{translated_query}%"
            params2 = {
                "like_src": like_src_translated,
                "target_lang": target_language,
                "like_tr": like_pattern,
                "limit": limit,
                "offset": offset,
            }
            if page_type:
                params2["page_type"] = page_type

            conditions2 = ["pc.SOURCE_TEXT ILIKE %(like_src)s"]
            if page_type:
                conditions2.append("pc.PAGE = %(page_type)s")
            where_clause2 = " AND ".join(conditions2)

            retry_sql = f"""
                SELECT DISTINCT ON (pc.ID)
                    pc.ID,
                    pc.PAGE,
                    pc.KEY,
                    pc.SOURCE_TEXT,
                    pc.HTML_TAG,
                    pc.SECTION_ID,
                    pc.RESOURCE_ID,
                    t.ID AS TRANSLATION_ID,
                    t.TRANSLATED_TEXT,
                    t.TARGET_LANGUAGE
                FROM PAGE_CONTENTS pc
                LEFT JOIN TRANSLATIONS t
                    ON t.SOURCE_TEXT = pc.SOURCE_TEXT
                    AND t.TARGET_LANGUAGE = %(target_lang)s
                WHERE ({where_clause2}) OR t.TRANSLATED_TEXT ILIKE %(like_tr)s
                ORDER BY pc.ID
                LIMIT %(limit)s OFFSET %(offset)s
            """
            rows = execute(retry_sql, params2, fetch="all") or []

    if target_language:
        count_sql = f"""
            SELECT COUNT(DISTINCT pc.ID) AS CNT
            FROM PAGE_CONTENTS pc
            LEFT JOIN TRANSLATIONS t
                ON t.SOURCE_TEXT = pc.SOURCE_TEXT
                AND t.TARGET_LANGUAGE = %(target_lang)s
            WHERE ({where_clause}) OR t.TRANSLATED_TEXT ILIKE %(like_tr)s
        """
    else:
        count_sql = f"""
            SELECT COUNT(*) AS CNT
            FROM PAGE_CONTENTS pc
            WHERE {where_clause}
        """

    count_row = execute(count_sql, params, fetch="one")
    total = count_row["CNT"] if count_row else 0

    source_lang = _get_source_language() if target_language else None

    results = []
    for r in rows:
        translated = r.get("TRANSLATED_TEXT")
        source = r["SOURCE_TEXT"]
        source_lang_name = source_lang or "Source"

        display_text = translated if translated else source
        display_language = target_language if translated else source_lang_name
        is_fallback = not translated and target_language != ""

        results.append({
            "id": r["ID"],
            "page": r["PAGE"],
            "key": r["KEY"],
            "source_text": source,
            "source_language": source_lang_name,
            "html_tag": r["HTML_TAG"],
            "section_id": r.get("SECTION_ID"),
            "resource_id": r.get("RESOURCE_ID"),
            "translation_id": r.get("TRANSLATION_ID"),
            "translated_text": translated,
            "target_language": r.get("TARGET_LANGUAGE") or "",
            "display_text": display_text,
            "display_language": display_language,
            "is_fallback": is_fallback,
        })

    return jsonify({
        "success": True,
        "results": results,
        "total": total,
        "query": query,
        "translated_query": translated_query,
        "target_language": target_language,
        "limit": limit,
        "offset": offset,
    })


def _translate_query_to_source(query, target_language):
    """
    Reverse-translate a user query from target_language back to the store's
    source language so we can search PAGE_CONTENTS (which is in source language).

    Strategy:
    1. Check if any TRANSLATIONS row already contains this exact text as
       TRANSLATED_TEXT for this language — reuse that SOURCE_TEXT at zero AI cost.
    2. Otherwise, call the configured AI provider to translate the query.
    """
    # Step 1: cheap DB lookup — exact match on TRANSLATED_TEXT
    cached = execute(
        "SELECT SOURCE_TEXT FROM TRANSLATIONS "
        "WHERE TRANSLATED_TEXT ILIKE %s AND TARGET_LANGUAGE = %s LIMIT 1",
        (query, target_language),
        fetch="one",
    )
    if cached:
        return cached["SOURCE_TEXT"]

    # Step 2: AI reverse-translation
    try:
        from utils.helpers import get_provider_settings
        from utils.ai_provider import get_provider_response

        provider_settings = get_provider_settings()
        provider = provider_settings.get("provider", "openai")
        model = provider_settings.get("model", "gpt-3.5-turbo")
        api_key = provider_settings.get("api_keys", {}).get(provider, "")

        source_language = _get_source_language()
        translated = get_provider_response(
            provider, model, api_key, query, source_language
        )
        return translated.strip() if translated else None
    except Exception as e:
        print(f"[multilingual-search] Reverse translation failed: {e}")
        return None


def _get_source_language():
    row = execute(
        "SELECT NAME FROM LANGUAGES WHERE STATUS IN ('Source', 'Both') LIMIT 1",
        fetch="one",
    )
    return row["NAME"] if row else "English"
