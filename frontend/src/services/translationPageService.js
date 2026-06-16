const API_URL = "/api";

export const fetchUrlContent = async (url) => {
  const response = await fetch(`${API_URL}/fetch-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  return response.json();
};
