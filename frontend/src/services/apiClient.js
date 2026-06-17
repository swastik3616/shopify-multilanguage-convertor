export const API_URL = "/api";

function getShopFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get("shop");
    if (shop) return shop;
    // fallback: host param is present in embedded apps; sometimes shop is in parent URL
    const host = params.get("host");
    if (host) {
      // host is not the shop domain; leave as-is — prefer explicit `shop` param
      return null;
    }
    return localStorage.getItem("shopify_shop") || null;
  } catch (e) {
    return localStorage.getItem("shopify_shop") || null;
  }
}

export function persistShopFromQuery() {
  const shop = getShopFromQuery();
  if (shop) {
    try { localStorage.setItem("shopify_shop", shop); } catch (e) {}
  }
  return shop;
}

export async function apiFetch(path, options = {}) {
  const shop = getShopFromQuery() || persistShopFromQuery();
  options.headers = options.headers || {};
  // only set JSON content header if not provided and body is present
  if (options.body && !options.headers["Content-Type"]) {
    options.headers["Content-Type"] = "application/json";
  }
  if (shop) {
    options.headers["X-Shopify-Shop-Domain"] = shop;
  }

  return fetch(path, options);
}
