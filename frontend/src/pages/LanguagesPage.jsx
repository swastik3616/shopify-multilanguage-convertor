import { useState, useEffect, useMemo } from "react";
import { saveLanguages, getLanguages } from "../services/languageService";

function LanguagesPage() {
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  
  const [sourceLangId, setSourceLangId] = useState("");
  const [targetLangIds, setTargetLangIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const MAX_TARGET_LANGUAGES=10;

  const showToast = (type, message) => {
  setToast({ type, message });

  setTimeout(() => {
    setToast(null);
  }, 3500);
};

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const data = await getLanguages();
        if (Array.isArray(data)) {
          // Sort languages alphabetically
          const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
          setLanguages(sorted);
          
          let source = "";
          let targets = new Set();
          
          sorted.forEach(l => {
            if (l.status === "Source" || l.status === "Both") {
              if (!source) source = l.id.toString();
            }
            if (l.status === "Target" || l.status === "Both") {
              targets.add(l.id.toString());
            }
          });
          
          setSourceLangId(source);
          setTargetLangIds(targets);
        }
      } catch (error) {
        console.error("Failed to load language settings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLanguages();
  }, []);

const handleTargetToggle = (idStr) => {
  setTargetLangIds((prev) => {
    const next = new Set(prev);

    if (next.has(idStr)) {
      next.delete(idStr);
      return next;
    }

    if (next.size >= MAX_TARGET_LANGUAGES) {
      showToast(
        "error",
        `You can select a maximum of ${MAX_TARGET_LANGUAGES} target languages.`
      );
      return prev;
    }

    next.add(idStr);
    return next;
  });
};

  const handleSave = async () => {
    setSaving(true);
    
    const updates = languages.map(l => {
      const idStr = l.id.toString();
      const isSource = idStr === sourceLangId;
      const isTarget = targetLangIds.has(idStr);
      
      let newStatus = "None";
      if (isSource && isTarget) newStatus = "Both";
      else if (isSource) newStatus = "Source";
      else if (isTarget) newStatus = "Target";
      
      return { id: l.id, status: newStatus, oldStatus: l.status };
    }).filter(l => l.status !== l.oldStatus)
      .map(({ id, status }) => ({ id, status }));
      
    if (updates.length === 0) {
      showToast("success", "No changes needed.");
      setSaving(false);
      return;
    }

    try {
      const response = await saveLanguages({ languages: updates });
      showToast("success", response.message || "Languages saved successfully!");
      setLanguages(prev => prev.map(l => {
        const update = updates.find(u => u.id === l.id);
        return update ? { ...l, status: update.status } : l;
      }));
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const filteredLanguages = useMemo(() => {
    return languages.filter(lang => 
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      lang.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [languages, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col gap-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Languages</h1>
        <div className="card-container p-12 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-[#008060] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading language database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto pb-12">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg text-sm font-medium transition-all ${toast.type === "success" ? "bg-[#008060] text-white" : "bg-red-600 text-white"}`}>
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Language Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Select your store's original language and the languages you want to translate into.</p>
        </div>
        <button
          className="btn btn-primary px-6 py-2.5 flex items-center gap-2 shadow-md shadow-[#008060]/20 hover:shadow-lg hover:shadow-[#008060]/30 transition-all transform hover:-translate-y-0.5"
          onClick={handleSave}
          disabled={saving}
        >
          {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      <div className="card-container p-6 border-l-4 border-l-[#008060]">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Source Language</h2>
        <p className="text-sm text-slate-500 mb-4">Choose the single original language your store is currently written in.</p>
        <div className="max-w-md">
          <select 
            className="input-field w-full cursor-pointer"
            value={sourceLangId}
            onChange={(e) => setSourceLangId(e.target.value)}
          >
            <option value="" disabled>Select a source language</option>
            {languages.map(l => (
              <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card-container p-6 border-l-4 border-l-blue-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">2. Target Languages</h2>
            <p className="text-sm text-slate-500">Select multiple languages to translate your store into.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search languages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-9 py-2 text-sm w-full"
            />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-96 overflow-y-auto">
          {filteredLanguages.length === 0 ? (
            <p className="text-center text-slate-500 py-8 text-sm">No languages found matching your search.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredLanguages.map(lang => {
                const idStr = lang.id.toString();
                const isSelected = targetLangIds.has(idStr);
                const isSource = idStr === sourceLangId;
                const limitReached =
                targetLangIds.size >= MAX_TARGET_LANGUAGES && !isSelected;
                
                return (
                  <label
                      key={lang.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-blue-50 border-blue-200 shadow-sm"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      } ${
                        isSource ? "opacity-50 grayscale cursor-not-allowed" : ""
                      }`}
                    >
                    <div className="flex items-center h-5">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                        checked={isSelected}
                        onChange={() => handleTargetToggle(idStr)}
                        disabled={isSource}
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                        {lang.name}
                      </span>
                      <span className={`text-xs ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>
                        {lang.code} {isSource && "(Source)"}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-between items-center text-xs text-slate-500">
          <span>{targetLangIds.size} / {MAX_TARGET_LANGUAGES} target languages selected.</span>
          <button 
            className="text-blue-600 hover:text-blue-800 font-medium"
            onClick={() => setTargetLangIds(new Set())}
          >
            Clear All Targets
          </button>
        </div>
      </div>
    </div>
  );
}

export default LanguagesPage;