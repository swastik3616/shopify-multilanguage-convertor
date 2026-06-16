from app import app
from model import ShopifyStore

with app.app_context():
    stores = ShopifyStore.query.all()

    if not stores:
        print("No Shopify stores found in database")
    else:
        print(f"Found {len(stores)} store(s)\n")

        for store in stores:
            print("=" * 50)
            print("Shop:", store.shop)
            print("Access Token:", store.access_token)
            print("=" * 50)