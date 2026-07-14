import requests
import json
import re

def extract_json_object(text):
    start = None
    depth = 0
    for i, ch in enumerate(text):
        if ch == '{':
            if start is None:
                start = i
            depth += 1
        elif ch == '}' and depth > 0:
            depth -= 1
            if depth == 0 and start is not None:
                return text[start:i + 1]
    return text

def clean_bulk_response_text(response_text):
    text = re.sub(r'^```json\s*', '', response_text, flags=re.IGNORECASE)
    text = re.sub(r'^```\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()
    text = extract_json_object(text)
    text = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', text)
    text = re.sub(r'\\u(?![0-9A-Fa-f]{4})', r'\\\\u', text)
    return text

def parse_bulk_json_response(response_text):
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        cleaned_text = clean_bulk_response_text(response_text)
        return json.loads(cleaned_text)

def call_provider(provider_id_or_name, prompt):
    """
    Generic request engine that:
    1. Loads provider configuration from database.
    2. Builds headers dynamically.
    3. Builds the request payload dynamically.
    4. Replaces placeholders.
    5. Sends HTTP request.
    6. Parses the response using configured response path.
    7. Returns translated text.
    """
    from database import execute
    
    row = None
    if provider_id_or_name:
        try:
            pid = int(provider_id_or_name)
            row = execute("SELECT * FROM AI_PROVIDERS WHERE ID = %s LIMIT 1", (pid,), fetch="one")
        except ValueError:
            row = execute("SELECT * FROM AI_PROVIDERS WHERE PROVIDER_NAME = %s LIMIT 1", (provider_id_or_name,), fetch="one")
    
    if not row:
        row = execute("SELECT * FROM AI_PROVIDERS WHERE IS_ACTIVE = TRUE LIMIT 1", fetch="one")
        if not row:
            raise Exception("No active AI provider configured.")

    base_url = row.get("BASE_URL")
    endpoint = row.get("ENDPOINT")
    method = row.get("METHOD", "POST").upper()
    auth_type = row.get("AUTH_TYPE")
    auth_header = row.get("AUTH_HEADER")
    api_key = row.get("API_KEY") or ""
    req_template_str = row.get("REQUEST_TEMPLATE") or "{}"
    resp_mapping = row.get("RESPONSE_MAPPING") or ""
    headers_str = row.get("HEADERS")
    model = row.get("MODEL") or ""
    timeout = row.get("TIMEOUT") or 60

    url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"
    url = url.replace("{{model}}", model)
    url = url.replace("{{api_key}}", api_key)

    headers = {}
    if headers_str:
        try:
            headers = json.loads(headers_str)
        except json.JSONDecodeError:
            pass

    if auth_type and auth_header and api_key:
        if auth_type.lower() == "bearer":
            headers[auth_header] = f"Bearer {api_key}"
        elif auth_type.lower() == "header":
            headers[auth_header] = api_key

    # Escape the prompt so it can be safely injected into the JSON template string
    if isinstance(prompt, str):
        prompt_escaped = json.dumps(prompt)[1:-1]
    else:
        prompt_escaped = json.dumps(json.dumps(prompt))[1:-1]

    req_body_str = req_template_str.replace("{{model}}", model)
    req_body_str = req_body_str.replace("{{prompt}}", prompt_escaped)
    req_body_str = req_body_str.replace("{{temperature}}", "0.3")
    req_body_str = req_body_str.replace("{{max_tokens}}", "4096")
    
    try:
        payload = json.loads(req_body_str)
    except json.JSONDecodeError as e:
        raise Exception(f"Invalid request template JSON after placeholder replacement: {e}")

    res = requests.request(method, url, headers=headers, json=payload, timeout=timeout)
    res.raise_for_status()

    resp_json = res.json()
    
    parts = re.split(r'\.|\[|\]', resp_mapping)
    parts = [p for p in parts if p]
    
    val = resp_json
    for p in parts:
        if isinstance(val, list) and p.isdigit():
            val = val[int(p)]
        elif isinstance(val, dict):
            val = val.get(p)
        else:
            raise Exception(f"Failed to parse response at path '{p}'")

    if not isinstance(val, str):
        val = str(val)
        
    return val.strip()

def get_provider_response(provider, model, api_key, source_text, target_language):
    prompt = f"Translate the following text to {target_language}. Only return the translated text without any quotes or explanations.\n\nText: {source_text}"
    return call_provider(provider, prompt)

def get_bulk_provider_response(provider, model, api_key, source_texts_dict, target_language):
    prompt = (
        f"You are a professional translator. Translate the following JSON object's values to {target_language}. "
        "Return ONLY a valid JSON object with the exact same keys and the translated values. "
        "Do not include any markdown formatting, explanations, or backticks.\n\n"
        f"Input: {json.dumps(source_texts_dict)}"
    )
    
    try:
        response_text = call_provider(provider, prompt)
        parsed = parse_bulk_json_response(response_text)
        if not isinstance(parsed, dict) or not parsed:
            raise ValueError("Parsed result is not a valid JSON object or is empty.")
        return parsed
    except Exception as e:
        print(f"Bulk Translation Error ({provider}):", str(e))
        print("Falling back to single item translation...")
        fallback = {}
        for key, text in source_texts_dict.items():
            fallback[key] = get_provider_response(provider, model, api_key, text, target_language)
        return fallback
