const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const getSeoResources = async (resourceType = "products") => {
  const shop = window.shopifyStoreUrl || new URLSearchParams(window.location.search).get("shop") || localStorage.getItem("shop");
  
  const headers = { "Content-Type": "application/json" };
  if (shop) {
    headers["X-Shopify-Shop-Domain"] = shop;
  }

  const response = await fetch(`${API_BASE_URL}/api/seo-resources?type=${resourceType}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to fetch SEO resources");
  }

  return response.json();
};

export const translateSeoResource = async (payload) => {
  const shop = window.shopifyStoreUrl || new URLSearchParams(window.location.search).get("shop") || localStorage.getItem("shop");
  
  const headers = { "Content-Type": "application/json" };
  if (shop) {
    headers["X-Shopify-Shop-Domain"] = shop;
  }

  const response = await fetch(`${API_BASE_URL}/api/seo-translate`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to translate SEO resource");
  }

  return response.json();
};
