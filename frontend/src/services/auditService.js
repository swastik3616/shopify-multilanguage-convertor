import { API_URL, apiFetch } from "./apiClient";

export const getAuditHistory = async () => {
  const response = await apiFetch(`${API_URL}/audit-history`);
  return response.json();
};