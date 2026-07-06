#!/usr/bin/env python3
"""
Clean up all overlay edits without selectors to fix the scoping issue.
This ensures only properly scoped edits (with selectors) will be applied.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app import app
from database import db
from model import OverlayEdit

def cleanup_edits():
    with app.app_context():
        print("=" * 60)
        print("OVERLAY EDITS CLEANUP")
        print("=" * 60)
        
        # Get stats before cleanup
        total_before = OverlayEdit.query.count()
        with_selector = OverlayEdit.query.filter(OverlayEdit.selector.isnot(None)).count()
        without_selector = OverlayEdit.query.filter(OverlayEdit.selector.is_(None)).count()
        
        print(f"\nBEFORE CLEANUP:")
        print(f"  Total edits: {total_before}")
        print(f"  With selector (GOOD): {with_selector}")
        print(f"  Without selector (BAD): {without_selector}")
        
        if without_selector == 0:
            print(f"\n✅ No cleanup needed - all edits are scoped!")
            return
        
        # List what we're deleting
        print(f"\nDELETING {without_selector} BAD EDITS (those without selectors):")
        bad_edits = OverlayEdit.query.filter(OverlayEdit.selector.is_(None)).all()
        for i, edit in enumerate(bad_edits, 1):
            print(f"  {i}. '{edit.original_text}' → '{edit.new_text}' (URL: {edit.url})")
        
        # Delete bad edits
        deleted_count = OverlayEdit.query.filter(OverlayEdit.selector.is_(None)).delete()
        db.session.commit()
        
        # Get stats after cleanup
        total_after = OverlayEdit.query.count()
        
        print(f"\nAFTER CLEANUP:")
        print(f"  Deleted: {deleted_count} edits")
        print(f"  Total remaining: {total_after}")
        
        # Show remaining good edits
        remaining = OverlayEdit.query.all()
        if remaining:
            print(f"\nREMAINING SCOPED EDITS (these WILL work):")
            for i, edit in enumerate(remaining, 1):
                print(f"  {i}. '{edit.original_text}' → '{edit.new_text}'")
                print(f"     Tag: {edit.element_tag}, Selector: {edit.selector[:80]}...")
        
        print(f"\n{'=' * 60}")
        print("✅ CLEANUP COMPLETE!")
        print(f"{'=' * 60}")
        print(f"\nNEXT STEPS:")
        print(f"1. Go to Dashboard → Translation Workspace")
        print(f"2. Fetch your website URL")
        print(f"3. Create NEW edits (they will have proper selectors now)")
        print(f"4. Save to Website")
        print(f"5. Refresh storefront - changes WILL appear ✅")
        print()

if __name__ == '__main__':
    try:
        cleanup_edits()
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
