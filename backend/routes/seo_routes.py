import requests
from flask import Blueprint, jsonify, request
from database import execute
from utils.helpers import get_setting, get_default_provider_settings, get_shopify_credentials
from utils.ai_provider import get_provider_response

seo_bp = Blueprint("seo_routes", __name__)


@seo_bp.route("/api/seo-resources", methods=["GET", "OPTIONS"])
def get_seo_resources():
    if request.method == "OPTIONS":
        return "", 204

    resource_type = request.args.get("type", "pages").lower()
    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return jsonify({"success": False, "message": "Store not connected"}), 400

    graphql_type = "PRODUCT" if resource_type == "products" else "PAGE"
    query = """
    query {
      translatableResources(first: 50, resourceType: %s) {
        edges {
          node {
            resourceId
            translatableContent {
              key
              value
              digest
              locale
            }
          }
        }
      }
    }
    """ % graphql_type

    headers = {"X-Shopify-Access-Token": access_token, "Content-Type": "application/json"}
    url = f"https://{store_url}/admin/api/2026-04/graphql.json"

    try:
        res = requests.post(url, headers=headers, json={"query": query})
        res.raise_for_status()
        data = res.json()

        if "errors" in data:
            return jsonify({"success": False, "message": f"GraphQL Error: {data['errors'][0].get('message', 'Unknown error')}"}), 400

        edges = ((data.get("data") or {}).get("translatableResources") or {}).get("edges", [])
        resources = []

        for edge in edges:
            node = edge["node"]
            resource_id = node["resourceId"]
            content = node.get("translatableContent", [])
            title = meta_title = meta_title_digest = meta_desc = meta_desc_digest = ""

            for item in content:
                if item["key"] == "title":
                    title = item["value"]
                elif item["key"] == "meta_title":
                    meta_title = item["value"]
                    meta_title_digest = item["digest"]
                elif item["key"] == "meta_description":
                    meta_desc = item["value"]
                    meta_desc_digest = item["digest"]

            resources.append({
                "id": resource_id,
                "title": title or resource_id.split("/")[-1],
                "originalMetaTitle": meta_title,
                "titleDigest": meta_title_digest,
                "originalMetaDescription": meta_desc,
                "descriptionDigest": meta_desc_digest,
            })

        return jsonify({"success": True, "resources": resources})

    except requests.exceptions.RequestException as e:
        status_code = e.response.status_code if e.response else 500
        if status_code == 401:
            return jsonify({"success": False, "message": "Shopify authentication failed."}), 401
        return jsonify({"success": False, "message": str(e)}), status_code
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@seo_bp.route("/api/seo-update-original", methods=["POST", "OPTIONS"])
def update_original_seo():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    resource_id = data.get("resourceId")
    meta_title = data.get("metaTitle", "")
    meta_desc = data.get("metaDescription", "")

    if not resource_id:
        return jsonify({"success": False, "message": "resourceId is required"}), 400

    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return jsonify({"success": False, "message": "Store not connected"}), 400

    headers = {"X-Shopify-Access-Token": access_token, "Content-Type": "application/json"}
    is_product = "Product" in resource_id

    if is_product:
        mutation = """
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            userErrors { message }
          }
        }
        """
        variables = {"input": {"id": resource_id, "seo": {"title": meta_title, "description": meta_desc}}}
    else:
        metafields = []
        if meta_title:
            metafields.append({"namespace": "global", "key": "title_tag", "type": "single_line_text_field", "value": meta_title})
        if meta_desc:
            metafields.append({"namespace": "global", "key": "description_tag", "type": "single_line_text_field", "value": meta_desc})
        mutation = """
        mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
          pageUpdate(id: $id, page: $page) {
            userErrors { message }
          }
        }
        """
        variables = {"id": resource_id, "page": {"metafields": metafields}}

    try:
        res = requests.post(f"https://{store_url}/admin/api/2026-04/graphql.json", headers=headers, json={"query": mutation, "variables": variables})
        res.raise_for_status()
        data = res.json()
        if "errors" in data:
            return jsonify({"success": False, "message": data["errors"][0].get("message", "Unknown error")}), 400
        mutation_name = "productUpdate" if is_product else "pageUpdate"
        user_errors = ((data.get("data") or {}).get(mutation_name) or {}).get("userErrors", [])
        if user_errors:
            return jsonify({"success": False, "message": user_errors[0].get("message", "Update failed")}), 400

        # Store in Snowflake
        db_key = f"seo_{resource_id.split('/')[-1]}"
        db_source_text = f"Title: {meta_title}\nDescription: {meta_desc}"
        existing = execute(
            "SELECT ID FROM PAGE_CONTENTS WHERE PAGE='seo' AND KEY=%s LIMIT 1",
            (db_key,), fetch="one",
        )
        if existing:
            execute("UPDATE PAGE_CONTENTS SET SOURCE_TEXT=%s WHERE ID=%s", (db_source_text, existing["ID"]))
        else:
            execute(
                "INSERT INTO PAGE_CONTENTS (PAGE, KEY, SOURCE_TEXT) VALUES ('seo', %s, %s)",
                (db_key, db_source_text),
            )
        execute(
            "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, CURRENT_TIMESTAMP)",
            (f"Updated SEO for {db_key}",),
        )
        return jsonify({"success": True})

    except requests.exceptions.RequestException as e:
        status_code = e.response.status_code if e.response else 500
        if status_code == 401:
            return jsonify({"success": False, "message": "Shopify authentication failed."}), 401
        return jsonify({"success": False, "message": str(e)}), status_code
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@seo_bp.route("/api/seo-translate", methods=["POST", "OPTIONS"])
def translate_seo():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json
    resource_id = data.get("resourceId")
    locale = data.get("locale")
    meta_title = data.get("metaTitle")
    meta_desc = data.get("metaDescription")
    title_digest = data.get("titleDigest")
    desc_digest = data.get("descriptionDigest")

    if not resource_id or not locale:
        return jsonify({"success": False, "message": "resourceId and locale required"}), 400

    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return jsonify({"success": False, "message": "Store not connected"}), 400

    translations = []
    if meta_title and title_digest:
        translations.append({"key": "meta_title", "value": meta_title, "translatableContentDigest": title_digest, "locale": locale})
    if meta_desc and desc_digest:
        translations.append({"key": "meta_description", "value": meta_desc, "translatableContentDigest": desc_digest, "locale": locale})

    if not translations:
        return jsonify({"success": False, "message": "No translations provided or missing digests."}), 400

    mutation = """
    mutation translationsRegister($resourceId: ID!, $translations: [TranslationInput!]!) {
      translationsRegister(resourceId: $resourceId, translations: $translations) {
        userErrors { message field }
      }
    }
    """
    variables = {"resourceId": resource_id, "translations": translations}
    headers = {"X-Shopify-Access-Token": access_token, "Content-Type": "application/json"}
    url = f"https://{store_url}/admin/api/2026-04/graphql.json"

    try:
        res = requests.post(url, headers=headers, json={"query": mutation, "variables": variables})
        res.raise_for_status()
        data = res.json()
        user_errors = ((data.get("data") or {}).get("translationsRegister") or {}).get("userErrors", [])

        if user_errors:
            error_msg = ", ".join([e["message"] for e in user_errors])
            if "not a valid locale" in error_msg.lower() or "not enabled" in error_msg.lower():
                enable_mutation = """
                mutation shopLocaleEnable($locale: String!) {
                  shopLocaleEnable(locale: $locale) {
                    userErrors { message }
                  }
                }
                """
                enable_res = requests.post(url, headers=headers, json={"query": enable_mutation, "variables": {"locale": locale}})
                enable_data = enable_res.json()
                enable_errors = ((enable_data.get("data") or {}).get("shopLocaleEnable") or {}).get("userErrors", [])

                if not enable_errors:
                    retry_res = requests.post(url, headers=headers, json={"query": mutation, "variables": variables})
                    retry_data = retry_res.json()
                    retry_user_errors = ((retry_data.get("data") or {}).get("translationsRegister") or {}).get("userErrors", [])
                    if not retry_user_errors:
                        execute(
                            "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, CURRENT_TIMESTAMP)",
                            (f"SEO Translated {resource_id.split('/')[-1]} to {locale}",),
                        )
                        return jsonify({"success": True, "message": f"Translations registered (Auto-enabled {locale} locale)"})
                    else:
                        error_msg = ", ".join([e["message"] for e in retry_user_errors])

            return jsonify({"success": False, "message": f"GraphQL Error: {error_msg}"}), 400

        execute(
            "INSERT INTO AUDIT_LOGS (ACTION, CREATED_AT) VALUES (%s, CURRENT_TIMESTAMP)",
            (f"SEO Translated {resource_id.split('/')[-1]} to {locale}",),
        )
        return jsonify({"success": True, "message": "Translations registered"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
