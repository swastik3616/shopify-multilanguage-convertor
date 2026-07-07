"""
debug_content_compare.py
────────────────────────
Compares two "views" of a Shopify page:

  1. RAW SHOPIFY  — what requests.get() returns after the same cleaning
                    the backend /fetch-url endpoint applies (semantic tag
                    removal + tighter class-based chrome filter).
                    Extracts H1-H6, P, SPAN, BUTTON, A, LABEL — matching
                    the current frontend parser exactly.

  2. OVERLAY DB   — the saved overlay edits (/overlay/replacements) that
                    storefront.js applies client-side.

Usage:
    python debug_content_compare.py <shopify-page-url> [backend-url]

Examples:
    python debug_content_compare.py https://mystore.myshopify.com/products/my-product
    python debug_content_compare.py https://mystore.myshopify.com \\
        https://shopify-multilanguage-convertor.onrender.com
"""

import sys
import re
import requests
from urllib.parse import urlencode, urlparse
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────
BACKEND_URL    = "https://shopify-multilanguage-convertor.onrender.com"
SCRAPE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ShopifyTranslatorBot/1.0; +debug)"
}

# Tags captured by the CURRENT frontend parser
BLOCK_TAGS   = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "button", "a", "label"}
INLINE_TAGS  = {"span"}          # short inline text only (prices, badges, etc.)
SKIP_TAGS    = {"script", "style", "noscript", "template", "svg",
                "header", "footer", "nav", "aside"}
BLOCK_CHILDREN = {"div", "section", "article", "main", "ul", "ol", "table"}

# TIGHTER chrome filter — matches the current backend /fetch-url endpoint
CHROME_RE = re.compile(
    r"(^|[-_])(site-header|site-footer|site-nav|mobile-nav|mobile-menu|"
    r"cart-drawer|cart-notification|cart-popup|ajax-cart|minicart|"
    r"login-modal|account-modal|search-modal|search-drawer|"
    r"predictive-search|cookie-banner|gdpr-banner|"
    r"language-switcher|currency-switcher)([-_]|$)",
    re.IGNORECASE,
)


# ── Helpers ───────────────────────────────────────────────────────────────────
def normalize_url(raw: str) -> str:
    raw = raw.strip()
    if not raw.startswith("http"):
        raw = "https://" + raw
    p = urlparse(raw)
    return (p.scheme + "://" + p.netloc + p.path).rstrip("/")


def norm_text(t: str) -> str:
    return re.sub(r"\s+", " ", t or "").strip().lower()


def is_leaf(el) -> bool:
    """True if element has no block-level children (same logic as JS parser)."""
    return not any(c.name in BLOCK_CHILDREN for c in el.children
                   if hasattr(c, "name") and c.name)


