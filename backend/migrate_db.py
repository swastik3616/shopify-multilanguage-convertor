import sqlite3

from flask import current_app
from sqlalchemy import text

from database import db


def migrate():

    db_uri = current_app.config["SQLALCHEMY_DATABASE_URI"]

    # ---------------- SQLite ---------------- #

    if db_uri.startswith("sqlite"):

        db_path = db_uri.replace("sqlite:///", "")

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        migrations = [

            (
                "ALTER TABLE page_contents ADD COLUMN html_tag VARCHAR(50);",
                "html_tag"
            ),

            (
                "ALTER TABLE translations ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;",
                "created_at"
            ),

            (
                "ALTER TABLE page_contents ADD COLUMN section_id VARCHAR(255);",
                "section_id"
            ),

            (
                "ALTER TABLE page_contents ADD COLUMN resource_id BIGINT;",
                "resource_id"
            ),

            (
                "ALTER TABLE overlay_edits ADD COLUMN selector VARCHAR(1000);",
                "selector"
            ),

            (
                "ALTER TABLE overlay_edits ADD COLUMN element_tag VARCHAR(50);",
                "element_tag"
            ),

            (
                "ALTER TABLE overlay_edits ADD COLUMN field_name VARCHAR(100);",
                "field_name"
            ),

        ]

        for sql, name in migrations:

            try:
                cursor.execute(sql)
                print(f"Added {name}")

            except sqlite3.OperationalError as e:
                print(f"Skipping {name}: {e}")

        conn.commit()
        conn.close()

        print("SQLite migration complete.")

        return

    # ---------------- PostgreSQL / Others ---------------- #

    migrations = [

        (
            "ALTER TABLE page_contents ADD COLUMN html_tag VARCHAR(50);",
            "html_tag"
        ),

        (
            "ALTER TABLE translations ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
            "created_at"
        ),

        (
            "ALTER TABLE page_contents ADD COLUMN section_id VARCHAR(255);",
            "section_id"
        ),

        (
            "ALTER TABLE page_contents ADD COLUMN resource_id BIGINT;",
            "resource_id"
        ),

        (
            "ALTER TABLE overlay_edits ADD COLUMN selector VARCHAR(1000);",
            "selector"
        ),

        (
            "ALTER TABLE overlay_edits ADD COLUMN element_tag VARCHAR(50);",
            "element_tag"
        ),

        (
            "ALTER TABLE overlay_edits ADD COLUMN field_name VARCHAR(100);",
            "field_name"
        ),

    ]

    for sql, name in migrations:

        try:

            db.session.execute(text(sql))
            db.session.commit()

            print(f"Added {name}")

        except Exception:
            db.session.rollback()
            print(f"Skipping {name}")

    print("Migration complete.")


