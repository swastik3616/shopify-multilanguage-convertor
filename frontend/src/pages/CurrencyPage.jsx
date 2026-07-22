import { DollarSign, Save, RefreshCw, Check, AlertCircle, ExternalLink, X } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../services/apiClient";

const MAX_CURRENCIES = 5;

function CurrencyPage() {
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [currencyMap, setCurrencyMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");

  useEffect(() => {
    apiFetch("/get-feature-flags")
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.currency_enabled || false);
        setApiKey(data.currency_api_key || "");
        setCurrencyMap(data.currency_map || {});
      })
      .catch((err) => console.error("Failed to load currency settings", err));

    apiFetch("/get-store-settings")
      .then((r) => r.json())
      .then((data) => setStoreUrl(data.store_url || ""))
      .catch(() => {});
  }, []);

  const configuredCount = useMemo(
    () => Object.values(currencyMap).filter((c) => c && c.trim().length === 3).length,
    [currencyMap]
  );
  const atLimit = configuredCount >= MAX_CURRENCIES;

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
          currency_map: currencyMap,
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

  const updateCurrency = (lang, code) => {
    code = code.toUpperCase();
    var prev = currencyMap[lang] || "";
    if (!prev && code.length === 3 && atLimit) return;
    setCurrencyMap((prev) => ({ ...prev, [lang]: code }));
  };

  const clearCurrency = (lang) => {
    setCurrencyMap((prev) => {
      var next = { ...prev };
      delete next[lang];
      return next;
    });
  };

  const storefrontLink = storeUrl
    ? `https://${storeUrl}`
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Currency Exchange</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enable automatic currency conversion on your storefront based on the selected language.
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
              <p className="text-xs text-slate-500">Convert prices to the local currency of each language.</p>
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
                  Language-to-Currency Mapping
                </label>
                <span className={`text-xs font-semibold ${atLimit ? "text-amber-600" : "text-slate-500"}`}>
                  {configuredCount}/{MAX_CURRENCIES} currencies configured
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Assign a currency code to each language. Maximum {MAX_CURRENCIES} languages can have currency conversion.
              </p>

              {atLimit && (
                <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-800">Maximum {MAX_CURRENCIES} currencies reached. Remove one before adding another.</p>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-slate-600 border-b border-slate-200">Language</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600 border-b border-slate-200">Currency Code</th>
                      <th className="w-10 border-b border-slate-200"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(currencyMap).map(([lang, code]) => {
                      var hasCode = code && code.trim().length === 3;
                      return (
                        <tr key={lang} className={`border-b border-slate-100 last:border-0 ${!hasCode && atLimit ? "opacity-40" : ""}`}>
                          <td className="px-4 py-2 text-slate-700">{lang}</td>
                          <td className="px-4 py-2">
                            <input
                              className="input-field w-24 uppercase"
                              value={code}
                              onChange={(e) => updateCurrency(lang, e.target.value)}
                              maxLength={3}
                              placeholder={!hasCode && atLimit ? "Limit reached" : "e.g. INR"}
                              disabled={!hasCode && atLimit}
                            />
                          </td>
                          <td className="px-2 py-2">
                            {hasCode && (
                              <button onClick={() => clearCurrency(lang)} className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer" title="Remove">
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
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
