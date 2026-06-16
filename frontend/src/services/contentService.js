const API_URL = "http://localhost:5000";

export const getContents = async (page = null) => {
  const url = page ? `${API_URL}/contents?page=${encodeURIComponent(page)}` : `${API_URL}/contents`;
  const response = await fetch(url);
  return response.json();
};

export const getContentsStoreStatus = async () => {
  const response = await fetch(`${API_URL}/contents/store-status`);
  return response.json();
};

export const syncContentsFromShopify = async (page) => {
  const response = await fetch(`${API_URL}/contents/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page }),
  });

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

export const importContentToLibrary = async (payload) => {
  const response = await fetch(`${API_URL}/contents/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return response.json();
};

export const fetchUrlContent = async (url) => {
  const response = await fetch(`${API_URL}/api/fetch-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
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

export const updateTranslation = async (translationId, translatedText) => {
  const response = await fetch(`${API_URL}/translations/${translationId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ translated_text: translatedText }),
  });

  return response.json();
};

export const deleteTranslation = async (translationId) => {
  const response = await fetch(`${API_URL}/translations/${translationId}`, {
    method: "DELETE",
  });

  return response.json();
};
