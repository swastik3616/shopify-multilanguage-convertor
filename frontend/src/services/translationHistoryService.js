import { API_URL, apiFetch } from "./apiClient";

export const getTranslations = async () => {
  const response = await apiFetch(`${API_URL}/translations`);
  return response.json();
};