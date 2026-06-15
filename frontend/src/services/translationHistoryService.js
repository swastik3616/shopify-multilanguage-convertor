const API_URL = "https://shopify-multilanguage-convertor.onrender.com";

export const getTranslations = async () => {
  const response = await fetch(
    `${API_URL}/translations`
  );

  return response.json();
};