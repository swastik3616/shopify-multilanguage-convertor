const API_URL = "https://shopify-multilanguage-convertor.onrender.com";

export const getAuditHistory = async () => {
  const response = await fetch(
    `${API_URL}/audit-history`
  );

  return response.json();
};