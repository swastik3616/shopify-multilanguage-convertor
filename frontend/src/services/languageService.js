const API_URL = "http://localhost:5000";

export const saveLanguages = async (payload) => {
  const response = await fetch(
    `${API_URL}/save-languages`,
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