import { useState, useEffect } from "react";
import { saveLanguages, getLanguages } from "../services/languageService";

const ALL_TARGET_LANGUAGES = [
  "French", "German", "Spanish", "Hindi", "Arabic",
  "Japanese", "Portuguese", "Marathi", "Italian", "Chinese", "Korean"
];

const ALL_SOURCE_LANGUAGES = [
  "English", "French", "German", "Spanish", "Hindi", "Japanese",
  "Portuguese", "Italian", "Chinese", "Korean", "Arabic"
];

function LanguagesPage() {
  const [sourceLanguage, setSourceLanguage] = useState("English");
  const [targetLanguages, setTargetLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }

  // Load saved settings on mount
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const data = await getLanguages();
        if (data.source) {
          setSourceLanguage(data.source);
        }
        if (Array.isArray(data.targets) && data.targets.length > 0) {
          setTargetLanguages(data.targets);
        }
      } catch (error) {
        console.error("Failed to load language settings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLanguages();
  }, []);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLanguageChange = (language) => {
    if (targetLanguages.includes(language)) {
      setTargetLanguages(targetLanguages.filter((item) => item !== language));
    } else {
      setTargetLanguages([...targetLanguages, language]);
    }
  };

  const handleSave = async () => {
    if (targetLanguages.length === 0) {
      showToast("error", "Please select at least one target language.");
      return;
    }

    setSaving(true);
    try {
      const response = await saveLanguages({
        source_language: sourceLanguage,
        target_languages: targetLanguages,
      });
      showToast("success", response.message || "Languages saved successfully!");
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Target languages list excludes the currently selected source language
  const availableTargets = ALL_TARGET_LANGUAGES.filter(
    (lang) => lang !== sourceLanguage
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-8 max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Languages</h1>
        </div>
        <div className="card-container p-12 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#008060] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading saved language settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg text-sm font-medium transition-all
            ${toast.type === "success"
              ? "bg-[#008060] text-white"
              : "bg-red-600 text-white"
            }`}
        >
          <span>
            {toast.type === "success" ? "✓" : "✕"}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Languages</h1>
      </div>

      <div className="card-container flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-1">Language Settings</h3>
          <p className="text-sm text-slate-500">
            Configure your store's source language and the languages customers can switch to.
          </p>
        </div>

        <div className="p-6 flex flex-col gap-8">
          {/* Source Language */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Source Language
            </label>
            <select
              className="input-field w-full md:max-w-md bg-white border-slate-200 text-slate-900"
              value={sourceLanguage}
              onChange={(e) => {
                const newSource = e.target.value;
                setSourceLanguage(newSource);
                if (targetLanguages.includes(newSource)) {
                  setTargetLanguages(targetLanguages.filter((l) => l !== newSource));
                }
              }}
            >
              {ALL_SOURCE_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2">
              This is the original language your store content is written in. It will always be available on your storefront.
            </p>
          </div>

          {/* Target Languages */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Target Languages
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Only the languages you select here will appear in the language switcher on your store.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableTargets.map((lang) => (
                <label
                  key={lang}
                  className="relative flex items-start p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-[#008060] border-slate-300 rounded focus:ring-[#008060]"
                      checked={targetLanguages.includes(lang)}
                      onChange={() => handleLanguageChange(lang)}
                    />
                  </div>
                  <div className="ml-3 flex flex-col">
                    <span className="text-sm font-medium text-slate-900">{lang}</span>
                  </div>
                </label>
              ))}
            </div>

            {targetLanguages.length > 0 && (
              <p className="text-xs text-[#008060] font-medium mt-3">
                ✓ {targetLanguages.length} language{targetLanguages.length > 1 ? "s" : ""} selected:{" "}
                {targetLanguages.join(", ")}
              </p>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Changes apply to your storefront immediately after saving.
          </p>
          <button
            className="btn btn-primary px-6 py-2 flex items-center gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LanguagesPage;