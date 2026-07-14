import { API_URL, apiFetch } from "./apiClient";

export const fetchUrlContent = async (url) => {
  const response = await apiFetch(`${API_URL}/fetch-url`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });

  return response.json();
};

export const fetchShopifyPages = async () => {
  const response = await apiFetch(`${API_URL}/contents/shopify-pages`);
  return response.json();
};

export const saveOverlayEdits = async (url, edits) => {
  const response = await apiFetch(`${API_URL}/overlay/save`, {
    method: "POST",
    body: JSON.stringify({ url, edits }),
  });
  return response.json();
};
export const fetchOverlayEdits = async (url, targetLang) => {
  try {
    let endpoint = `${API_URL}/overlay/replacements?url=${encodeURIComponent(url)}`;
    if (targetLang) {
      endpoint += `&target_language=${encodeURIComponent(targetLang)}`;
    }
    const response = await fetch(endpoint, { method: "GET", cache: "no-store" });
    if (!response.ok) return { base: {}, translations: {} };
    const data = await response.json();
    const base = {};
    const translations = {};

    const list = data.replacements || [];
    list.forEach((edit) => {
      if (edit.original_text && edit.new_text) {
        const key = edit.original_text.trim();
        if (edit.is_translation) {
          translations[key] = edit.new_text; // later entries overwrite earlier ones
        } else {
          base[key] = edit.new_text; // later entries overwrite earlier ones
        }
      }
    });
    return { base, translations };
  } catch {
    return { base: {}, translations: {} };
  }
};