(function () {


  const BACKEND_URL = "https://shopify-multilanguage-convertor.onrender.com";
  const currentUrl = (window.location.origin + window.location.pathname).replace(/\/$/, "");


  const urlParams = new URLSearchParams(window.location.search);
  const targetLanguage = urlParams.get("lang") || localStorage.getItem("store_language") || null;

  async function fetchReplacements() {
    try {
      const fetchUrl = new URL(`${BACKEND_URL}/overlay/replacements`);
      fetchUrl.searchParams.append("url", currentUrl);
      if (targetLanguage) {
        fetchUrl.searchParams.append("target_language", targetLanguage);
      }
      const res = await fetch(fetchUrl);
      const data = await res.json();
      return data.replacements || {};
    } catch (err) {
      console.error("Failed to fetch text replacements:", err);
      return {};
    }
  }

  function applyReplacements(replacements) {
    if (Object.keys(replacements).length === 0) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const nodesToReplace = [];

    while ((node = walker.nextNode())) {
      const text = node.nodeValue.trim();
      if (text && replacements[text]) {
        nodesToReplace.push({ node, newText: replacements[text] });
      }
    }


    nodesToReplace.forEach(({ node, newText }) => {
      node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), newText);
    });


    const elementsWithAttributes = document.querySelectorAll("input[type='submit'], input[type='button'], input[placeholder]");
    elementsWithAttributes.forEach(el => {
      if (el.value && replacements[el.value.trim()]) {
        el.value = replacements[el.value.trim()];
      }
      if (el.placeholder && replacements[el.placeholder.trim()]) {
        el.placeholder = replacements[el.placeholder.trim()];
      }
    });
  }


  document.addEventListener("DOMContentLoaded", async () => {
    const replacements = await fetchReplacements();
    applyReplacements(replacements);
  });
})();
