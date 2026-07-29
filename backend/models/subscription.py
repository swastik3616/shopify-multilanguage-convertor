from datetime import datetime, timezone
from models.merchant import db


class Subscription(db.Model):
    __tablename__ = "subscriptions"

    id = db.Column(db.Integer, primary_key=True)
    shop_domain = db.Column(db.String(255), db.ForeignKey("merchants.shop_domain"), unique=True, nullable=False, index=True)
    plan_name = db.Column(db.String(50), nullable=False)
    shopify_subscription_id = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), nullable=False, default="ACTIVE")
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    merchant = db.relationship("Merchant", back_populates="subscription")

    def to_dict(self):
        return {
            "id": self.id,
            "shop_domain": self.shop_domain,
            "plan_name": self.plan_name,
            "shopify_subscription_id": self.shopify_subscription_id,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }
