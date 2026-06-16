const API_URL = "http://localhost:5000";

export const fetchUrlContent = async (url) => {
  const response = await fetch(`${API_URL}/api/fetch-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  return response.json();
};
