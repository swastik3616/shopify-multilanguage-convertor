import { useState, useEffect } from "react";
import { getTranslations } from "../services/translationHistoryService";
import { Search } from "lucide-react";

function TranslationsPage() {
const [sourceText, setSourceText] = useState("");
const [targetLanguage, setTargetLanguage] = useState("Hindi");
const [translatedText, setTranslatedText] = useState("");
const [history, setHistory] = useState([]);
const [editingId, setEditingId] = useState(null);

const [searchTerm, setSearchTerm] = useState("");
const [filterLanguage, setFilterLanguage] = useState("All");

const loadTranslations = async () => {
  try {
    const data = await getTranslations();

    console.log("Translations:", data);

    setHistory(data);
  } catch (error) {
    console.error("Error loading translations:", error);
  }
};

useEffect(() => {
  let isMounted = true;

  (async () => {
    try {
      const data = await getTranslations();

      console.log("Translations:", data);

      if (isMounted) {
        setHistory(data);
      }
    } catch (error) {
      console.error("Error loading translations:", error);
    }
  })();

  return () => {
    isMounted = false;
  };
}, []);

const handleTranslate = async () => {
  if (!sourceText.trim() || !targetLanguage) {
    alert("Please enter text and select a language");
    return;
  }
  try {
    const response = await fetch("http://localhost:5000/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_text: sourceText,
        target_language: targetLanguage,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    setTranslatedText(data.translated_text || "");
    await loadTranslations();
  } catch (error) {
    console.error("Error translating text:", error);
    alert(`Failed to translate text: ${error.message}`);
  }
};

const handleSaveChanges = () => {
  if (editingId === null) return;

  const editingIndex = history.findIndex((item) => item.id === editingId);
  if (editingIndex === -1) return;

  const updatedHistory = [...history];

  updatedHistory[editingIndex] = {
    ...updatedHistory[editingIndex],
    source_text: sourceText,
    target_language: targetLanguage,
    translated_text: translatedText,
  };

  setHistory(updatedHistory);
  setEditingId(null);
  setSourceText("");
  setTargetLanguage("Hindi");
  setTranslatedText("");

  alert("Translation updated successfully");
};

const filteredHistory = history.filter((item) => {
const matchesSearch =
item.source_text
.toLowerCase()
.includes(searchTerm.toLowerCase()) ||
item.translated_text
.toLowerCase()
.includes(searchTerm.toLowerCase());

const matchesLanguage =
  filterLanguage === "All" ||
  item.target_language === filterLanguage;

return matchesSearch && matchesLanguage;



});

return (
  <div className="flex flex-col gap-8">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Translations</h1>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card-container p-6 flex flex-col gap-4">
        <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">New Translation</h3>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Source Text</label>
          <textarea
            className="input-field min-h-[120px] resize-y"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Enter text to translate..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Target Language</label>
          <select
            className="input-field"
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
          >
            <option>Hindi</option>
            <option>Marathi</option>
            <option>French</option>
            <option>German</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button className="btn btn-primary flex-1 py-2" onClick={handleTranslate}>
            Translate
          </button>
          {editingId !== null && (
            <button className="btn btn-secondary flex-1 py-2" onClick={handleSaveChanges}>
              Save Changes
            </button>
          )}
        </div>
      </div>

      <div className="card-container p-6 flex flex-col gap-4">
        <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Translated Output</h3>
        <textarea
          className="input-field flex-1 min-h-[120px] bg-slate-50"
          value={translatedText}
          onChange={(e) => setTranslatedText(e.target.value)}
          placeholder="Translation will appear here..."
          readOnly={editingId === null}
        />
      </div>
    </div>

    <div className="card-container flex flex-col">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="font-semibold text-slate-900">Translation History</h3>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search translations..."
              className="input-field pl-9 h-9 text-sm w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="input-field h-9 text-sm w-36"
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
          >
            <option>All Languages</option>
            <option>Hindi</option>
            <option>Marathi</option>
            <option>French</option>
            <option>German</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-3">Source Text</th>
              <th className="px-6 py-3">Language</th>
              <th className="px-6 py-3">Translation</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-900 max-w-xs truncate" title={item.source_text}>{item.source_text}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {item.target_language}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={item.translated_text}>{item.translated_text}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      className="text-sm font-medium text-[#008060] hover:text-[#006e52]"
                      onClick={() => {
                        setEditingId(item.id);
                        setSourceText(item.source_text);
                        setTargetLanguage(item.target_language);
                        setTranslatedText(item.translated_text);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                      <Search className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-900">No translations found</p>
                    <p className="text-sm text-slate-500">Try adjusting your search or filter</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex items-center justify-between text-sm text-slate-500">
        Showing {filteredHistory.length} records
      </div>
    </div>
  </div>
);
}

export default TranslationsPage;
