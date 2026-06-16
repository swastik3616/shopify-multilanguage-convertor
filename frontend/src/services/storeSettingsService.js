const API_URL = "http://localhost:5000";

export const saveStoreSettings = async (data) => {
  const response = await fetch(
    `${API_URL}/save-store-settings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  return response.json();
};

export const checkShopifyToken = async () => {
  const response = await fetch(`${API_URL}/shopify/check-token`);
  return response.json();
};