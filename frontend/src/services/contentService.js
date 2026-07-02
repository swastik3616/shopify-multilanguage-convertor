import { API_URL, apiFetch } from "./apiClient";

export const getContents = async (page = null) => {
  const url = page ? `${API_URL}/contents?page=${encodeURIComponent(page)}` : `${API_URL}/contents`;
  const response = await apiFetch(url);
  return response.json();
};

export const getContentsStoreStatus = async () => {
  const response = await apiFetch(`${API_URL}/contents/store-status`);
  return response.json();
};

export const syncContentsFromShopify = async (page) => {
  const response = await apiFetch(`${API_URL}/contents/sync`, {
    method: "POST",
    body: JSON.stringify({ page }),
  });

  return response.json();
};

export const createContent = async (payload) => {
  const response = await apiFetch(`${API_URL}/contents`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.json();
};

export const importContentToLibrary = async (payload) => {
  const response = await apiFetch(`${API_URL}/contents/import`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.json();
};

export const fetchUrlContent = async (url) => {
  const response = await apiFetch(`${API_URL}/fetch-url`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });

  return response.json();
};

export const updateContent = async (contentId, payload) => {
  const response = await apiFetch(`${API_URL}/contents/${contentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return response.json();
};

export const deleteContent = async (contentId) => {
  const response = await apiFetch(`${API_URL}/contents/${contentId}`, {
    method: "DELETE",
  });

  return response.json();
};

export const translateContent = async (contentId, targetLanguage) => {
  const response = await apiFetch(`${API_URL}/contents/${contentId}/translate`, {
    method: "POST",
    body: JSON.stringify({ target_language: targetLanguage }),
  });

  return response.json();
};

export const updateTranslation = async (translationId, translatedText) => {
  const response = await apiFetch(`${API_URL}/translations/${translationId}`, {
    method: "PUT",
    body: JSON.stringify({ translated_text: translatedText }),
  });

  return response.json();
};

export const createManualTranslation = async (sourceText, targetLanguage, translatedText) => {
  const response = await apiFetch(`${API_URL}/translations/manual`, {
    method: "POST",
    body: JSON.stringify({
      source_text: sourceText,
      target_language: targetLanguage,
      translated_text: translatedText
    }),
  });

  return response.json();
};

export const deleteTranslation = async (translationId) => {
  const response = await apiFetch(`${API_URL}/translations/${translationId}`, {
    method: "DELETE",
  });

  return response.json();
};
