const API_URL = "/api";

export const getProviderSettings = async () => {
  const response = await fetch(`${API_URL}/get-provider`);
  return response.json();
};

export const saveProvider = async (payload) => {
  const response = await fetch(`${API_URL}/save-provider`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return response.json();
};