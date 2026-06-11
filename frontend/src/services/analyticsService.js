const API_URL = "http://localhost:5000";

export const getAnalytics = async () => {
  const response = await fetch(
    `${API_URL}/analytics`
  );

  return response.json();
};