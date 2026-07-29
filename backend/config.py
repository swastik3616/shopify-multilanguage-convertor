import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SHOPIFY_API_KEY = os.getenv("SHOPIFY_CLIENT_ID", os.getenv("SHOPIFY_API_KEY", ""))
    SHOPIFY_API_SECRET = os.getenv("SHOPIFY_CLIENT_SECRET", os.getenv("SHOPIFY_API_SECRET", ""))
    SHOPIFY_REDIRECT_URI = os.getenv("SHOPIFY_REDIRECT_URI", "")
    SHOPIFY_SCOPES = os.getenv("SHOPIFY_SCOPES", "read_products,write_products,read_content,write_content")

    SHOPIFY_API_VERSION = os.getenv("SHOPIFY_API_VERSION", "2026-07")

    ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")
    FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY", os.urandom(24).hex())

    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///dev.db")

    BILLING_TEST_MODE = os.getenv("BILLING_TEST_MODE", "true").lower() == "true"
    BILLING_TRIAL_DAYS = int(os.getenv("BILLING_TRIAL_DAYS", "0"))

    CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")

    PLANS = {
        "FREE": {"name": "Free", "price": 0, "recurrence": "EVERY_30_DAYS"},
        "BASIC": {"name": "Basic", "price": 9.0, "recurrence": "EVERY_30_DAYS"},
        "PRO": {"name": "Pro", "price": 29.0, "recurrence": "EVERY_30_DAYS"},
    }
