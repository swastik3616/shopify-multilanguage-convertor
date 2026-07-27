import os
import sys

# Add the project root to python path to allow importing from backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.database import execute
from backend.utils.translation_filter import TranslationFilter

def clean_prices():
    print("Fetching all page contents...")
    rows = execute("SELECT ID, SOURCE_TEXT FROM PAGE_CONTENTS", fetch="all")
    if not rows:
        print("No contents found.")
        return

    to_delete = []
    for row in rows:
        if TranslationFilter.should_skip(row['SOURCE_TEXT']):
            to_delete.append(row['ID'])
            print(f"Deleting price: {row['SOURCE_TEXT']}")

    if to_delete:
        print(f"\nDeleting {len(to_delete)} matching price entries...")
        # delete one by one or in a loop
        for id in to_delete:
            execute("DELETE FROM PAGE_CONTENTS WHERE ID=%s", (id,))
        print("Done deleting prices.")
    else:
        print("No prices found to delete.")

if __name__ == '__main__':
    clean_prices()
