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
    // cache: "no-store" avoids a stale cached GET (browser/proxy/CDN)
    // masking a save that just happened.
    const response = await fetch(endpoint, { method: "GET", cache: "no-store" });
    if (!response.ok) return { base: {}, translations: {} };
    const data = await response.json();

    // Build a map keyed by original_text for quick lookup.
    //
    // FIX: the backend can (still, in rare cases — e.g. leftover
    // duplicates from before a matching-key bug was fixed server-side)
    // return more than one row for the same original_text. The backend
    // now returns rows ordered oldest -> newest (id ASC), so we fold
    // them into a plain object here: each later entry for the same key
    // simply overwrites the earlier one, meaning the *last* (most
    // recent) row always wins instead of whichever happened to appear
    // first in the array.
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