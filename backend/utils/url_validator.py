"""
URL Validation Module for Shopify Multilingual Translator

This module provides URL validation and security checks to ensure that
only URLs from the installed Shopify store are processed by the application.

Functions:
  - get_store_domain(): Retrieve the configured Shopify store domain from the database
  - validate_shopify_url(url, store_domain): Validate that a URL belongs to the Shopify store
  - is_valid_url(url): Check if a URL has valid format
  - normalize_url(url): Normalize URL to a consistent format
  - get_domain_from_url(url): Extract domain from URL
"""

import re
from urllib.parse import urlparse
from utils.helpers import get_current_store, get_shopify_credentials, normalize_shopify_store_url, get_setting
from database import execute as _db_execute
import logging

# Configure logging
logger = logging.getLogger(__name__)


def get_store_domain(shop=None):
    """
    Retrieve the configured Shopify store domain from the database.
    
    Args:
        shop (str, optional): Shopify shop domain. If not provided, tries to get from request context.
    
    Returns:
        str: Normalized store domain (hostname only, e.g., 'mystore.myshopify.com')
        None: If no store is configured
    
    Example:
        >>> domain = get_store_domain()
        >>> print(domain)
        'mystore.myshopify.com'
    """
    try:
        # Try to get from Shopify credentials (authenticated store)
        store_url, _ = get_shopify_credentials(shop)
        if store_url:
            normalized = normalize_shopify_store_url(store_url)
            logger.info(f"[get_store_domain] Retrieved from credentials: {normalized}")
            return normalized
        
        # Fallback: try legacy store_setting
        store_cfg = get_setting("store_setting", {})
        store_url = store_cfg.get("store_url", "")
        if store_url:
            normalized = normalize_shopify_store_url(store_url)
            logger.info(f"[get_store_domain] Retrieved from legacy settings: {normalized}")
            return normalized
        
        logger.warning("[get_store_domain] No store domain found")
        return None
    
    except Exception as e:
        logger.error(f"[get_store_domain] Error retrieving store domain: {e}")
        return None


def is_valid_url(url):
    """
    Validate if a URL has a valid format.
    
    Args:
        url (str): URL to validate
    
    Returns:
        bool: True if URL is valid, False otherwise
    
    Example:
        >>> is_valid_url("https://mystore.myshopify.com/products/example")
        True
        >>> is_valid_url("not a url")
        False
    """
    if not url or not isinstance(url, str):
        return False
    
    url = url.strip()
    if not url:
        return False
    
    # Add scheme if missing
    if not url.startswith(('http://', 'https://')):
        url = f"https://{url}"
    
    try:
        result = urlparse(url)
        # Check for required URL components
        return all([result.scheme in ('http', 'https'), result.netloc])
    except Exception:
        return False


def get_domain_from_url(url):
    """
    Extract domain (hostname) from a URL.
    
    Args:
        url (str): URL to parse
    
    Returns:
        str: Normalized domain name (lowercase, hostname only)
        None: If URL parsing fails
    
    Example:
        >>> get_domain_from_url("https://mystore.myshopify.com/products/example")
        'mystore.myshopify.com'
    """
    try:
        if not url:
            return None
        
        # Add scheme if missing
        if not url.startswith(('http://', 'https://')):
            url = f"https://{url}"
        
        parsed = urlparse(url)
        domain = (parsed.hostname or "").lower().strip()
        
        if not domain:
            logger.warning(f"[get_domain_from_url] Could not extract domain from URL: {url}")
            return None
        
        return domain
    
    except Exception as e:
        logger.error(f"[get_domain_from_url] Error parsing URL '{url}': {e}")
        return None


def normalize_url(url):
    """
    Normalize a URL to a consistent format.
    
    Args:
        url (str): URL to normalize
    
    Returns:
        str: Normalized URL (with scheme, lowercase domain)
        None: If URL is invalid
    
    Example:
        >>> normalize_url("mystore.myshopify.com/products/example")
        'https://mystore.myshopify.com/products/example'
    """
    try:
        if not url or not isinstance(url, str):
            return None
        
        url = url.strip()
        
        # Add scheme if missing
        if not url.startswith(('http://', 'https://')):
            url = f"https://{url}"
        
        parsed = urlparse(url)
        if not parsed.netloc:
            return None
        
        # Reconstruct URL with lowercase domain
        domain = parsed.hostname.lower()
        scheme = parsed.scheme
        path = parsed.path or ""
        query = parsed.query or ""
        
        result = f"{scheme}://{domain}{path}"
        if query:
            result += f"?{query}"
        
        return result
    
    except Exception as e:
        logger.error(f"[normalize_url] Error normalizing URL '{url}': {e}")
        return None


