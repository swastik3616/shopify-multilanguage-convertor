from database import db

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