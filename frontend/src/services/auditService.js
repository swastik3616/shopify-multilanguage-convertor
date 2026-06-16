const API_URL = "http://localhost:5000";

export const getAuditHistory = async () => {
  const response = await fetch(
    `${API_URL}/audit-history`
  );

  return response.json();
};