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

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=True          # nullable so existing rows don't break
    )


class PageContent(db.Model):
    __tablename__ = "page_contents"

    id = db.Column(db.Integer, primary_key=True)

    page = db.Column(
        db.String(255),
        nullable=False
    )

    key = db.Column(
        db.String(255),
        nullable=False
    )

    source_text = db.Column(
        db.Text,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint('page', 'key', name='uq_page_key'),
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

    __table_args__ = (
        db.UniqueConstraint('shop', name='uq_shop'),
    )


class AppSetting(db.Model):
    __tablename__ = "app_settings"

    id = db.Column(db.Integer, primary_key=True)

    key = db.Column(
        db.String(255),
        unique=True,
        nullable=False
    )

    value = db.Column(
        db.Text,
        nullable=False
    )