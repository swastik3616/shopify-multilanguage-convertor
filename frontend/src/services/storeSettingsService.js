import { API_URL, apiFetch } from "./apiClient";

export const saveStoreSettings = async (data) => {
  const response = await apiFetch(`${API_URL}/save-store-settings`, {
    method: "POST",
    body: JSON.stringify(data),
  });

  return response.json();
};

export const checkShopifyToken = async () => {
  const response = await apiFetch(`${API_URL}/shopify/check-token`);
  return response.json();
};