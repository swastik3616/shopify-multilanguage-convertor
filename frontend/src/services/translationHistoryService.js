const API_URL = "/api";

export const getTranslations = async () => {
  const response = await fetch(
    `${API_URL}/translations`
  );

  return response.json();
};