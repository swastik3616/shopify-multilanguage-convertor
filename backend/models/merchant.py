from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Merchant(db.Model):
    __tablename__ = "merchants"

    id = db.Column(db.Integer, primary_key=True)
    shop_domain = db.Column(db.String(255), unique=True, nullable=False, index=True)
    access_token = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    subscription = db.relationship("Subscription", back_populates="merchant", uselist=False, lazy="joined")

    def to_dict(self):
        return {
            "id": self.id,
            "shop_domain": self.shop_domain,
            "created_at": self.created_at.isoformat(),
        }
