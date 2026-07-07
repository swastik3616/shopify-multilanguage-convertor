import { API_URL, apiFetch } from "./apiClient";

export const fetchUrlContent = async (url) => {
  const response = await apiFetch(`${API_URL}/fetch-url`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });

  return response.json();
};

export const saveOverlayEdits = async (url, edits) => {
  const response = await apiFetch(`${API_URL}/overlay/save`, {
    method: "POST",
    body: JSON.stringify({ url, edits }),
  });
  return response.json();
};

// Fetch previously saved overlay edits for a URL so the translation
// page can pre-fill already-edited text instead of always showing the
// raw Shopify values.
//
// Uses plain fetch() (not apiFetch) because /overlay/replacements is a
// public endpoint — storefront.js also calls it without auth headers.
// apiFetch throws on any non-OK or non-JSON response and would silently
// return {} via the .catch(), breaking the merge entirely.
export const fetchOverlayEdits = async (url, targetLang) => {
  try {
    let endpoint = `${API_URL}/overlay/replacements?url=${encodeURIComponent(url)}`;
    if (targetLang) {
      endpoint += `&target_language=${encodeURIComponent(targetLang)}`;
    }
    const response = await fetch(endpoint, { method: "GET" });
    if (!response.ok) return { base: {}, translations: {} };
    const data = await response.json();
    
    // Return a map keyed by original_text for quick lookup
    const base = {};
    const translations = {};
    
    const list = data.replacements || [];
    list.forEach((edit) => {
      if (edit.original_text && edit.new_text) {
        if (edit.is_translation) {
          translations[edit.original_text.trim()] = edit.new_text;
        } else {
          base[edit.original_text.trim()] = edit.new_text;
        }
      }
    });
    return { base, translations };
  } catch {
    return { base: {}, translations: {} };
  }
};
