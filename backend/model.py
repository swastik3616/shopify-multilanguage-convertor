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
        default=datetime.utcnow
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

    html_tag = db.Column(
        db.String(50),
        nullable=True
    )

    section_id = db.Column(
        db.String(255),
        nullable=True
    )

    resource_id = db.Column(
        db.BigInteger,
        nullable=True
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


class OverlayEdit(db.Model):
    __tablename__ = "overlay_edits"

    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(500), nullable=False)
    original_text = db.Column(db.Text, nullable=False)
    new_text = db.Column(db.Text, nullable=False)
    is_translation = db.Column(db.Boolean, default=False)
    target_language = db.Column(db.String(100), nullable=True)
    selector = db.Column(db.String(1000), nullable=True)
    element_tag = db.Column(db.String(50), nullable=True)
    field_name = db.Column(db.String(100), nullable=True)