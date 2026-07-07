import requests
import json

BACKEND_URL = "https://shopify-multilanguage-convertor.onrender.com/api/fetch-url"

def test_url(target_url):
    print(f"\n{'='*50}")
    print(f"Testing URL: {target_url}")
    print(f"{'='*50}")
    
    try:
        response = requests.post(BACKEND_URL, json={"url": target_url})
        data = response.json()
        
        if not data.get("success"):
            print("❌ Backend Error:", data.get("message"))
            return
            
        html = data.get("html", "")
        print("✅ Backend fetch successful!")
        print(f"HTML length: {len(html)} bytes")
        
        # Check cache debug headers
        if "_cache_debug" in data:
            print("\nCache Debug Info:")
            for k, v in data["_cache_debug"].items():
                if v: print(f"  {k}: {v}")
                
        # Search for products
        print("\nSearching for your products in the returned HTML:")
        products = ["jeans", "shirt", "tshirt", "Product title", "FIRST PRODUCT ONLY"]
        
        found_any = False
        html_lower = html.lower()
        for prod in products:
            if prod.lower() in html_lower:
                print(f"  ✅ FOUND: '{prod}'")
                found_any = True
            else:
                print(f"  ❌ NOT FOUND: '{prod}'")
                
        if not found_any:
            print("  ⚠️ None of the test products were found in the HTML.")
            
    except Exception as e:
        print(f"Error making request: {e}")

if __name__ == "__main__":
    # Test 1: The Homepage
    test_url("https://0jeqkm-rp.myshopify.com")
    
    # Test 2: The Catalog / Collections page
    test_url("https://0jeqkm-rp.myshopify.com/collections/all")
