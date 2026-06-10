const API_URL = "http://localhost:5000";

export const saveProvider = async (payload) => {
  const response = await fetch(
    `${API_URL}/save-provider`,
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