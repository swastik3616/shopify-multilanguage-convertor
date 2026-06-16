const API_URL = "/api";

export const getAuditHistory = async () => {
  const response = await fetch(
    `${API_URL}/audit-history`
  );

  return response.json();
};