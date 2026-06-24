import { apiFetch } from "./apiClient";

export const getSeoResources = async (resourceType = "products") => {
  const response = await apiFetch(`/api/seo-resources?type=${resourceType}`);
  return response.json();
};

export const translateSeoResource = async (payload) => {
  const response = await apiFetch(`/api/seo-translate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.json();
};

export const updateOriginalSeo = async (payload) => {
  const response = await apiFetch(`/api/seo-update-original`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.json();
};
