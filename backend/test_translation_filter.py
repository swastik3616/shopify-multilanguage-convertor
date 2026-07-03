"""
Test script to verify translation filter is working correctly
Run this to validate email, phone, URL exclusions
"""

from utils.translation_filter import TranslationFilter

# Test cases
test_cases = [
    ("contact@shop.com", True, "Email should be skipped"),
    ("Call us at +1-800-123-4567", False, "Text with phone should NOT be skipped (mixed content)"),
    ("+1-800-123-4567", True, "Phone only should be skipped"),
    ("Visit https://example.com for more info", False, "Text with URL should NOT be skipped (mixed)"),
    ("https://example.com", True, "URL only should be skipped"),
    ("123", True, "Pure number should be skipped"),
    ("Product ID: 456", False, "Mixed content should NOT be skipped"),
    ("Beautiful watch for $99", False, "Regular text should NOT be skipped"),
    ("hello@world.co.uk", True, "Email with multiple dots should be skipped"),
]

print("=" * 70)
print("TRANSLATION FILTER TEST")
print("=" * 70)

passed = 0
failed = 0

for text, should_skip, description in test_cases:
    result = TranslationFilter.should_skip(text)
    status = "✓ PASS" if result == should_skip else "✗ FAIL"
    
    if result == should_skip:
        passed += 1
    else:
        failed += 1
    
    print(f"\n{status}")
    print(f"  Text: {text[:50]}")
    print(f"  Expected to skip: {should_skip}, Got: {result}")
    print(f"  Note: {description}")

print("\n" + "=" * 70)
print(f"RESULTS: {passed} passed, {failed} failed out of {len(test_cases)} tests")
print("=" * 70)

if failed == 0:
    print("✓ All tests passed! Translation filter is working correctly.")
else:
    print("✗ Some tests failed. Check the filter logic.")