# ── Step 1: Scrape raw Shopify HTML with current logic ───────────────────────
def scrape_raw_text(page_url: str) -> list[str]:
    print(f"\n[1] Fetching raw Shopify HTML from: {page_url}")
    resp = requests.get(page_url, headers=SCRAPE_HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    # Step A: Remove semantic landmark tags (same as backend step 1)
    for tag in soup.find_all(["header", "footer", "nav", "aside"]):
        tag.decompose()

    # Step B: Remove Shopify-specific chrome by class/id (tighter filter)
    for el in soup.find_all(True):
        if el.parent is None:
            continue
        el_id  = el.get("id", "") or ""
        el_cls = " ".join(el.get("class", []) or [])
        if CHROME_RE.search(el_id) or CHROME_RE.search(el_cls):
            el.decompose()

    # Step C: Extract from <main> (or <body> fallback)
    main = soup.find("main") or soup.find("body") or soup

    seen   = set()   # global dedup (same as JS parser seenTexts)
    texts  = []

    for el in main.find_all(True):
        tag = el.name.lower() if el.name else ""
        if tag in SKIP_TAGS:
            continue
        if not is_leaf(el):
            continue

        raw = re.sub(r"\s+", " ", el.get_text(separator=" ", strip=True)).strip()

        if tag in BLOCK_TAGS:
            if len(raw) >= 2 and len(raw) <= 300:
                n = norm_text(raw)
                if n not in seen:
                    seen.add(n)
                    texts.append(raw)

        elif tag in INLINE_TAGS:
            # SPAN: only short text (prices, badges) — max 150 chars
            if len(raw) >= 2 and len(raw) <= 150:
                n = norm_text(raw)
                if n not in seen:
                    seen.add(n)
                    texts.append(raw)

    print(f"   → Found {len(texts)} content element(s) after cleaning")
    return texts


# ── Step 2: Fetch overlay edits from backend ─────────────────────────────────
def fetch_overlay_edits(page_url: str, backend: str) -> dict[str, str]:
    """Returns {original_text: new_text} for non-translation edits."""
    qs = urlencode({"url": page_url})
    api_url = f"{backend}/overlay/replacements?{qs}"
    print(f"\n[2] Fetching overlay edits from: {api_url}")
    try:
        resp = requests.get(api_url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"   ⚠  Could not reach backend: {e}")
        return {}

    edits = {}
    for item in data.get("replacements", []):
        if not item.get("is_translation") and item.get("original_text") and item.get("new_text"):
            edits[item["original_text"].strip()] = item["new_text"]

    print(f"   → Found {len(edits)} saved overlay edit(s)")
    return edits


# ── Step 3: Compare ───────────────────────────────────────────────────────────
def compare(raw_texts: list[str], edits: dict[str, str]) -> None:
    print("\n" + "═" * 70)
    print("  COMPARISON REPORT")
    print("═" * 70)

    if not edits:
        print("\n  ⚠  No overlay edits found in the database for this URL.")
        print("     Translation page and website show the SAME (raw Shopify) content.")
        return

    norm_to_raw   = {norm_text(t): t for t in raw_texts}
    edit_norm_map = {norm_text(k): v for k, v in edits.items()}

    matched        = []
    unmatched_db   = []
    unmatched_page = []

    for raw_t in raw_texts:
        n = norm_text(raw_t)
        if n in edit_norm_map:
            matched.append((raw_t, edit_norm_map[n]))
        else:
            unmatched_page.append(raw_t)

    for orig_t in edits:
        n = norm_text(orig_t)
        if n not in norm_to_raw:
            unmatched_db.append((orig_t, edits[orig_t]))

    # ── Report ──
    if matched:
        # Deduplicate matched output for readability
        seen_pairs = set()
        print(f"\n✅  MATCHED ({len(matched)}) — Translation page WILL show the saved value:")
        print("─" * 70)
        for raw, new in matched:
            pair = (norm_text(raw), norm_text(new))
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            print(f"   SHOPIFY  : {raw[:80]}")
            print(f"   SAVED    : {new[:80]}")
            print()

    if unmatched_db:
        print(f"\n❌  IN DB BUT NOT FOUND ON PAGE ({len(unmatched_db)}) — MISMATCH:")
        print("─" * 70)
        print("   These edits are saved but the scraper couldn't find the original")
        print("   text on the page. Translation page will show old Shopify value.\n")
        for orig, new in unmatched_db:
            print(f"   ORIGINAL : {orig[:80]}")
            print(f"   SAVED NEW: {new[:80]}")
            print()

    if unmatched_page:
        print(f"\n⬜  ON PAGE, NO EDIT SAVED ({len(unmatched_page)}) — Shows raw Shopify text:")
        print("─" * 70)
        for t in unmatched_page[:20]:
            print(f"   {t[:100]}")
        if len(unmatched_page) > 20:
            print(f"   … and {len(unmatched_page) - 20} more")

    print("\n" + "═" * 70)
    print(f"  SUMMARY: {len(matched)} matched | {len(unmatched_db)} DB-only | {len(unmatched_page)} page-only")
    print("═" * 70)


# ── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    page_url = normalize_url(sys.argv[1])
    backend  = sys.argv[2].rstrip("/") if len(sys.argv) > 2 else BACKEND_URL

    print(f"\nPage URL : {page_url}")
    print(f"Backend  : {backend}")

    raw_texts = scrape_raw_text(page_url)
    edits     = fetch_overlay_edits(page_url, backend)
    compare(raw_texts, edits)
