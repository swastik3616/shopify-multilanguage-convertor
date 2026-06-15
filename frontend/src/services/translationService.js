const API_URL = "https://shopify-multilanguage-convertor.onrender.com";

export const translateText = async (payload) => {
  const response = await fetch(
    `${API_URL}/translate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return response.json();
};