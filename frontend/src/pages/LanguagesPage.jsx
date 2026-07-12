import { useState, useEffect } from "react";
import { saveLanguages, getLanguages } from "../services/languageService";

function LanguagesPage() {
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }
  const [changes, setChanges] = useState({});

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
      setChanges({}); // Reset changes after successful save
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-8 max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Languages</h1>
        </div>
        <div className="card-container p-12 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#008060] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading languages...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
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
        {Object.keys(changes).length > 0 && (
          <button
            className="btn btn-primary px-6 py-2 flex items-center gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>

      <div className="card-container flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-1">Language Settings</h3>
          <p className="text-sm text-slate-500">
            Configure your store's source and target languages from the list below.
          </p>
        </div>

        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">Language</th>
                <th className="px-6 py-4 font-medium">Code</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {languages.map((lang) => (
                <tr key={lang.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-500">{lang.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{lang.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-mono text-xs">
                      {lang.code}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      className="input-field py-1.5 px-3 text-sm min-w-[120px]"
                      value={lang.status}
                      onChange={(e) => handleStatusChange(lang.id, e.target.value)}
                    >
                      <option value="None">None</option>
                      <option value="Source">Source</option>
                      <option value="Target">Target</option>
                      <option value="Both">Both</option>
                    </select>
                  </td>
                </tr>
              ))}
              {languages.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500 text-sm">
                    No languages found. Did you run the database seed script?
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default LanguagesPage;