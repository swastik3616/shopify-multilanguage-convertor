import requests
from model import ShopifyStore
from app import app

with app.app_context():
    store = ShopifyStore.query.first()

    if not store:
        print("❌ No store found in database")
        exit()

    print("Store Name:", store.shop)
    print("Access Token:", store.access_token)

    headers = {
        "X-Shopify-Access-Token": store.access_token
    }

    response = requests.get(
        f"https://{store.shop}/admin/api/2025-07/shop.json",
        headers=headers
    )

    print("\nStatus Code:", response.status_code)

    if response.status_code == 200:
        data = response.json()
        print("Shop Name:", data["shop"]["name"])
        print("Domain:", data["shop"]["domain"])
        print("Owner:", data["shop"]["shop_owner"])
    else:
        print(response.text)