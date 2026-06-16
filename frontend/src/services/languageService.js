const API_URL = "/api";

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