import requests
from utils.helpers import get_shopify_credentials
import re

def fetch_shopify_pages():
    """Fetch pages from Shopify store."""
    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return []
    
    try:
        headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json"
        }
        url = f"https://{store_url}/admin/api/2026-04/pages.json"
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        return res.json().get("pages", [])
    except Exception as e:
        print(f"Error fetching Shopify pages: {str(e)}")
        return []

def fetch_shopify_products(limit=5):
    """Fetch products from Shopify store."""
    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return []
    
    try:
        headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json"
        }
        url = f"https://{store_url}/admin/api/2026-04/products.json?limit={limit}&fields=id,title,body_html,handle"
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        return res.json().get("products", [])
    except Exception as e:
        print(f"Error fetching Shopify products: {str(e)}")
        return []

def fetch_shopify_collections(limit=5):
    """Fetch collections from Shopify store."""
    store_url, access_token = get_shopify_credentials()
    if not store_url or not access_token:
        return []
    
    try:
        headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json"
        }
        url = f"https://{store_url}/admin/api/2026-04/custom_collections.json?limit={limit}&fields=id,title,body_html,handle"
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        return res.json().get("custom_collections", [])
    except Exception as e:
        print(f"Error fetching Shopify collections: {str(e)}")
        return []

def extract_text_from_html(html_text):
    """Extract plain text from HTML content."""
    if not html_text:
        return ""
    html_text = re.sub(r'<script[^>]*>.*?</script>', '', html_text, flags=re.S | re.I)
    html_text = re.sub(r'<style[^>]*>.*?</style>', '', html_text, flags=re.S | re.I)
    html_text = re.sub(r'<!--.*?-->', '', html_text, flags=re.S)
    text = re.sub(r'<[^>]+>', '', html_text)
    text = text.replace("&nbsp;", " ")
    text = text.replace("&amp;", "&")
    text = text.replace("&lt;", "<")
    text = text.replace("&gt;", ">")
    text = re.sub(r'\s+', ' ', text)
    return text.strip()[:1200]