def validate_shopify_url(url, store_domain=None):
    """
    Validate that a URL belongs to the configured Shopify store.
    
    This function performs comprehensive URL validation:
    1. Checks if URL format is valid
    2. Extracts domain from URL
    3. Compares with store domain
    4. Enforces exact domain match
    
    Args:
        url (str): URL to validate
        store_domain (str, optional): Shopify store domain. If not provided, retrieves from config.
    
    Returns:
        dict: {
            'valid': bool,
            'domain': str (extracted domain from URL),
            'store_domain': str (configured store domain),
            'message': str (error message if not valid)
        }
    
    Example:
        >>> result = validate_shopify_url("https://mystore.myshopify.com/products/example")
        >>> print(result)
        {'valid': True, 'domain': 'mystore.myshopify.com', 'store_domain': 'mystore.myshopify.com', 'message': None}
        
        >>> result = validate_shopify_url("https://google.com")
        >>> print(result['valid'])
        False
    """
    try:
        # Validate URL format
        if not is_valid_url(url):
            return {
                'valid': False,
                'domain': None,
                'store_domain': store_domain,
                'message': 'Invalid URL format. Please provide a valid URL starting with http:// or https://'
            }
        
        # Extract domain from URL
        url_domain = get_domain_from_url(url)
        if not url_domain:
            return {
                'valid': False,
                'domain': None,
                'store_domain': store_domain,
                'message': 'Could not extract domain from the provided URL.'
            }
        
        # Get store domain if not provided
        if not store_domain:
            store_domain = get_store_domain()
        
        if not store_domain:
            # Fallback: look up the store by the URL's own domain (handles
            # requests from the storefront script which doesn't carry shop
            # headers/params).
            try:
                row = _db_execute(
                    "SELECT SHOP FROM SHOPIFY_STORES WHERE SHOP = %s LIMIT 1",
                    (url_domain,),
                    fetch="one",
                )
                if row:
                    store_domain = normalize_shopify_store_url(row["SHOP"])
            except Exception:
                pass

        if not store_domain:
            logger.error("[validate_shopify_url] No store domain configured")
            return {
                'valid': False,
                'domain': url_domain,
                'store_domain': None,
                'message': 'Store domain is not configured. Please configure your Shopify store.'
            }
        
        # Normalize domains for comparison
        store_domain_normalized = store_domain.lower().strip()
        url_domain_normalized = url_domain.lower().strip()
        
        # Exact domain match check
        if url_domain_normalized != store_domain_normalized:
            logger.warning(
                f"[validate_shopify_url] Domain mismatch: "
                f"requested='{url_domain_normalized}', store='{store_domain_normalized}'"
            )
            return {
                'valid': False,
                'domain': url_domain_normalized,
                'store_domain': store_domain_normalized,
                'message': (
                    f'Access denied: You can only fetch and translate pages from your Shopify store '
                    f'({store_domain_normalized}). The requested URL belongs to "{url_domain_normalized}".'
                )
            }
        
        # Domain match successful
        logger.info(f"[validate_shopify_url] URL validation passed for domain: {url_domain_normalized}")
        return {
            'valid': True,
            'domain': url_domain_normalized,
            'store_domain': store_domain_normalized,
            'message': None
        }
    
    except Exception as e:
        logger.error(f"[validate_shopify_url] Unexpected error validating URL '{url}': {e}")
        return {
            'valid': False,
            'domain': None,
            'store_domain': store_domain,
            'message': f'An error occurred while validating the URL: {str(e)}'
        }


def fetch_page_content(url):
    """
    Safely fetch page content from a URL after validation.
    
    Args:
        url (str): URL to fetch (must be from configured store)
    
    Returns:
        dict: {
            'success': bool,
            'content': str (HTML content if successful),
            'message': str (error message if failed),
            'status_code': int
        }
    """
    import requests
    import time
    from urllib.parse import urlencode, parse_qsl, urlparse
    
    try:
        # Validate URL
        validation = validate_shopify_url(url)
        if not validation['valid']:
            logger.warning(f"[fetch_page_content] URL validation failed: {validation['message']}")
            return {
                'success': False,
                'content': None,
                'message': validation['message'],
                'status_code': 403
            }
        
        # Normalize URL and add cache-busting parameter
        parsed = urlparse(url)
        query_params = parse_qsl(parsed.query)
        query_params.append(("_nocache", str(int(time.time() * 1000))))
        fetch_url = parsed._replace(query=urlencode(query_params)).geturl()
        
        # Fetch with appropriate headers
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; ShopifyTranslatorBot/1.0; +content-fetch)',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
        }
        
        logger.info(f"[fetch_page_content] Fetching URL: {url}")
        response = requests.get(fetch_url, headers=headers, timeout=15)
        
        if response.status_code != 200:
            logger.warning(f"[fetch_page_content] Failed to fetch URL: status_code={response.status_code}")
            return {
                'success': False,
                'content': None,
                'message': f'Failed to fetch the page (HTTP {response.status_code})',
                'status_code': response.status_code
            }
        
        logger.info(f"[fetch_page_content] Successfully fetched URL: {url}")
        return {
            'success': True,
            'content': response.text,
            'message': None,
            'status_code': 200
        }
    
    except requests.Timeout:
        logger.error(f"[fetch_page_content] Request timeout for URL: {url}")
        return {
            'success': False,
            'content': None,
            'message': 'Request timed out. The page took too long to load.',
            'status_code': 504
        }
    except requests.RequestException as e:
        logger.error(f"[fetch_page_content] Request error for URL '{url}': {e}")
        return {
            'success': False,
            'content': None,
            'message': f'Failed to fetch the page: {str(e)}',
            'status_code': 503
        }
    except Exception as e:
        logger.error(f"[fetch_page_content] Unexpected error fetching URL '{url}': {e}")
        return {
            'success': False,
            'content': None,
            'message': f'An error occurred while fetching the page: {str(e)}',
            'status_code': 500
        }
