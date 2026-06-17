from app import app
from model import ShopifyStore

with app.app_context():
    print("DB:", app.config["SQLALCHEMY_DATABASE_URI"])

    stores = ShopifyStore.query.all()

    print("Total stores:", len(stores))

    for store in stores:
        print("-" * 50)
        print("Shop:", store.shop)
        print("Token:", store.access_token)