import { Monitor, Moon, Sun, AlertCircle, Check, DollarSign } from "lucide-react";
import { useState, useEffect } from "react";
import { apiFetch } from "../services/apiClient";
function SettingsPage() {
  const [expandExclusions, setExpandExclusions] = useState(false);

  const [currencyEnabled, setCurrencyEnabled] = useState(false);
  const [currencyApiKey, setCurrencyApiKey] = useState("");
  const [savingCurrency, setSavingCurrency] = useState(false);

  useEffect(() => {
    apiFetch("/get-feature-flags")
      .then(res => res.json())
      .then(data => {
        setCurrencyEnabled(data.currency_enabled || false);
        setCurrencyApiKey(data.currency_api_key || "");
      })
      .catch(err => console.error("Failed to load feature flags", err));
  }, []);

  const handleSaveApiKey = async () => {
    try {
      await apiFetch("/save-feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency_api_key: currencyApiKey }),
      });
      alert("API Key Saved Successfully");
    } catch (err) {
      console.error("Failed to save API key", err);
    }
  };

  const handleCurrencyToggle = async (enabled) => {
    setCurrencyEnabled(enabled);
    setSavingCurrency(true);
    try {
      await apiFetch("/save-feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency_enabled: enabled }),
      });
    } catch (err) {
      console.error("Failed to save currency flag", err);
    } finally {
      setSavingCurrency(false);
    }
  };


  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your application preferences and appearance.</p>
      </div>
      

      <div className="card-container p-6 w-full max-w-3xl">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          Experimental Features
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${currencyEnabled ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Currency Converter</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Enable multi-currency functionality on the storefront.</p>
              </div>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={currencyEnabled}
                disabled={savingCurrency}
                onChange={(e) => handleCurrencyToggle(e.target.checked)}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#008060]"></div>
            </label>
          </div>
          {currencyEnabled && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Currency API Key
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Enter your Exchange API key"
                  className="input-field flex-1"
                  value={currencyApiKey}
                  onChange={(e) => setCurrencyApiKey(e.target.value)}
                />
                <button onClick={handleSaveApiKey} className="btn btn-primary px-4">
                  Save Key
                </button>
              </div>
            </div>
          )}
        </div>
      </div>


      <div className="card-container p-6 w-full max-w-3xl">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          Translation Exclusions
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Automatic Protection Active
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-200 mt-1">
                The following content types are automatically excluded from translation across ALL languages:
              </p>
            </div>
          </div>

          <button
            onClick={() => setExpandExclusions(!expandExclusions)}
            className="w-full text-left px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
          >
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {expandExclusions ? "▼ Hide Protected Content Types" : "▶ Show Protected Content Types"}
            </span>
          </button>

          {expandExclusions && (
            <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-2">
                <span className="text-2xl">📧</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Email Addresses</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">contact@example.com, support@store.com</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-2xl">📱</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Phone Numbers</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">+1-800-123-4567, (555) 123-4567</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-2xl">🔗</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">URLs & Links</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">https://example.com, www.mysite.com</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-2xl">🔢</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Numbers & IDs</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">#12345, ID: 98765, Pure numbers</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-2xl">🏷️</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">HTML Tags</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">&lt;div&gt;, &lt;span&gt;, &lt;button&gt;</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                UI Language Always English
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-200 mt-1">
                All control buttons, labels, and interface elements always display in English. Only content (headings, descriptions, text) changes when switching languages.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default SettingsPage;