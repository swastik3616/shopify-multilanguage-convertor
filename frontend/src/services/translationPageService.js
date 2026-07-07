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
// page can pre-fill text with values the user already changed.
export const fetchOverlayEdits = async (url) => {
  const normalized = encodeURIComponent(url);
  const response = await apiFetch(`${API_URL}/overlay/replacements?url=${normalized}`);
  const data = await response.json();
  // Return only base edits (not translations) keyed by original_text
  const map = {};
  const list = data.replacements || [];
  list.forEach((edit) => {
    if (!edit.is_translation && edit.original_text && edit.new_text) {
      map[edit.original_text.trim()] = edit.new_text;
    }
  });
  return map;
};
