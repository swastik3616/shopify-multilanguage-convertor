from database import db
from datetime import datetime

class Translation(db.Model):
    __tablename__ = "translations"

    id = db.Column(db.Integer, primary_key=True)

    source_text = db.Column(
        db.Text,
        nullable=False
    )

    target_language = db.Column(
        db.String(100),
        nullable=False
    )

    translated_text = db.Column(
        db.Text,
        nullable=False
    )

class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)

    action = db.Column(
        db.String(255),
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )
    
class ShopifyStore(db.Model):
    __tablename__ = "shopify_stores"

    id = db.Column(db.Integer, primary_key=True)

    shop = db.Column(
        db.String(255),
        nullable=False
    )

    access_token = db.Column(
        db.Text,
        nullable=False
    )