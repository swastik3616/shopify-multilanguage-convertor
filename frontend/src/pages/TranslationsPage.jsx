import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search, Languages, FileText, RefreshCw, Store,
  Globe, Save, Loader2, X, Edit3, Check, Trash2, Zap
} from "lucide-react";
import { getTranslations } from "../services/translationHistoryService";
import {
  getContents, getContentsStoreStatus, syncContentsFromShopify,
  deleteContent, fetchUrlContent, importContentToLibrary,
  translateContent, updateContent, updateTranslation,
  createManualTranslation,
} from "../services/contentService";

const TARGET_LANGUAGES = ["Hindi", "Marathi", "French", "German", "Spanish", "Italian"];
const LANG_FLAGS = { Hindi:"🇮🇳", Marathi:"🇮🇳", French:"🇫🇷", German:"🇩🇪", Spanish:"🇪🇸", Italian:"🇮🇹" };

/* ─────────────────────────────────────────────
   Single row card: one content item
───────────────────────────────────────────── */
function ContentRow({ item, targetLanguage, allTranslations, onDelete, onContentSaved, onTranslationSaved }) {
  const existing = allTranslations.find(
    h => h.source_text === item.source_text && h.target_language === targetLanguage
  );

  const [translatedText, setTranslatedText]   = useState(existing?.translated_text || "");
  const [isTranslating, setIsTranslating]     = useState(false);
  const [isEditingOrig, setIsEditingOrig]     = useState(false);
  const [editOrig, setEditOrig]               = useState(item.source_text);
  const [isSavingOrig, setIsSavingOrig]       = useState(false);
  const [isEditingTrans, setIsEditingTrans]   = useState(false);
  const [editTrans, setEditTrans]             = useState("");
  const [isSavingTrans, setIsSavingTrans]     = useState(false);

  // sync when language or translations list changes
  useEffect(() => {
    const found = allTranslations.find(
      h => h.source_text === item.source_text && h.target_language === targetLanguage
    );
    setTranslatedText(found?.translated_text || "");
    setIsEditingTrans(false);
  }, [targetLanguage, allTranslations, item.source_text]);

  const handleAITranslate = async () => {
    setIsTranslating(true);
    try {
      const result = await translateContent(item.id, targetLanguage);
      if (!result.success) throw new Error(result.message || "Failed");
      setTranslatedText(result.translated_text || "");
      onTranslationSaved();
    } catch (e) { alert(e.message || "Translation error"); }
    finally { setIsTranslating(false); }
  };

  const handleSaveTrans = async () => {
    if (!editTrans.trim()) return;
    setIsSavingTrans(true);
    try {
      if (existing) {
        await updateTranslation(existing.id, editTrans);
      } else {
        await createManualTranslation(item.source_text, targetLanguage, editTrans);
      }
      setTranslatedText(editTrans);
      setIsEditingTrans(false);
      onTranslationSaved();
    } catch (e) { alert(e.message || "Save failed"); }
    finally { setIsSavingTrans(false); }
  };

  const handleSaveOrig = async () => {
    if (!editOrig.trim()) return;
    setIsSavingOrig(true);
    try {
      const result = await updateContent(item.id, { page: item.page, key: item.key, source_text: editOrig });
      if (!result.success) throw new Error(result.message);
      setIsEditingOrig(false);
      onContentSaved();
    } catch (e) { alert(e.message || "Save failed"); }
    finally { setIsSavingOrig(false); }
  };

  return (
    <div className="grid grid-cols-2 divide-x divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">

      {/* ── Left: Original ── */}
      <div className="flex flex-col p-4">
        {/* header */}
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            <FileText className="h-3 w-3" />
            {item.key}
          </span>
          <div className="flex items-center gap-2">
            {!isEditingOrig ? (
              <button
                onClick={() => { setIsEditingOrig(true); setEditOrig(item.source_text); }}
                className="text-[11px] text-slate-400 hover:text-[#008060] font-medium flex items-center gap-0.5 transition-colors"
              >
                <Edit3 className="h-3 w-3" /> Edit
              </button>
            ) : (
              <>
                <button onClick={() => setIsEditingOrig(false)} className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5">
                  <X className="h-3 w-3" /> Cancel
                </button>
                <button onClick={handleSaveOrig} disabled={isSavingOrig} className="text-[11px] text-[#008060] hover:text-[#006e52] font-semibold flex items-center gap-0.5">
                  {isSavingOrig ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                </button>
              </>
            )}
            <button onClick={() => onDelete(item.id)} className="text-[11px] text-red-400 hover:text-red-600 flex items-center gap-0.5">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* body */}
        {isEditingOrig ? (
          <textarea
            className="input-field w-full resize-none text-sm leading-relaxed flex-1"
            rows={4}
            value={editOrig}
            onChange={e => setEditOrig(e.target.value)}
            autoFocus
          />
        ) : (
          <p className="text-sm text-slate-700 leading-relaxed flex-1">{item.source_text}</p>
        )}

        <p className="text-[10px] text-slate-300 mt-3 text-right">{item.source_text.length} chars · {item.page}</p>
      </div>

      {/* ── Right: Translation ── */}
      <div className="flex flex-col p-4 bg-gradient-to-br from-emerald-50/40 to-white">
        {/* header */}
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            <Globe className="h-3 w-3" />
            {LANG_FLAGS[targetLanguage]} {targetLanguage}
          </span>
          <div className="flex items-center gap-2">
            {translatedText && !isEditingTrans && (
              <button
                onClick={() => { setIsEditingTrans(true); setEditTrans(translatedText); }}
                className="text-[11px] text-slate-400 hover:text-[#008060] font-medium flex items-center gap-0.5 transition-colors"
              >
                <Edit3 className="h-3 w-3" /> Edit
              </button>
            )}
            {isEditingTrans && (
              <>
                <button onClick={() => setIsEditingTrans(false)} className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5">
                  <X className="h-3 w-3" /> Cancel
                </button>
                <button onClick={handleSaveTrans} disabled={isSavingTrans} className="text-[11px] text-[#008060] hover:text-[#006e52] font-semibold flex items-center gap-0.5">
                  {isSavingTrans ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                </button>
              </>
            )}
            <button
              onClick={handleAITranslate}
              disabled={isTranslating}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-[#008060] hover:bg-[#006e52] px-2 py-0.5 rounded-full transition-colors disabled:opacity-60"
            >
              {isTranslating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              {isTranslating ? "…" : translatedText ? "Re-translate" : "Translate"}
            </button>
          </div>
        </div>

        {/* body */}
        {isEditingTrans ? (
          <textarea
            className="input-field w-full resize-none text-sm leading-relaxed flex-1"
            rows={4}
            value={editTrans}
            onChange={e => setEditTrans(e.target.value)}
            autoFocus
          />
        ) : translatedText ? (
          <p className="text-sm text-slate-700 leading-relaxed flex-1">{translatedText}</p>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-300 text-xs text-center p-3 mb-2">
              <span>Click <strong className="text-slate-400">Translate</strong> for AI or type below</span>
            </div>
            <div className="flex gap-2">
              <textarea
                rows={2}
                className="input-field flex-1 resize-none text-sm"
                placeholder={`Type ${targetLanguage} translation…`}
                value={editTrans}
                onChange={e => setEditTrans(e.target.value)}
              />
              <button
                disabled={isSavingTrans || !editTrans.trim()}
                onClick={handleSaveTrans}
                className="btn btn-primary px-3 self-stretch text-xs flex items-center gap-1"
              >
                {isSavingTrans ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}

        {translatedText && (
          <p className="text-[10px] text-slate-300 mt-3 text-right">{translatedText.length} chars</p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function TranslationsPage() {
  const [contents, setContents]         = useState([]);
  const [history, setHistory]           = useState([]);
  const [pageFilter, setPageFilter]     = useState("home");
  const [targetLanguage, setTargetLanguage] = useState("Hindi");
  const [searchTerm, setSearchTerm]     = useState("");
  const [isSyncing, setIsSyncing]       = useState(false);
  const [syncMessage, setSyncMessage]   = useState("");
  const [storeConnected, setStoreConnected] = useState(false);
  const [storeUrl, setStoreUrl]         = useState("");
  const [importUrl, setImportUrl]       = useState("");
  const [isImportingUrl, setIsImportingUrl] = useState(false);

  const loadContents = async (page = "home") => {
    try { setContents(await getContents(page)); } catch (e) { console.error(e); }
  };
  const loadTranslations = async () => {
    try { setHistory(await getTranslations()); } catch (e) { console.error(e); }
  };

  useEffect(() => {
    loadContents(pageFilter);
  }, [pageFilter]);

  useEffect(() => {
    loadTranslations();
    (async () => {
      try {
        const s = await getContentsStoreStatus();
        setStoreConnected(Boolean(s.connected));
        setStoreUrl(s.store_url || "");
      } catch (e) { console.error(e); }
    })();
  }, []);

  const handleSync = async () => {
    if (!["home","product","collection"].includes(pageFilter)) {
      setSyncMessage("Only home, product, collection can be synced."); return;
    }
    setIsSyncing(true); setSyncMessage("");
    try {
      const r = await syncContentsFromShopify(pageFilter);
      if (!r.success) throw new Error(r.message);
      setSyncMessage(r.message);
      await loadContents(pageFilter);
    } catch (e) { setSyncMessage(e.message || "Sync error"); }
    finally { setIsSyncing(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this content item?")) return;
    try {
      await deleteContent(id);
      await loadContents(pageFilter);
    } catch (e) { alert(e.message); }
  };

  const filteredContents = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return contents.filter(
      c => c.key.toLowerCase().includes(q) || c.source_text.toLowerCase().includes(q)
    );
  }, [contents, searchTerm]);

  // Translate ALL
  const [isBulkTranslating, setIsBulkTranslating] = useState(false);
  const handleTranslateAll = async () => {
    if (!filteredContents.length) return;
    setIsBulkTranslating(true);
    try {
      for (const item of filteredContents) {
        const already = history.find(h => h.source_text === item.source_text && h.target_language === targetLanguage);
        if (!already) await translateContent(item.id, targetLanguage);
      }
      await loadTranslations();
    } catch (e) { alert(e.message || "Bulk translate error"); }
    finally { setIsBulkTranslating(false); }
  };

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* ── Top bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Translation Workspace</h1>
          <p className="text-sm text-slate-500 mt-0.5">Each section shows <strong>original</strong> on the left and <strong>translation</strong> on the right.</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button
            className="btn btn-secondary h-9 gap-1.5 px-3 text-sm"
            onClick={handleSync}
            disabled={isSyncing || !["home","product","collection"].includes(pageFilter)}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing…" : "Sync Shopify"}
          </button>

          <div className="flex gap-1.5">
            <input type="text" placeholder="Import from URL…" className="input-field h-9 w-48 text-sm" value={importUrl} onChange={e => setImportUrl(e.target.value)} />
            <button className="btn btn-secondary h-9 px-3 text-sm" disabled={isImportingUrl} onClick={async () => {
              if (!importUrl.trim()) return alert("Enter a URL.");
              setIsImportingUrl(true);
              try {
                let url = importUrl.trim();
                if (!url.startsWith("http")) url = `https://${url}`;
                const fetched = await fetchUrlContent(url);
                if (!fetched?.success) throw new Error(fetched?.message || "Failed");
                let key = url;
                try { const u = new URL(url); key = u.pathname !== "/" ? u.pathname.replace(/\//g,"_") : u.hostname; } catch {}
                const imp = await importContentToLibrary({ page: pageFilter||"other", key: key.slice(0,200), source_text: fetched.text||"" });
                if (!imp?.success) throw new Error(imp?.message || "Import failed");
                await loadContents(pageFilter);
                setImportUrl("");
              } catch (err) { alert(err.message || String(err)); }
              finally { setIsImportingUrl(false); }
            }}>
              {isImportingUrl ? "Importing…" : "Import"}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Page</label>
            <select className="input-field h-9 min-w-[120px] text-sm" value={pageFilter} onChange={e => setPageFilter(e.target.value)}>
              {["home","product","checkout","collection","other"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Language</label>
            <select className="input-field h-9 min-w-[130px] text-sm" value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)}>
              {TARGET_LANGUAGES.map(l => <option key={l} value={l}>{LANG_FLAGS[l]} {l}</option>)}
            </select>
          </div>

          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
            <Search className="absolute left-2.5 bottom-2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search content…" className="input-field pl-9 h-9 w-48 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Store notice */}
      {!storeConnected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <Store className="h-4 w-4 shrink-0 text-amber-600" />
          No Shopify store connected. <Link to="/store-settings" className="font-semibold underline ml-1">Store Settings</Link>
        </div>
      )}
      {syncMessage && <p className="text-sm text-[#008060] font-medium">{syncMessage}</p>}

      {/* ── Column headers ── */}
      {filteredContents.length > 0 && (
        <div className="grid grid-cols-2 gap-0 px-1">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-l-lg border border-slate-200 border-r-0">
            <FileText className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Original Content</span>
            <span className="ml-auto text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">{filteredContents.length} items</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-r-lg border border-emerald-200 border-l-0">
            <Globe className="h-4 w-4 text-[#008060]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#008060]">{LANG_FLAGS[targetLanguage]} {targetLanguage} Translation</span>
            <button
              onClick={handleTranslateAll}
              disabled={isBulkTranslating}
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-[#008060] hover:bg-[#006e52] px-2.5 py-1 rounded-full transition-colors disabled:opacity-60"
            >
              {isBulkTranslating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              {isBulkTranslating ? "Translating all…" : "Translate All"}
            </button>
          </div>
        </div>
      )}

      {/* ── Content rows ── */}
      {filteredContents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-slate-400">
          <Languages className="h-12 w-12 mb-3 text-slate-200" />
          <p className="text-base font-semibold text-slate-600">No content for "{pageFilter}"</p>
          <p className="text-sm mt-1">
            {["home","product","collection"].includes(pageFilter)
              ? "Click \"Sync Shopify\" to import content from your store."
              : "This page type is manual. Switch to home, product, or collection."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredContents.map((item, index) => (
            <div key={item.id} className="relative">
              {/* Section number badge */}
              <div className="absolute -left-3 top-4 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-white text-[10px] font-bold shadow-sm">
                {index + 1}
              </div>
              <ContentRow
                item={item}
                targetLanguage={targetLanguage}
                allTranslations={history}
                onDelete={handleDelete}
                onContentSaved={() => loadContents(pageFilter)}
                onTranslationSaved={loadTranslations}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
