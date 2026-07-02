from app import app, db
from sqlalchemy import text
import sqlite3

def migrate():
    with app.app_context():
        # Get the database URI
        db_uri = app.config['SQLALCHEMY_DATABASE_URI']
        
        # Simple SQLite migration since we are using sqlite:///translator.db
        if db_uri.startswith('sqlite'):
            db_path = db_uri.replace('sqlite:///', '')
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            try:
                print("Adding html_tag column...")
                cursor.execute("ALTER TABLE page_contents ADD COLUMN html_tag VARCHAR(50);")
            except sqlite3.OperationalError as e:
                print(f"Skipping html_tag: {e}")
                
            try:
                print("Adding section_id column...")
                cursor.execute("ALTER TABLE page_contents ADD COLUMN section_id VARCHAR(255);")
            except sqlite3.OperationalError as e:
                print(f"Skipping section_id: {e}")
                
            try:
                print("Adding resource_id column...")
                cursor.execute("ALTER TABLE page_contents ADD COLUMN resource_id BIGINT;")
            except sqlite3.OperationalError as e:
                print(f"Skipping resource_id: {e}")
                
            conn.commit()
            conn.close()
            print("Migration complete!")
        else:
            # Postgres/MySQL fallback using SQLAlchemy text
            try:
                db.session.execute(text("ALTER TABLE page_contents ADD COLUMN html_tag VARCHAR(50);"))
                db.session.execute(text("ALTER TABLE page_contents ADD COLUMN section_id VARCHAR(255);"))
                db.session.execute(text("ALTER TABLE page_contents ADD COLUMN resource_id BIGINT;"))
                db.session.commit()
                print("Migration complete for non-SQLite DB!")
            except Exception as e:
                print(f"Migration error (already run?): {e}")
                db.session.rollback()

if __name__ == "__main__":
    migrate()
