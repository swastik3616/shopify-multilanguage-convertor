import { API_URL, apiFetch } from "./apiClient";

export const saveLanguages = async (payload) => {
  const response = await apiFetch(`${API_URL}/save-languages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.json();
};