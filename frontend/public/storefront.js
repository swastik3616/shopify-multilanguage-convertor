(function () {


  const BACKEND_URL = "https://shopify-multilanguage-convertor.onrender.com";
  const currentUrl = (window.location.origin + window.location.pathname + window.location.search).replace(/\/$/, "");

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

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function matchesEditTarget(element, originalText, elementTag) {
    if (!originalText) return false;
    const normalizedOriginal = normalizeText(originalText);
    const upperTag = (elementTag || "").toUpperCase();

    if (["INPUT", "TEXTAREA"].includes(upperTag)) {
      const candidateText = normalizeText(element.value || element.placeholder || "");
      return candidateText === normalizedOriginal || candidateText.includes(normalizedOriginal);
    }

    if (upperTag === "BUTTON" || element.tagName === "BUTTON") {
      const candidateText = normalizeText(element.textContent || element.value || "");
      return candidateText === normalizedOriginal || candidateText.includes(normalizedOriginal);
    }

    const candidateText = normalizeText(element.textContent || "");
    return candidateText === normalizedOriginal || candidateText.includes(normalizedOriginal);
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
      let applied = false;
      let node;
      while ((node = walker.nextNode())) {
        const currentText = normalizeText(node.nodeValue || "");
        const targetText = normalizeText(original_text || "");
        if (currentText === targetText || currentText.includes(targetText)) {
          node.nodeValue = new_text;
          applied = true;
        }
      }

      if (!applied) {
        const matchingElements = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, p, span, li, button, a, label, td, th, strong, em, b, i"))
          .filter(el => matchesEditTarget(el, original_text, element_tag));
        matchingElements.forEach(el => applyTextToElement(el, new_text, element_tag));
      }
    });
  }

  async function syncReplacements() {
    const replacements = await fetchReplacements();
    if (replacements.length > 0) {
      console.log("Applying overlay replacements", replacements.length, currentUrl);
    }
    applyReplacements(replacements);
  }

  function startOverlaySync() {
    syncReplacements();
    window.setInterval(syncReplacements, 5000);
    window.addEventListener("focus", syncReplacements);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        syncReplacements();
      }
    });
    const observer = new MutationObserver(() => {
      syncReplacements();
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startOverlaySync);
  } else {
    startOverlaySync();
  }
})();
