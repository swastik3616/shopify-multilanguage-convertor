import { API_URL, apiFetch } from "./apiClient";

export const getAnalytics = async () => {
  const response = await apiFetch(`${API_URL}/analytics`);
  return response.json();
};