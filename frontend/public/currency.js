(function () {
  var BACKEND_URL = "https://shopify-multilanguage-convertor.onrender.com";

  var urlParams = new URLSearchParams(window.location.search);
  var currentLang = urlParams.get("lang") || localStorage.getItem("store_language") || null;

  var currencyMap = {};
  var rates = {};
  var storeCurrency = "USD";
  var enabled = false;

  function getMetaContent(name) {
    var meta = document.querySelector('meta[property="product:price:currency"]') ||
               document.querySelector('meta[itemprop="priceCurrency"]') ||
               document.querySelector('[data-currency]');
    return meta ? (meta.getAttribute("content") || meta.getAttribute("data-currency") || "USD") : "USD";
  }

  function extractPrice(text) {
    var cleaned = text.replace(/[^0-9.,]/g, "").replace(/,/g, "");
    var num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  function formatPrice(amount, currency) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 2,
      }).format(amount);
    } catch (e) {
      return currency + " " + amount.toFixed(2);
    }
  }

  function getTargetCurrency() {
    if (!currentLang || !currencyMap[currentLang]) return null;
    return currencyMap[currentLang];
  }

  function convertPrices() {
    if (!enabled || !rates || Object.keys(rates).length === 0) return;

    var targetCurrency = getTargetCurrency();
    if (!targetCurrency || targetCurrency === storeCurrency) return;

    var rate = rates[targetCurrency];
    if (!rate) return;

    var priceSelectors = [
      ".price .price-item",
      ".product__price",
      ".product-price",
      "[data-product-price]",
      ".price--on-sale .price-item--regular",
      ".price--on-sale .price-item--sale",
      ".cart__price",
      ".cart-item__price",
      ".total-price",
      ".compare-price",
      ".money",
      ".price",
      "span.price",
      '[class*="price"]',
      ".product-single__price",
      ".product-single__price--wrapper",
      '[id*="ProductPrice"]',
      '[id*="productPrice"]',
      ".subtotal",
      ".cart__subtotal",
    ];

    var selector = priceSelectors.join(", ");
    var elements = document.querySelectorAll(selector);

    elements.forEach(function (el) {
      if (el.getAttribute("data-currency-converted")) return;

      var text = el.textContent.trim();
      var priceVal = extractPrice(text);
      if (priceVal === null || priceVal === 0) return;

      var converted = priceVal * rate;
      var formatted = formatPrice(converted, targetCurrency);

      el.textContent = formatted;
      el.setAttribute("data-currency-converted", "true");
      el.setAttribute("data-original-price", text);
      el.setAttribute("data-converted-currency", targetCurrency);
    });
  }

  function buildWidget() {
    if (!enabled) return;

    var targetCurrency = getTargetCurrency();
    if (!targetCurrency) return;

    var widget = document.createElement("div");
    widget.id = "currency-exchange-widget";
    widget.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:9999;" +
      "background:#008060;color:#fff;padding:10px 16px;border-radius:8px;" +
      "font-size:13px;font-family:sans-serif;box-shadow:0 2px 12px rgba(0,0,0,0.15);" +
      "display:flex;align-items:center;gap:8px;cursor:pointer;transition:opacity 0.2s;";

    var label = document.createElement("span");
    label.textContent = "Currency: " + storeCurrency + " \u2192 " + targetCurrency;
    widget.appendChild(label);

    var toggle = document.createElement("span");
    toggle.style.cssText =
      "display:inline-block;width:36px;height:20px;background:rgba(255,255,255,0.3);" +
      "border-radius:10px;position:relative;transition:background 0.2s;";

    var dot = document.createElement("span");
    dot.style.cssText =
      "display:block;width:16px;height:16px;background:#fff;border-radius:50%;" +
      "position:absolute;top:2px;left:2px;transition:left 0.2s;";
    if (localStorage.getItem("currency_conversion") === "on") {
      dot.style.left = "18px";
      toggle.style.background = "rgba(255,255,255,0.6)";
    }
    toggle.appendChild(dot);
    widget.appendChild(toggle);

    var isOn = localStorage.getItem("currency_conversion") !== "off";

    widget.addEventListener("click", function () {
      isOn = !isOn;
      localStorage.setItem("currency_conversion", isOn ? "on" : "off");
      if (isOn) {
        dot.style.left = "18px";
        toggle.style.background = "rgba(255,255,255,0.6)";
        convertPrices();
      } else {
        dot.style.left = "2px";
        toggle.style.background = "rgba(255,255,255,0.3)";
        restorePrices();
      }
    });

    if (isOn) {
      widget.setAttribute("data-active", "true");
    }

    document.body.appendChild(widget);

    if (isOn) {
      convertPrices();
    }
  }

  function restorePrices() {
    var elements = document.querySelectorAll("[data-currency-converted]");
    elements.forEach(function (el) {
      var original = el.getAttribute("data-original-price");
      if (original) {
        el.textContent = original;
      }
      el.removeAttribute("data-currency-converted");
      el.removeAttribute("data-original-price");
      el.removeAttribute("data-converted-currency");
    });
  }

  function init() {
    storeCurrency = getMetaContent("product:price:currency") || "USD";

    fetch(BACKEND_URL + "/currency/map")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.success || !data.enabled) return;
        enabled = true;
        currencyMap = data.currency_map || {};

        if (!currentLang) return;
        var targetCurrency = getTargetCurrency();
        if (!targetCurrency) return;

        return fetch(BACKEND_URL + "/currency/rates?base=" + storeCurrency);
      })
      .then(function (r) {
        if (!r) return;
        return r.json();
      })
      .then(function (data) {
        if (data && data.success) {
          rates = data.rates || {};
        }
      })
      .then(function () {
        if (enabled && currentLang) {
          buildWidget();
        }
      })
      .catch(function (err) {
        console.error("[Currency Widget] Init failed:", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
