export const API_URL = import.meta.env.VITE_API_URL || "/api";

function getShopFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get("shop");
    if (shop) return shop;
    // fallback: host param is present in embedded apps; sometimes shop is in parent URL
    const host = params.get("host");
    if (host) {
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
  if (options.body && !options.headers["Content-Type"]) {
    options.headers["Content-Type"] = "application/json";
  }
  if (shop) {
    options.headers["X-Shopify-Shop-Domain"] = shop;
  } else {
    console.warn("apiFetch: missing shop domain; requests may fallback to legacy store settings.");
  }

  const url = path.startsWith("http") ? path : `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    const body = await response.text();
    const message = `API request failed ${response.status} ${response.statusText}. URL=${url}. shop=${shop || "<none>"}. Body=${body.slice(0, 500)}`;
    throw new Error(message);
  }

  if (!contentType.includes("application/json")) {
    const body = await response.text();
    const message = `Expected JSON response but got ${contentType}. URL=${url}. shop=${shop || "<none>"}. Body=${body.slice(0, 500)}`;
    throw new Error(message);
  }

  return response;
}
