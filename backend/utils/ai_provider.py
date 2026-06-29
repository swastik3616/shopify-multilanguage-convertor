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

def get_provider_response(provider, model, api_key, source_text, target_language):
    prompt = f"Translate the following text to {target_language}. Only return the translated text without any quotes or explanations.\n\nText: {source_text}"
    try:
        if provider == "openai":
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3}
            res = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            res.raise_for_status()
            return res.json()["choices"][0]["message"]["content"].strip()
            
        elif provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {"contents": [{"parts":[{"text": prompt}]}]}
            res = requests.post(url, headers=headers, json=payload)
            res.raise_for_status()
            return res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            
        elif provider == "claude":
            headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
            payload = {"model": model, "max_tokens": 1024, "messages": [{"role": "user", "content": prompt}]}
            res = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            res.raise_for_status()
            return res.json()["content"][0]["text"].strip()
            
        elif provider == "groq":
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3}
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            res.raise_for_status()
            return res.json()["choices"][0]["message"]["content"].strip()
            
        elif provider == "ollama":
            url = "http://localhost:11434/api/generate"
            payload = {"model": model, "prompt": prompt, "stream": False}
            res = requests.post(url, json=payload)
            res.raise_for_status()
            return res.json()["response"].strip()
            
        else:
            return f"{source_text} translated to {target_language} (Mock - Unknown Provider)"
            
    except Exception as e:
        print(f"Provider Error ({provider}):", str(e))
        raise Exception(f"Failed to translate using {provider}: {str(e)}")

def get_bulk_provider_response(provider, model, api_key, source_texts_dict, target_language):
    prompt = (
        f"You are a professional translator. Translate the following JSON object's values to {target_language}. "
        "Return ONLY a valid JSON object with the exact same keys and the translated values. "
        "Do not include any markdown formatting, explanations, or backticks.\n\n"
        f"Input: {json.dumps(source_texts_dict)}"
    )
    
    def try_single_fallbacks():
        fallback = {}
        for key, text in source_texts_dict.items():
            fallback[key] = get_provider_response(provider, model, api_key, text, target_language)
        return fallback

    try:
        response_text = ""
        if provider == "openai":
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3}
            res = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            res.raise_for_status()
            response_text = res.json()["choices"][0]["message"]["content"].strip()
            
        elif provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {"contents": [{"parts":[{"text": prompt}]}]}
            res = requests.post(url, headers=headers, json=payload)
            res.raise_for_status()
            response_text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            
        elif provider == "claude":
            headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
            payload = {"model": model, "max_tokens": 4096, "messages": [{"role": "user", "content": prompt}]}
            res = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            res.raise_for_status()
            response_text = res.json()["content"][0]["text"].strip()
            
        elif provider == "groq":
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3}
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            res.raise_for_status()
            response_text = res.json()["choices"][0]["message"]["content"].strip()
            
        elif provider == "ollama":
            url = "http://localhost:11434/api/generate"
            payload = {"model": model, "prompt": prompt, "stream": False, "format": "json"}
            res = requests.post(url, json=payload)
            res.raise_for_status()
            response_text = res.json()["response"].strip()
            
        else:
            return try_single_fallbacks()

        parsed = parse_bulk_json_response(response_text)
        if not isinstance(parsed, dict) or not parsed:
            raise ValueError("Parsed result is not a valid JSON object or is empty.")
            
        return parsed

    except Exception as e:
        print(f"Bulk Translation Error ({provider}):", str(e))
        print("Falling back to single item translation...")
        return try_single_fallbacks()
