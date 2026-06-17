from model import ShopifyStore
from app import app

with app.app_context():
    stores = ShopifyStore.query.all()

    print("Total stores:", len(stores))

    for store in stores:
        print(store.shop)