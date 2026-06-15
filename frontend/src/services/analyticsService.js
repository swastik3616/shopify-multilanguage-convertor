const API_URL = "https://shopify-multilanguage-convertor.onrender.com";

export const getAnalytics = async () => {
  const response = await fetch(
    `${API_URL}/analytics`
  );

  return response.json();
};