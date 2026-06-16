const API_URL = "https://shopify-multilanguage-convertor.onrender.com";

export const getContents = async () => {
  const response = await fetch(`${API_URL}/contents`);
  return response.json();
};

export const createContent = async (payload) => {
  const response = await fetch(`${API_URL}/contents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return response.json();
};

export const updateContent = async (contentId, payload) => {
  const response = await fetch(`${API_URL}/contents/${contentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return response.json();
};

export const deleteContent = async (contentId) => {
  const response = await fetch(`${API_URL}/contents/${contentId}`, {
    method: "DELETE",
  });

  return response.json();
};

export const translateContent = async (contentId, targetLanguage) => {
  const response = await fetch(`${API_URL}/contents/${contentId}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_language: targetLanguage }),
  });

  return response.json();
};
