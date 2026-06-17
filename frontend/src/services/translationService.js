import { API_URL, apiFetch } from "./apiClient";

export const translateText = async (payload) => {
  const response = await apiFetch(`${API_URL}/translate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.json();
};