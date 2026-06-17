import { API_URL, apiFetch } from "./apiClient";

export const getProviderSettings = async () => {
  const response = await apiFetch(`${API_URL}/get-provider`);
  return response.json();
};

export const saveProvider = async (payload) => {
  const response = await apiFetch(`${API_URL}/save-provider`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.json();
};