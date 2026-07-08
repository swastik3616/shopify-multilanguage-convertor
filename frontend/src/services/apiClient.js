export const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://shopify-multilanguage-convertor.onrender.com";

function getShopFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);

    const shop = params.get("shop");
    if (shop) return shop;

    return localStorage.getItem("shopify_shop") || null;
  } catch (e) {
    return localStorage.getItem("shopify_shop") || null;
  }
}

export function persistShopFromQuery() {
  const shop = getShopFromQuery();

  if (shop) {
    try {
      localStorage.setItem("shopify_shop", shop);
    } catch (e) { }
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
    console.warn(
      "apiFetch: missing shop domain; requests may fallback to legacy store settings."
    );
  }

  let url;
  const isAbsolute = /^(https?:)?\/\//i.test(path);
  if (isAbsolute) {
    url = path;
  } else {
    const base = (API_URL || '').toString();
    const cleanBase = base.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    url = `${cleanBase}${cleanPath}`;
  }

  console.log("API Request:", url);

  const response = await fetch(url, options);

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    const bodyText = await response.text();
    let errorMessage = `API request failed ${response.status} ${response.statusText}`;

    try {
      const jsonBody = JSON.parse(bodyText);
      if (jsonBody.message) {
        errorMessage = jsonBody.message;
      }
    } catch (e) {
      // Not JSON, fallback to detailed text
      errorMessage = `API request failed ${response.status} ${response.statusText}\nURL=${url}\nBODY=${bodyText}`;
    }

    throw new Error(errorMessage);
  }

  if (!contentType.includes("application/json")) {
    const body = await response.text();

    throw new Error(
      `Expected JSON but got ${contentType}
       URL=${url}
       SHOP=${shop || "<none>"}
       BODY=${body}`
    );
  }

  return response;
}