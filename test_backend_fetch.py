import requests
import time
url = "https://0jeqkm-rp.myshopify.com"
headers = {"User-Agent": "Mozilla/5.0 (compatible; ShopifyTranslatorBot/1.0; +content-fetch)"}
print(f"Fetching {url}")
try:
    fetch_url = f"{url}?_nocache={int(time.time()*1000)}"
    resp = requests.get(fetch_url, headers=headers, timeout=12)
    html = resp.text
    if "jeans" in html.lower() or "shirt" in html.lower():
        print("SUCCESS! Found new products in HTML.")
        for prod in ["jeans", "shirt", "tshirt", "FIRST PRODUCT ONLY"]:
            if prod.lower() in html.lower():
                print(f" - Found: {prod}")
    else:
        print("FAILED to find new products.")
        if "product title" in html.lower():
            print(" - Still seeing 'Product title' (Cached version)")
except Exception as e:
    print(f"Error: {e}")
