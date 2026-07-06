#!/usr/bin/env python3
"""
Direct database cleanup - remove all overlay edits without selectors
"""

import sqlite3
import os

DB_PATH = 'instance/multilingual.db'

def cleanup():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("=" * 60)
    print("OVERLAY EDITS CLEANUP")
    print("=" * 60)
    
    try:
        # Get stats before
        cursor.execute("SELECT COUNT(*) FROM overlay_edit")
        total_before = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM overlay_edit WHERE selector IS NOT NULL")
        with_selector = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM overlay_edit WHERE selector IS NULL")
        without_selector = cursor.fetchone()[0]
        
        print(f"\nBEFORE CLEANUP:")
        print(f"  Total edits: {total_before}")
        print(f"  With selector (GOOD): {with_selector}")
        print(f"  Without selector (BAD): {without_selector}")
        
        if without_selector == 0:
            print(f"\n✅ No cleanup needed - all edits are scoped!")
            conn.close()
            return
        
        # List bad edits
        cursor.execute(
            "SELECT id, original_text, new_text, url FROM overlay_edit WHERE selector IS NULL ORDER BY id"
        )
        bad_edits = cursor.fetchall()
        
        print(f"\nDELETING {len(bad_edits)} BAD EDITS (those without selectors):")
        for edit_id, orig, new, url in bad_edits:
            print(f"  [{edit_id}] '{orig}' → '{new}'")
            print(f"       URL: {url}")
        
        # Delete bad edits
        cursor.execute("DELETE FROM overlay_edit WHERE selector IS NULL")
        deleted = cursor.rowcount
        conn.commit()
        
        # Get stats after
        cursor.execute("SELECT COUNT(*) FROM overlay_edit")
        total_after = cursor.fetchone()[0]
        
        print(f"\nAFTER CLEANUP:")
        print(f"  Deleted: {deleted} edits")
        print(f"  Total remaining: {total_after}")
        
        # Show remaining good edits
        cursor.execute(
            "SELECT original_text, new_text, element_tag, selector FROM overlay_edit WHERE selector IS NOT NULL ORDER BY id"
        )
        remaining = cursor.fetchall()
        
        if remaining:
            print(f"\nREMAINING SCOPED EDITS (these WILL work):")
            for i, (orig, new, tag, selector) in enumerate(remaining, 1):
                selector_preview = selector[:60] + "..." if len(selector) > 60 else selector
                print(f"  {i}. '{orig}' → '{new}'")
                print(f"     Tag: {tag}")
                print(f"     Selector: {selector_preview}")
        
        print(f"\n{'=' * 60}")
        print("✅ CLEANUP COMPLETE!")
        print(f"{'=' * 60}")
        print(f"\nNEXT STEPS:")
        print(f"1. Go to Dashboard → Translation Workspace")
        print(f"2. Fetch your website URL")
        print(f"3. Create NEW edits (they will have proper selectors)")
        print(f"4. Save to Website")
        print(f"5. Refresh storefront - changes WILL appear ✅")
        print()
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    cleanup()
