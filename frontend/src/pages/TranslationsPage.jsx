import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search, Languages, FileText, Trash2, RefreshCw,
  Store, Globe, ChevronRight, Save, Loader2, X, Edit3, Check
} from "lucide-react";
import { getTranslations } from "../services/translationHistoryService";
import {
  getContents, getContentsStoreStatus, syncContentsFromShopify,
  createContent, updateContent, deleteContent, fetchUrlContent,
  importContentToLibrary, translateContent, updateTranslation,
  deleteTranslation, createManualTranslation,
} from "../services/contentService";

const TARGET_LANGUAGES = ["Hindi", "Marathi", "French", "German", "Spanish", "Italian"];

const LANG_FLAGS = {
  Hindi: "🇮🇳", Marathi: "🇮🇳", French: "🇫🇷",
  German: "🇩🇪", Spanish: "🇪🇸", Italian: "🇮🇹",
};

function TranslationsPage() {
  const [contents, setContents] = useState([]);
  const [history, setHistory] = useState([]);
  const [pageFilter, setPageFilter] = useState("home");
  const [selectedContent, setSelectedContent] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Hindi");

  // translation state
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isEditingTranslation, setIsEditingTranslation] = useState(false);
  const [editText, setEditText] = useState("");
  const [isSavingTranslation, setIsSavingTranslation] = useState(false);

  // original edit state
  const [isEditingOriginal, setIsEditingOriginal] = useState(false);
  const [editOriginalText, setEditOriginalText] = useState("");
  const [isSavingOriginal, setIsSavingOriginal] = useState(false);

  // sync / store
  const [isSyncing, setIsSyncing] = useState(false);
  const [storeConnected, setStoreConnected] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [isImportingUrl, setIsImportingUrl] = useState(false);

  const loadContents = async (page = "home") => {
    try {
      const data = await getContents(page);
      setContents(data);
    } catch (e) { console.error(e); }
  };

  const loadTranslations = async () => {
    try {
      const data = await getTranslations();
      setHistory(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    loadContents(pageFilter);
    loadTranslations();
    setSelectedContent(null);
    setTranslatedText("");
    setIsEditingTranslation(false);
    setIsEditingOriginal(false);
  }, [pageFilter]);

  useEffect(() => {
    (async () => {
      try {
        const s = await getContentsStoreStatus();
        setStoreConnected(Boolean(s.connected));
        setStoreUrl(s.store_url || "");
      } catch (e) { console.error(e); }
    })();
  }, []);

  // When language changes, look up existing translation
  useEffect(() => {
    if (!selectedContent) return;
    const existing = history.find(
      h => h.source_text === selectedContent.source_text && h.target_language === targetLanguage
    );
    setTranslatedText(existing?.translated_text || "");
    setIsEditingTranslation(false);
  }, [targetLanguage, selectedContent, history]);

  const handleSelectContent = (content) => {
    setSelectedContent(content);
    setIsEditingOriginal(false);
    setIsEditingTranslation(false);
    const existing = history.find(
      h => h.source_text === content.source_text && h.target_language === targetLanguage
    );
    setTranslatedText(existing?.translated_text || "");
  };

  const handleSyncFromShopify = async () => {
    if (!["home", "product", "collection"].includes(pageFilter)) {
      setSyncMessage("Only home, product, and collection pages can be synced.");
      return;
    }
    setIsSyncing(true); setSyncMessage("");
    try {
      const result = await syncContentsFromShopify(pageFilter);
      if (!result.success) throw new Error(result.message || "Sync failed.");
      setSyncMessage(result.message);
      await loadContents(pageFilter);
    } catch (e) {
      setSyncMessage(e.message || "Unable to sync.");
    } finally { setIsSyncing(false); }
  };

  const handleAITranslate = async () => {
    if (!selectedContent) return;
    setIsTranslating(true);
    try {
      const result = await translateContent(selectedContent.id, targetLanguage);
      if (!result.success) throw new Error(result.message || "Translation failed.");
      setTranslatedText(result.translated_text || "");
      await loadTranslations();
    } catch (e) {
      alert(e.message || "Translation error.");
    } finally { setIsTranslating(false); }
  };

  const handleSaveTranslation = async () => {
    if (!editText.trim()) return;
    setIsSavingTranslation(true);
    try {
      const existing = history.find(
        h => h.source_text === selectedContent.source_text && h.target_language === targetLanguage
      );
      if (existing) {
        await updateTranslation(existing.id, editText);
      } else {
        await createManualTranslation(selectedContent.source_text, targetLanguage, editText);
      }
      setTranslatedText(editText);
      setIsEditingTranslation(false);
      await loadTranslations();
    } catch (e) {
      alert(e.message || "Save failed.");
    } finally { setIsSavingTranslation(false); }
  };

  const handleSaveOriginal = async () => {
    if (!editOriginalText.trim() || !selectedContent) return;
    setIsSavingOriginal(true);
    try {
      const result = await updateContent(selectedContent.id, {
        page: selectedContent.page,
        key: selectedContent.key,
        source_text: editOriginalText,
      });
      if (!result.success) throw new Error(result.message);
      await loadContents(pageFilter);
      setSelectedContent(prev => ({ ...prev, source_text: editOriginalText }));
      setIsEditingOriginal(false);
    } catch (e) {
      alert(e.message || "Save failed.");
    } finally { setIsSavingOriginal(false); }
  };

  const handleDeleteContent = async (contentId) => {
    if (!window.confirm("Delete this content item?")) return;
    try {
      await deleteContent(contentId);
      if (selectedContent?.id === contentId) {
        setSelectedContent(null);
        setTranslatedText("");
      }
      await loadContents(pageFilter);
    } catch (e) { alert(e.message || "Delete failed."); }
  };

  const filteredContents = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return contents.filter(
      item =>
        item.page.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q) ||
        item.source_text.toLowerCase().includes(q)
    );
  }, [contents, searchTerm]);

  const existingTranslation = history.find(
    h => selectedContent && h.source_text === selectedContent.source_text && h.target_language === targetLanguage
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[680px] flex-col gap-4">

      {/* ── Top bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Translation Workspace</h1>
          <p className="text-sm text-slate-500 mt-0.5">Edit original content and manage translations side-by-side.</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {/* Sync */}
          <button
            className="btn btn-secondary h-9 gap-1.5 px-3 text-sm"
            onClick={handleSyncFromShopify}
            disabled={isSyncing || !["home", "product", "collection"].includes(pageFilter)}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing…" : "Sync Shopify"}
          </button>

          {/* Import URL */}
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Import from URL…"
              className="input-field h-9 w-52 text-sm"
              value={importUrl}
              onChange={e => setImportUrl(e.target.value)}
            />
            <button
              className="btn btn-primary h-9 px-3 text-sm"
              disabled={isImportingUrl}
              onClick={async () => {
                if (!importUrl.trim()) return alert("Enter a URL.");
                setIsImportingUrl(true);
                try {
                  let url = importUrl.trim();
                  if (!url.startsWith("http")) url = `https://${url}`;
                  const fetched = await fetchUrlContent(url);
                  if (!fetched?.success) throw new Error(fetched?.message || "Failed");
                  let key = url;
                  try { const u = new URL(url); key = u.pathname !== "/" ? u.pathname.replace(/\//g, "_") : u.hostname; } catch {}
                  const imported = await importContentToLibrary({ page: pageFilter || "other", key: key.slice(0, 200), source_text: fetched.text || "" });
                  if (!imported?.success) throw new Error(imported?.message || "Import failed");
                  await loadContents(pageFilter);
                  setImportUrl("");
                  alert("Imported!");
                } catch (err) { alert(err.message || String(err)); }
                finally { setIsImportingUrl(false); }
              }}
            >
              {isImportingUrl ? "Importing…" : "Import"}
            </button>
          </div>

          {/* Page filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Page</label>
            <select className="input-field h-9 min-w-[130px] text-sm" value={pageFilter} onChange={e => setPageFilter(e.target.value)}>
              {["home","product","checkout","collection","other"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
            <Search className="absolute left-2.5 bottom-2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search…"
              className="input-field pl-9 h-9 w-52 text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* store info */}
      {!storeConnected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <Store className="h-4 w-4 shrink-0 text-amber-600" />
          <p>No Shopify store connected. <Link to="/store-settings" className="font-semibold underline">Store Settings</Link> → add URL + token → sync content.</p>
        </div>
      )}
      {syncMessage && (
        <p className="text-sm text-[#008060] font-medium">{syncMessage}</p>
      )}

      {/* ── Main 3-column grid ── */}
      <div className="grid flex-1 min-h-0 grid-cols-[280px_1fr_1fr] gap-4">

        {/* Col 1 – Content list */}
        <section className="card-container flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <FileText className="h-4 w-4 text-[#008060]" />
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">Content Items</h2>
              <p className="text-[11px] text-slate-400">{filteredContents.length} items</p>
            </div>
          </div>

          <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-50">
            {filteredContents.length === 0 ? (
              <li className="flex flex-col items-center justify-center h-full py-12 text-center text-slate-400 px-4">
                <Search className="h-8 w-8 mb-2 text-slate-200" />
                <p className="text-sm font-medium text-slate-600">No content found</p>
                <p className="text-xs mt-1">Sync from Shopify or import a URL</p>
              </li>
            ) : filteredContents.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleSelectContent(item)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 flex items-start justify-between gap-2 group ${
                    selectedContent?.id === item.id ? "bg-emerald-50 border-l-2 border-[#008060]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate">{item.key}</p>
                    <p className="text-sm text-slate-700 line-clamp-2 mt-0.5 leading-snug">{item.source_text}</p>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 mt-0.5 transition-colors ${selectedContent?.id === item.id ? "text-[#008060]" : "text-slate-200 group-hover:text-slate-400"}`} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Col 2 – Original content editor */}
        <section className="card-container flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-slate-400" />
              <h2 className="font-semibold text-slate-900 text-sm">Original Content</h2>
            </div>
            {selectedContent && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {selectedContent.page}
              </span>
            )}
          </div>

          <div className="flex flex-col flex-1 min-h-0 p-5 overflow-y-auto">
            {selectedContent ? (
              <>
                {/* Key badge */}
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Content Key</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{selectedContent.key}</p>
                  </div>
                  <button
                    className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                    onClick={() => handleDeleteContent(selectedContent.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>

                {/* Original text */}
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-500">Source Text</label>
                    {!isEditingOriginal ? (
                      <button
                        className="text-xs text-[#008060] hover:text-[#006e52] font-medium flex items-center gap-1"
                        onClick={() => { setIsEditingOriginal(true); setEditOriginalText(selectedContent.source_text); }}
                      >
                        <Edit3 className="h-3 w-3" /> Edit
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button className="text-xs text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1"
                          onClick={() => setIsEditingOriginal(false)}>
                          <X className="h-3 w-3" /> Cancel
                        </button>
                        <button
                          className="text-xs text-[#008060] hover:text-[#006e52] font-medium flex items-center gap-1"
                          onClick={handleSaveOriginal}
                          disabled={isSavingOriginal}
                        >
                          {isSavingOriginal ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Save
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditingOriginal ? (
                    <textarea
                      className="input-field flex-1 min-h-0 resize-none text-sm leading-relaxed"
                      value={editOriginalText}
                      onChange={e => setEditOriginalText(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedContent.source_text}</p>
                    </div>
                  )}
                </div>

                {/* char count */}
                <p className="text-[10px] text-slate-400 mt-2 text-right">
                  {selectedContent.source_text.length} characters
                </p>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-400">
                <FileText className="h-10 w-10 mb-3 text-slate-200" />
                <p className="text-sm font-semibold text-slate-600">Select a content item</p>
                <p className="text-xs mt-1">Pick an item from the list on the left</p>
              </div>
            )}
          </div>
        </section>

        {/* Col 3 – Translation */}
        <section className="card-container flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#008060]" />
              <h2 className="font-semibold text-slate-900 text-sm">Translation</h2>
            </div>
            {/* Language selector */}
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              <select
                className="input-field h-8 text-xs py-0 min-w-[120px]"
                value={targetLanguage}
                onChange={e => setTargetLanguage(e.target.value)}
              >
                {TARGET_LANGUAGES.map(l => (
                  <option key={l} value={l}>{LANG_FLAGS[l]} {l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col flex-1 min-h-0 p-5 overflow-y-auto">
            {selectedContent ? (
              <>
                {/* Language info row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{LANG_FLAGS[targetLanguage]}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{targetLanguage}</p>
                      <p className="text-[10px] text-slate-400">
                        {existingTranslation ? "Translation saved" : "No translation yet"}
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary h-8 px-3 text-xs gap-1.5 flex items-center"
                    onClick={handleAITranslate}
                    disabled={isTranslating}
                  >
                    {isTranslating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                    {isTranslating ? "Translating…" : existingTranslation ? "Re-translate" : "AI Translate"}
                  </button>
                </div>

                {/* Translation text area */}
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-500">Translated Text</label>
                    {translatedText && !isEditingTranslation && (
                      <button
                        className="text-xs text-[#008060] hover:text-[#006e52] font-medium flex items-center gap-1"
                        onClick={() => { setIsEditingTranslation(true); setEditText(translatedText); }}
                      >
                        <Edit3 className="h-3 w-3" /> Edit
                      </button>
                    )}
                    {isEditingTranslation && (
                      <div className="flex gap-2">
                        <button className="text-xs text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1"
                          onClick={() => setIsEditingTranslation(false)}>
                          <X className="h-3 w-3" /> Cancel
                        </button>
                        <button
                          className="text-xs text-[#008060] hover:text-[#006e52] font-medium flex items-center gap-1"
                          onClick={handleSaveTranslation}
                          disabled={isSavingTranslation}
                        >
                          {isSavingTranslation ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          Save
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditingTranslation ? (
                    <textarea
                      className="input-field flex-1 min-h-0 resize-none text-sm leading-relaxed"
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      autoFocus
                    />
                  ) : translatedText ? (
                    <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{translatedText}</p>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 rounded-lg border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-center p-6">
                      <Languages className="h-8 w-8 mb-2 text-slate-200" />
                      <p className="text-sm font-medium text-slate-500">No translation yet</p>
                      <p className="text-xs mt-1">Click <strong>AI Translate</strong> or edit manually below</p>
                    </div>
                  )}
                </div>

                {/* Manual entry if no translation */}
                {!translatedText && !isEditingTranslation && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-1.5">Or type translation manually</p>
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        className="input-field flex-1 resize-none text-sm"
                        placeholder={`Enter ${targetLanguage} translation…`}
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                      />
                      <button
                        className="btn btn-primary px-3 self-stretch flex items-center gap-1 text-xs"
                        onClick={handleSaveTranslation}
                        disabled={isSavingTranslation || !editText.trim()}
                      >
                        {isSavingTranslation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save
                      </button>
                    </div>
                  </div>
                )}

                {translatedText && (
                  <p className="text-[10px] text-slate-400 mt-2 text-right">
                    {translatedText.length} characters
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-400">
                <Globe className="h-10 w-10 mb-3 text-slate-200" />
                <p className="text-sm font-semibold text-slate-600">Translation will appear here</p>
                <p className="text-xs mt-1">Select content and choose a language</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}

export default TranslationsPage;
