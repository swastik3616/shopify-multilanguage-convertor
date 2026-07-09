import { API_URL, apiFetch } from "./apiClient";

export const getAuditHistory = async (days = null) => {
  const url = days ? `${API_URL}/audit-history?days=${days}` : `${API_URL}/audit-history`;
  const response = await apiFetch(url);
  return response.json();
};