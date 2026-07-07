import requests
import time

url = "https://0jeqkm-rp.myshopify.com"

# Standard request
r1 = requests.get(url)
print(f"Standard request: 'jeans' found = {'jeans' in r1.text.lower()}")

# No-cache request
headers = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
}
fetch_url = f"{url}?_nocache={int(time.time()*1000)}"
r2 = requests.get(fetch_url, headers=headers)
print(f"No-cache request: 'jeans' found = {'jeans' in r2.text.lower()}")
