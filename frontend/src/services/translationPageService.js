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
