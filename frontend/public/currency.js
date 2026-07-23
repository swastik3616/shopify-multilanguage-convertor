(function () {
  var BACKEND = 'https://shopify-multilanguage-convertor.onrender.com';

  var storeCurrency = 'USD';
  var enabled = false;
  var rates = {};
  var currencyList = [];
  var selectedCurrency = null;

  var widget, btn, dropdown, optionsContainer;
  var isOpen = false;

  var CURRENCY_SYMBOLS = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'JPY': '¥',
    'CNY': '¥', 'KRW': '₩', 'AED': 'د.إ', 'CAD': 'C$', 'AUD': 'A$',
    'SGD': 'S$', 'CZK': 'Kč', 'PLN': 'zł', 'DKK': 'kr', 'SEK': 'kr',
    'NOK': 'kr', 'HUF': 'Ft', 'TRY': '₺', 'ILS': '₪', 'THB': '฿',
    'VND': '₫', 'IDR': 'Rp', 'MYR': 'RM', 'PHP': '₱', 'RUB': '₽',
    'MXN': 'MX$', 'BRL': 'R$', 'ZAR': 'R', 'NGN': '₦', 'EGP': 'E£'
  };

  function getSymbol(code) {
    return CURRENCY_SYMBOLS[code] || code;
  }

  function store(key, val) {
    try { localStorage.setItem('currency_' + key, val); } catch(e) {}
  }
  function load(key) {
    try { return localStorage.getItem('currency_' + key); } catch(e) { return null; }
  }
  function remove(key) {
    try { localStorage.removeItem('currency_' + key); } catch(e) {}
  }

  function detectStoreCurrency() {
    try {
      if (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) {
        storeCurrency = window.Shopify.currency.active;
      } else {
        var m = document.querySelector('meta[property="product:price:currency"], meta[itemprop="priceCurrency"]');
        if (m) storeCurrency = m.getAttribute('content') || storeCurrency;
      }
    } catch(e) {}
  }

  function extractPrice(text) {
    var cleaned = text.replace(/[^0-9.,]/g, '').replace(/,/g, '');
    var num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  var PRICE_SELECTORS = [
    '.money', '.price', '.price-item', '.product__price',
    '.product-price', '[data-product-price]', '[data-regular-price]',
    '[data-sale-price]', '.amount', '.price__regular',
    '.price__sale', '.price__compare', '.price--on-sale',
    '.cart-item__price', '.cart__price', '.order-summary__price',
    'span[class*="price"]', 'span[class*="money"]', 'span[class*="amount"]'
  ].join(', ');

  function convertPrices(rate, targetCurrency) {
    if (window.__currencyConverting) return;
    window.__currencyConverting = true;
    try {
      var newSym = getSymbol(targetCurrency);
      var els = Array.from(document.querySelectorAll(PRICE_SELECTORS));
      var deduped = els.filter(function(el) {
        return !els.some(function(other) { return other !== el && other.contains(el); });
      });
      deduped.forEach(function(el) {
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        var node;
        while ((node = walker.nextNode())) {
          if (node._currOriginal === undefined) {
            node._currOriginal = node.nodeValue;
          }
          var orig = node._currOriginal;
          var match = orig.match(/([\d,]+(?:\.\d+)?)/);
          if (match && match[1]) {
            var num = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(num) && num > 0) {
              var converted = (num * rate).toFixed(2);
              var newText = orig.replace(match[1], converted);
              newText = newText.replace(/[\$€£¥₹₩₺₪฿₫Rp₱₽KčzłFt]|(?:Rs\.?\s*|rs\s*|USD|EUR|GBP|INR|AED|CAD|AUD|SGD|CZK|PLN|DKK|SEK|NOK|HUF|TRY|ILS|THB|VND|IDR|MYR|PHP|RUB)/ig, '').trim();
              node.nodeValue = newSym + newText;
            }
          }
        }
      });
    } finally {
      window.__currencyConverting = false;
    }
  }

  function restorePrices() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (node._currOriginal !== undefined) {
        node.nodeValue = node._currOriginal;
      }
    }
  }

  function buildWidget() {
    if (!enabled || currencyList.length === 0) return;

    widget = document.createElement('div');
    widget.id = 'currency-standalone-widget';
    widget.setAttribute('translate', 'no');
    widget.style.cssText =
      'position:fixed;top:100px;right:24px;z-index:99999;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

    btn = document.createElement('button');
    btn.style.cssText =
      'display:flex;align-items:center;gap:6px;padding:10px 16px;' +
      'background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;' +
      'border:none;border-radius:50px;cursor:pointer;font-size:13px;font-weight:600;' +
      'box-shadow:0 4px 24px rgba(0,0,0,0.25);transition:all 0.2s ease;';
    btn.innerHTML = '<span style="font-size:16px;">' + getSymbol(selectedCurrency || storeCurrency) + '</span>' +
      '<span id="currency-widget-label">' + (selectedCurrency || storeCurrency) + '</span>' +
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>';

    btn.addEventListener('mouseenter', function() {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
    });
    btn.addEventListener('mouseleave', function() {
      btn.style.transform = '';
      btn.style.boxShadow = '0 4px 24px rgba(0,0,0,0.25)';
    });

    dropdown = document.createElement('div');
    dropdown.style.cssText =
      'display:none;position:absolute;top:calc(100% + 8px);right:0;' +
      'background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.15);' +
      'overflow:hidden;min-width:160px;border:1px solid rgba(0,0,0,0.06);';

    var header = document.createElement('div');
    header.style.cssText =
      'padding:12px 16px;background:#f8f9fa;border-bottom:1px solid #eee;' +
      'font-size:11px;font-weight:700;color:#888;letter-spacing:0.08em;text-transform:uppercase;';
    header.textContent = 'Select Currency';
    dropdown.appendChild(header);

    optionsContainer = document.createElement('div');
    dropdown.appendChild(optionsContainer);

    currencyList.forEach(function(code) {
      var opt = document.createElement('div');
      var isActive = code === selectedCurrency;
      var sym = getSymbol(code);
      opt.style.cssText =
        'display:flex;align-items:center;gap:10px;padding:11px 16px;' +
        'cursor:pointer;font-size:14px;color:#222;transition:background 0.15s;' +
        'border-bottom:1px solid #f0f0f0;' +
        (isActive ? 'background:#eef4ff;color:#0057b8;font-weight:600;' : '');
      opt.innerHTML =
        '<span style="font-size:18px;width:24px;">' + sym + '</span>' +
        '<span style="flex:1;">' + code + '</span>' +
        '<span style="color:#0057b8;font-size:14px;' + (isActive ? '' : 'display:none;') + '">✓</span>';
      opt.addEventListener('mouseenter', function() {
        if (!isActive) opt.style.background = '#f3f4f6';
      });
      opt.addEventListener('mouseleave', function() {
        if (!isActive) opt.style.background = '';
      });
      opt.addEventListener('click', function() {
        selectCurrency(code);
      });
      optionsContainer.appendChild(opt);
    });

    widget.appendChild(btn);
    widget.appendChild(dropdown);
    document.body.appendChild(widget);

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      isOpen = !isOpen;
      dropdown.style.display = isOpen ? 'block' : '';
      var chevron = btn.querySelector('svg');
      if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : '';
    });

    document.addEventListener('click', function(e) {
      if (widget && !widget.contains(e.target)) {
        isOpen = false;
        dropdown.style.display = 'none';
        var chevron = btn && btn.querySelector('svg');
        if (chevron) chevron.style.transform = '';
      }
    });
  }

  function updateWidgetLabel() {
    var label = document.getElementById('currency-widget-label');
    if (!label) return;
    var sym = getSymbol(selectedCurrency || storeCurrency);
    label.textContent = selectedCurrency || storeCurrency;
    btn.innerHTML = '<span style="font-size:16px;">' + sym + '</span>' +
      '<span id="currency-widget-label">' + (selectedCurrency || storeCurrency) + '</span>' +
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>';
  }

  function selectCurrency(code) {
    if (code === selectedCurrency) {
      isOpen = false;
      dropdown.style.display = 'none';
      return;
    }

    var rate = rates[code];
    if (!rate) return;

    // Restore original prices first
    restorePrices();

    selectedCurrency = code;
    store('selected', code);
    updateWidgetLabel();
    convertPrices(rate, code);

    isOpen = false;
    dropdown.style.display = 'none';

    // Rebuild dropdown to update active state
    if (optionsContainer) {
      var opts = optionsContainer.querySelectorAll('div');
      opts.forEach(function(opt) {
        var code2 = opt.textContent.trim();
        var isActive = code2 === code;
        opt.style.background = isActive ? '#eef4ff' : '';
        opt.style.color = isActive ? '#0057b8' : '#222';
        opt.style.fontWeight = isActive ? '600' : '400';
        var check = opt.querySelector('span:last-child');
        if (check) check.style.display = isActive ? '' : 'none';
      });
    }
  }

  function init() {
    detectStoreCurrency();

    var saved = load('selected');
    if (saved && saved !== storeCurrency) {
      selectedCurrency = saved;
    }

    fetch(BACKEND + '/currency/map')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.success || !data.enabled) return;
        enabled = true;

        // Build list of unique currencies from the map
        var seen = {};
        currencyList = [];
        Object.keys(data.currency_map || {}).forEach(function(lang) {
          var code = data.currency_map[lang];
          if (code && code !== storeCurrency && !seen[code]) {
            seen[code] = true;
            currencyList.push(code);
          }
        });

        // Also add store currency as an option (to revert)
        currencyList.unshift(storeCurrency);

        if (currencyList.length === 0) return;

        return fetch(BACKEND + '/currency/rates?base=' + storeCurrency);
      })
      .then(function(r) {
        if (!r) return;
        return r.json();
      })
      .then(function(data) {
        if (data && data.success) {
          rates = data.rates || {};
        }
      })
      .then(function() {
        if (!enabled || currencyList.length === 0) return;

        buildWidget();

        // If user had a saved currency, convert on load
        if (selectedCurrency && selectedCurrency !== storeCurrency && rates[selectedCurrency]) {
          convertPrices(rates[selectedCurrency], selectedCurrency);
        }
      })
      .catch(function(err) {
        console.error('[Currency Widget] Init failed:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
