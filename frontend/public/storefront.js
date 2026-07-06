(function () {


  const BACKEND_URL = "https://shopify-multilanguage-convertor.onrender.com";
  const currentUrl = (window.location.origin + window.location.pathname).replace(/\/$/, "");


  const urlParams = new URLSearchParams(window.location.search);
  const targetLanguage = urlParams.get("lang") || localStorage.getItem("store_language") || null;

  function normalizeReplacements(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.replacements)) return payload.replacements;
    if (payload && payload.replacements && typeof payload.replacements === "object") {
      return Object.entries(payload.replacements).map(([originalText, newText]) => ({
        original_text: originalText,
        new_text: newText,
      }));
    }
    return [];
  }

  async function fetchReplacements() {
    try {
      const fetchUrl = new URL(`${BACKEND_URL}/overlay/replacements`);
      fetchUrl.searchParams.append("url", currentUrl);
      if (targetLanguage) {
        fetchUrl.searchParams.append("target_language", targetLanguage);
      }
      const res = await fetch(fetchUrl);
      const data = await res.json();
      return normalizeReplacements(data);
    } catch (err) {
      console.error("Failed to fetch text replacements:", err);
      return [];
    }
  }

  function matchesEditTarget(element, originalText, elementTag) {
    if (!originalText) return false;
    const normalizedOriginal = originalText.trim();
    const upperTag = (elementTag || "").toUpperCase();

    if (["INPUT", "TEXTAREA"].includes(upperTag)) {
      return (element.value || "").trim() === normalizedOriginal || (element.placeholder || "").trim() === normalizedOriginal;
    }

    if (upperTag === "BUTTON" || element.tagName === "BUTTON") {
      return (element.textContent || "").trim() === normalizedOriginal || (element.value || "").trim() === normalizedOriginal;
    }

    return (element.textContent || "").trim() === normalizedOriginal;
  }

  function applyTextToElement(element, newText, elementTag) {
    const upperTag = (elementTag || "").toUpperCase();

    if (["INPUT", "TEXTAREA"].includes(upperTag)) {
      element.value = newText;
      return;
    }

    if (upperTag === "BUTTON" || element.tagName === "BUTTON") {
      element.textContent = newText;
      return;
    }

    if (element.tagName === "INPUT") {
      element.value = newText;
      return;
    }

    if (element.placeholder !== undefined) {
      element.placeholder = newText;
      return;
    }

    element.textContent = newText;
  }

  function applyReplacements(replacements) {
    if (!Array.isArray(replacements) || replacements.length === 0) return;

    replacements.forEach(({ original_text, new_text, selector, element_tag }) => {
      if (!new_text) return;

      if (selector) {
        const matchingElements = Array.from(document.querySelectorAll(selector)).filter(el => matchesEditTarget(el, original_text, element_tag));
        if (matchingElements.length > 0) {
          matchingElements.forEach(el => applyTextToElement(el, new_text, element_tag));
          return;
        }
      }

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while ((node = walker.nextNode())) {
        if ((node.nodeValue || "").trim() === (original_text || "").trim()) {
          node.nodeValue = new_text;
        }
      }
    });
  }


  document.addEventListener("DOMContentLoaded", async () => {
    const replacements = await fetchReplacements();
    applyReplacements(replacements);
  });
})();
