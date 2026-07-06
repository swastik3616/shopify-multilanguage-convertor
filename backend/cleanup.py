import sys
sys.path.insert(0, '.')
from database import db
from model import OverlayEdit
from app import app

with app.app_context():
    total_before = OverlayEdit.query.count()
    no_selector = OverlayEdit.query.filter_by(selector=None).count()
    deleted = OverlayEdit.query.filter_by(selector=None).delete()
    db.session.commit()
    total_after = OverlayEdit.query.count()
    
    print(f"✓ Cleanup complete:")
    print(f"  Total before: {total_before}")
    print(f"  Deleted (selector=null): {deleted}")
    print(f"  Total after: {total_after}")
    print(f"\nRemaining edits with selectors:")
    remaining = OverlayEdit.query.all()
    for r in remaining:
        print(f"  - '{r.original_text}' → '{r.new_text}' ({r.element_tag})")
