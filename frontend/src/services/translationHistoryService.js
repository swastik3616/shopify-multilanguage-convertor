const API_URL = "http://localhost:5000";

export const getTranslations = async () => {
  const response = await fetch(
    `${API_URL}/translations`
  );

  return response.json();
};