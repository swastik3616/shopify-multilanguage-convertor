import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { getTranslations } from "../services/translationHistoryService";
import {
  getContents,
  createContent,
  updateContent,
  deleteContent,
  translateContent,
  updateTranslation,
  deleteTranslation,
} from "../services/contentService";

const TARGET_LANGUAGES = ["Hindi", "Marathi", "French", "German"];

function TranslationsPage() {
  const [contents, setContents] = useState([]);
  const [history, setHistory] = useState([]);

  const [pageFilter, setPageFilter] = useState("home");
  const [contentKey, setContentKey] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Hindi");
  const [translatedText, setTranslatedText] = useState("");

  const [selectedContent, setSelectedContent] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("All");

  const [editingTranslationId, setEditingTranslationId] = useState(null);
  const [editingTranslationText, setEditingTranslationText] = useState("");

  const loadContents = async (page = "home") => {
    try {
      const data = await getContents(page);
      setContents(data);
    } catch (error) {
      console.error("Error loading contents:", error);
    }
  };

  const loadTranslations = async () => {
    try {
      const data = await getTranslations();
      setHistory(data);
    } catch (error) {
      console.error("Error loading translations:", error);
    }
  };

  useEffect(() => {
    loadContents(pageFilter);
    loadTranslations();
    setSelectedContent(null);
    setTranslatedText("");
  }, [pageFilter]);

  const resetForm = () => {
    setSelectedContent(null);
    setContentKey("");
    setSourceText("");
    setTranslatedText("");
  };

  const handleSelectContent = (content) => {
    setSelectedContent(content);
    setContentKey(content.key);
    setSourceText(content.source_text);
    setTranslatedText("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveContent = async () => {
    if (!contentKey.trim() || !sourceText.trim()) {
      alert("Content key and source text are required.");
      return;
    }

    try {
      let result;
      if (selectedContent) {
        result = await updateContent(selectedContent.id, {
          page: selectedContent.page || pageFilter,
          key: contentKey,
          source_text: sourceText,
        });
      } else {
        result = await createContent({
          page: pageFilter,
          key: contentKey,
          source_text: sourceText,
        });
      }

      if (!result.success) {
        throw new Error(result.message || "Failed to save content.");
      }

      await loadContents(pageFilter);
      resetForm();
    } catch (error) {
      console.error("Error saving content:", error);
      alert(error.message || "Unable to save content.");
    }
  };

  const handleDeleteContent = async (contentId) => {
    if (!window.confirm("Delete this content item?")) {
      return;
    }

    try {
      const result = await deleteContent(contentId);
      if (!result.success) {
        throw new Error(result.message || "Failed to delete content.");
      }

      if (selectedContent?.id === contentId) {
        resetForm();
      }

      await loadContents();
    } catch (error) {
      console.error("Error deleting content:", error);
      alert(error.message || "Unable to delete content.");
    }
  };

  const handleTranslateSavedContent = async () => {
    if (!selectedContent) {
      alert("Select a saved content item before translating.");
      return;
    }

    try {
      const result = await translateContent(selectedContent.id, targetLanguage);
      if (!result.success) {
        throw new Error(result.message || "Translation failed.");
      }

      setTranslatedText(result.translated_text || "");
      await loadTranslations();
    } catch (error) {
      console.error("Error translating saved content:", error);
      alert(error.message || "Unable to translate saved content.");
    }
  };

  const handleEditTranslation = (item) => {
    setEditingTranslationId(item.id);
    setEditingTranslationText(item.translated_text);
  };

  const handleSaveTranslationEdit = async (translationId) => {
    if (!editingTranslationText.trim()) {
      alert("Translation text cannot be empty.");
      return;
    }

    try {
      const result = await updateTranslation(translationId, editingTranslationText);
      if (!result.success) {
        throw new Error(result.message || "Failed to update translation.");
      }

      await loadTranslations();
      setEditingTranslationId(null);
      setEditingTranslationText("");
    } catch (error) {
      console.error("Error updating translation:", error);
      alert(error.message || "Unable to update translation.");
    }
  };

  const handleDeleteTranslation = async (translationId) => {
    if (!window.confirm("Delete this translation record?")) {
      return;
    }

    try {
      const result = await deleteTranslation(translationId);
      if (!result.success) {
        throw new Error(result.message || "Failed to delete translation.");
      }

      await loadTranslations();
    } catch (error) {
      console.error("Error deleting translation:", error);
      alert(error.message || "Unable to delete translation.");
    }
  };

  const filteredContents = contents.filter((item) => {
    const query = searchTerm.toLowerCase();
    return (
      item.page.toLowerCase().includes(query) ||
      item.key.toLowerCase().includes(query) ||
      item.source_text.toLowerCase().includes(query)
    );
  });

  const filteredHistory = history.filter((item) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      item.source_text.toLowerCase().includes(query) ||
      item.translated_text.toLowerCase().includes(query);
    const matchesLanguage =
      filterLanguage === "All" || item.target_language === filterLanguage;

    return matchesSearch && matchesLanguage;
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Website Content</h1>
          <p className="text-sm text-slate-500 mt-1">
            Add, edit, and delete saved page content. Translate only after the content item is persisted.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-container p-6 flex flex-col gap-4">
          <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Content Editor</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current Page</label>
            <select
              className="input-field"
              value={pageFilter}
              onChange={(e) => setPageFilter(e.target.value)}
            >
              <option value="home">home</option>
              <option value="product">product</option>
              <option value="checkout">checkout</option>
              <option value="collection">collection</option>
              <option value="other">other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Source Text</label>
            <textarea
              className="input-field min-h-[120px] resize-y"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Enter the website text to save..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn btn-primary flex-1 py-2" onClick={handleSaveContent}>
              {selectedContent ? "Update Content" : "Save Content"}
            </button>
            <button
              className="btn btn-secondary flex-1 py-2"
              onClick={resetForm}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="card-container p-6 flex flex-col gap-4">
          <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Translate Saved Content</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Target Language</label>
            <select
              className="input-field"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
            >
              {TARGET_LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn btn-primary flex-1 py-2" onClick={handleTranslateSavedContent}>
              Translate Saved Item
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Translated Output</label>
            <textarea
              className="input-field flex-1 min-h-[120px] bg-slate-50"
              value={translatedText}
              readOnly
              placeholder="Translated text will appear here after translation."
            />
          </div>
        </div>
      </div>

      <div className="card-container flex flex-col">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900">Saved Content Items</h3>
            <p className="text-sm text-slate-500 mt-1">Only stored content appears here. Use this for all website pages.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search saved content..."
                className="input-field pl-9 h-9 text-sm w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Page</th>
                <th className="px-6 py-3">Key</th>
                <th className="px-6 py-3">Source Text</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContents.length > 0 ? (
                filteredContents.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-900">{item.page}</td>
                    <td className="px-6 py-4">{item.key}</td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={item.source_text}>
                      {item.source_text}
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button
                        className="text-sm font-medium text-[#008060] hover:text-[#006e52]"
                        onClick={() => handleSelectContent(item)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-sm font-medium text-[#c92a2a] hover:text-[#a50e0e]"
                        onClick={() => handleDeleteContent(item.id)}
                      >
                        Delete
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
                      <p className="text-sm font-medium text-slate-900">No saved content found</p>
                      <p className="text-sm text-slate-500">Create a content item to manage and translate website text.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex items-center justify-between text-sm text-slate-500">
          Showing {filteredContents.length} saved content item(s)
        </div>
      </div>

      <div className="card-container flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900">Translation History</h3>
            <p className="text-sm text-slate-500 mt-1">Records of translated content items.</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              className="input-field h-9 text-sm w-36"
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value)}
            >
              <option>All</option>
              {TARGET_LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
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
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-900 max-w-xs truncate" title={item.source_text}>
                      {item.source_text}
                    </td>
                    <td className="px-6 py-4">{item.target_language}</td>
                    <td className="px-6 py-4">
                      {editingTranslationId === item.id ? (
                        <textarea
                          className="input-field text-sm w-64 min-h-[80px] resize-y"
                          value={editingTranslationText}
                          onChange={(e) => setEditingTranslationText(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <span className="text-slate-600 max-w-xs truncate" title={item.translated_text}>
                          {item.translated_text}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      {editingTranslationId === item.id ? (
                        <>
                          <button
                            className="text-sm font-medium text-[#008060] hover:text-[#006e52]"
                            onClick={() => handleSaveTranslationEdit(item.id)}
                          >
                            Save
                          </button>
                          <button
                            className="text-sm font-medium text-slate-500 hover:text-slate-700"
                            onClick={() => {
                              setEditingTranslationId(null);
                              setEditingTranslationText("");
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="text-sm font-medium text-[#008060] hover:text-[#006e52]"
                            onClick={() => handleEditTranslation(item)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-sm font-medium text-[#c92a2a] hover:text-[#a50e0e]"
                            onClick={() => handleDeleteTranslation(item.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
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
                      <p className="text-sm font-medium text-slate-900">No translation history yet</p>
                      <p className="text-sm text-slate-500">Translate a saved content item to add history.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex items-center justify-between text-sm text-slate-500">
          Showing {filteredHistory.length} history record(s)
        </div>
      </div>
    </div>
  );
}

export default TranslationsPage;
