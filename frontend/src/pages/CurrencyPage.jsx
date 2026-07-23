import { DollarSign, Save, RefreshCw, Check, AlertCircle, ExternalLink, X } from "lucide-react";
import { useState, useEffect } from "react";
import { apiFetch } from "../services/apiClient";

const MAX_CURRENCIES = 5;

function CurrencyPage() {
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [activeCurrencies, setActiveCurrencies] = useState(["USD"]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");
  const [availableCurrencies, setAvailableCurrencies] = useState([]);
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(true);

  useEffect(() => {
    // Dynamically fetch supported currencies so nothing is hardcoded
    fetch("https://open.er-api.com/v6/latest/USD")
      .then(res => res.json())
      .then(data => {
        if (data && data.rates) {
          const codes = Object.keys(data.rates);
          const mapped = codes.map(code => {
             let name = code;
             let symbol = code;
             try {
                if (window.Intl && Intl.DisplayNames) {
                    const dn = new Intl.DisplayNames(['en'], { type: 'currency' });
                    name = dn.of(code);
                }
                const parts = new Intl.NumberFormat('en', { style: 'currency', currency: code }).formatToParts(0);
                const symPart = parts.find(p => p.type === 'currency');
                if (symPart) symbol = symPart.value;
             } catch(e){}
             return { code, name, symbol };
          });
          setAvailableCurrencies(mapped);
        }
      })
      .catch(err => console.error("Failed to fetch currencies", err))
      .finally(() => setIsLoadingCurrencies(false));

    apiFetch("/get-feature-flags")
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.currency_enabled || false);
        setApiKey(data.currency_api_key || "");
        setActiveCurrencies(data.active_currencies || ["USD"]);
      })
      .catch((err) => console.error("Failed to load currency settings", err));

    apiFetch("/get-store-settings")
      .then((r) => r.json())
      .then((data) => setStoreUrl(data.store_url || ""))
      .catch(() => {});
  }, []);

  const atLimit = activeCurrencies.length >= MAX_CURRENCIES;

  const handleToggle = async (val) => {
    setEnabled(val);
    setSaving(true);
    try {
      await apiFetch("/save-feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency_enabled: val }),
      });
    } catch (err) {
      console.error("Failed to toggle currency", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await apiFetch("/save-feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency_enabled: enabled,
          currency_api_key: apiKey,
          active_currencies: activeCurrencies,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save currency settings", err);
    } finally {
      setSaving(false);
    }
  };

  const toggleCurrency = (code) => {
    if (activeCurrencies.includes(code)) {
      setActiveCurrencies(prev => prev.filter(c => c !== code));
    } else {
      if (atLimit) return;
      setActiveCurrencies(prev => [...prev, code]);
    }
  };

  const storefrontLink = storeUrl
    ? `https://${storeUrl}`
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Currency Exchange</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enable automatic currency conversion on your storefront.
        </p>
      </div>

      <div className="card-container p-6 w-full max-w-3xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${enabled ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Currency Converter</h2>
              <p className="text-xs text-slate-500">Convert prices to selected currencies.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              disabled={saving}
              onChange={(e) => handleToggle(e.target.checked)}
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008060]"></div>
          </label>
        </div>

        {enabled && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Exchange Rate API Key
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Get a free API key from{" "}
                <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="text-[#008060] hover:underline inline-flex items-center gap-1">
                  ExchangeRate-API.com <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              <input
                type="password"
                placeholder="Enter your API key"
                className="input-field w-full"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-700">
                  Supported Currencies
                </label>
                <span className={`text-xs font-semibold ${atLimit ? "text-amber-600" : "text-slate-500"}`}>
                  {activeCurrencies.length}/{MAX_CURRENCIES} selected
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Select up to {MAX_CURRENCIES} currencies to display in the storefront widget.
              </p>

              {atLimit && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-800">Maximum {MAX_CURRENCIES} currencies reached. Uncheck one before adding another.</p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-1">
                {isLoadingCurrencies ? (
                  <div className="col-span-full py-8 text-center text-slate-500 text-sm">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading world currencies...
                  </div>
                ) : (
                  availableCurrencies.map((currency) => {
                    const isChecked = activeCurrencies.includes(currency.code);
                    const isDisabled = !isChecked && atLimit;
                    
                    return (
                    <label 
                      key={currency.code} 
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-300'}`}
                    >
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-[#008060] rounded border-slate-300 focus:ring-[#008060]"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={() => toggleCurrency(currency.code)}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700">{currency.code}</span>
                        <span className="text-xs text-slate-500">{currency.name} ({currency.symbol})</span>
                      </div>
                    </label>
                  );
                  })
                )}
              </div>
            </div>

            <button
              onClick={handleSaveAll}
              disabled={saving || isLoadingCurrencies}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 mt-4"
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
            </button>

            {storefrontLink && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Storefront Setup</p>
                  <p className="text-xs text-blue-700 mt-1">
                    No additional setup needed. The language switcher on your storefront will show a currency toggle and convert prices automatically.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CurrencyPage;
