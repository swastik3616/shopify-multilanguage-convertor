import { useState, useEffect, useMemo } from "react";
import { saveLanguages, getLanguages } from "../services/languageService";

function LanguagesPage() {
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [changes, setChanges] = useState({});
  
  // UI States
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("All");

  // Load saved settings on mount
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const data = await getLanguages();
        if (Array.isArray(data)) {
          setLanguages(data);
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

  const handleStatusChange = (id, newStatus) => {
    setLanguages(prev => prev.map(lang => 
      lang.id === id ? { ...lang, status: newStatus } : lang
    ));
    setChanges(prev => ({
      ...prev,
      [id]: newStatus
    }));
  };

  const handleSave = async () => {
    const updates = Object.entries(changes).map(([id, status]) => ({
      id: parseInt(id),
      status
    }));

    if (updates.length === 0) {
      showToast("error", "No changes to save.");
      return;
    }

    setSaving(true);
    try {
      const response = await saveLanguages({ languages: updates });
      showToast("success", response.message || "Languages saved successfully!");
      setChanges({});
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Derived Data
  const sourceLangs = useMemo(() => languages.filter(l => l.status === "Source" || l.status === "Both"), [languages]);
  const targetLangs = useMemo(() => languages.filter(l => l.status === "Target" || l.status === "Both"), [languages]);

  const filteredLanguages = useMemo(() => {
    return languages.filter(lang => {
      const matchesSearch = lang.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            lang.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filter === "All" || lang.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [languages, searchQuery, filter]);

  if (loading) {
    return (
      <div className="flex flex-col gap-8 max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Languages</h1>
        <div className="card-container p-12 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-[#008060] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading language database...</p>
        </div>
      </div>
    );
  }

  const tabs = ["All", "Source", "Target", "Both", "None"];

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg text-sm font-medium transition-all ${toast.type === "success" ? "bg-[#008060] text-white" : "bg-red-600 text-white"}`}>
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Language Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage source and target languages for your store.</p>
        </div>
        {Object.keys(changes).length > 0 && (
          <button
            className="btn btn-primary px-6 py-2.5 flex items-center gap-2 shadow-md shadow-[#008060]/20 hover:shadow-lg hover:shadow-[#008060]/30 transition-all transform hover:-translate-y-0.5"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? "Saving..." : `Save ${Object.keys(changes).length} Changes`}
          </button>
        )}
      </div>

      {/* Active Overview Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-container p-6 bg-gradient-to-br from-white to-slate-50 border border-slate-200/60 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#008060] opacity-70"></div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#008060]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
            Active Source Languages
          </h3>
          <div className="flex flex-wrap gap-2">
            {sourceLangs.length > 0 ? sourceLangs.map(l => (
              <span key={l.id} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#008060]/10 text-[#008060] border border-[#008060]/20">
                {l.name} ({l.code})
              </span>
            )) : <p className="text-sm text-slate-400 italic">No source language selected.</p>}
          </div>
        </div>

        <div className="card-container p-6 bg-gradient-to-br from-white to-slate-50 border border-slate-200/60 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-70"></div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Active Target Languages
          </h3>
          <div className="flex flex-wrap gap-2">
            {targetLangs.length > 0 ? targetLangs.map(l => (
              <span key={l.id} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
                {l.name} ({l.code})
              </span>
            )) : <p className="text-sm text-slate-400 italic">No target languages selected.</p>}
          </div>
        </div>
      </div>

      {/* Grid Interface */}
      <div className="card-container flex flex-col">
        
        {/* Toolbar: Search and Filter */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Tabs */}
            <div className="flex bg-slate-100/80 p-1 rounded-lg overflow-x-auto hide-scrollbar">
              {tabs.map(tab => {
                const count = tab === "All" ? languages.length : languages.filter(l => l.status === tab).length;
                return (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab)}
                    className={`whitespace-nowrap px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"}`}
                  >
                    {tab} <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${filter === tab ? 'bg-slate-100 text-slate-600' : 'bg-slate-200/50 text-slate-400'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search languages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-9 py-2 text-sm w-full sm:w-64"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="p-0 overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm shadow-sm">
              <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Language</th>
                <th className="px-6 py-4 font-semibold">Code</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLanguages.map((lang) => (
                <tr key={lang.id} className={`transition-colors hover:bg-slate-50/70 ${changes[lang.id] ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-6 py-4 text-sm text-slate-400">{lang.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{lang.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-mono text-xs border border-slate-200/60">
                      {lang.code}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="relative">
                      <select
                        className={`input-field py-1.5 pl-3 pr-8 text-sm min-w-[130px] transition-colors ${lang.status === 'Source' ? 'bg-[#008060]/5 border-[#008060]/20 text-[#008060]' : lang.status === 'Target' ? 'bg-blue-50 border-blue-200 text-blue-700' : lang.status === 'Both' ? 'bg-purple-50 border-purple-200 text-purple-700' : ''}`}
                        value={lang.status}
                        onChange={(e) => handleStatusChange(lang.id, e.target.value)}
                      >
                        <option value="None">None</option>
                        <option value="Source">Source</option>
                        <option value="Target">Target</option>
                        <option value="Both">Both</option>
                      </select>
                      {changes[lang.id] && (
                        <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" title="Unsaved change"></span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLanguages.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <p className="text-slate-500 text-sm">No languages found matching your filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer info */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-xl flex items-center justify-between text-xs text-slate-400">
          <p>Showing {filteredLanguages.length} of {languages.length} total languages.</p>
          <p>Unsaved changes are marked with an orange dot.</p>
        </div>
      </div>
    </div>
  );
}

export default LanguagesPage;