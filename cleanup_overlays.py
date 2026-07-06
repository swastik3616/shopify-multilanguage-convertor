#!/usr/bin/env python3
"""Clean up invalid overlay edits (those with null selector)"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.database import db
from backend.model import OverlayEdit
from flask import Flask

# Create app context
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///instance/multilingual.db'
db.init_app(app)

with app.app_context():
    # Count before
    total_before = OverlayEdit.query.count()
    no_selector = OverlayEdit.query.filter_by(selector=None).count()
    
    # Delete old edits with no selector (these cause global replacement)
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
        print(f"  - {r.original_text} → {r.new_text} ({r.element_tag})")
