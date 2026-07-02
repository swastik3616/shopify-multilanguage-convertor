import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search, RefreshCw, Store, Globe, Save, Loader2, X, Edit3, Check, Trash2, Zap, LayoutGrid, Layout
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

// ── Single translation row ────────────────────────────────────────────────────
function TranslationRow({ item, targetLanguage, allTranslations, onDelete, onContentSaved, onTranslationSaved }) {
  const findExisting = () => allTranslations.find(
    h => h.source_text === item.source_text && h.target_language === targetLanguage
  );

  const [translatedText, setTranslatedText] = useState(findExisting()?.translated_text || "");
  const [isTranslating, setIsTranslating]   = useState(false);
  const [isEditingOrig, setIsEditingOrig]   = useState(false);
  const [editOrig, setEditOrig]             = useState(item.source_text);
  const [isSavingOrig, setIsSavingOrig]     = useState(false);
  const [isEditingTrans, setIsEditingTrans] = useState(false);
  const [editTrans, setEditTrans]           = useState("");
  const [isSavingTrans, setIsSavingTrans]   = useState(false);

  useEffect(() => {
    const found = findExisting();
    setTranslatedText(found?.translated_text || "");
    setIsEditingTrans(false);
  }, [targetLanguage, allTranslations, item.source_text]);

  const handleAI = async () => {
    setIsTranslating(true);
    try {
      const r = await translateContent(item.id, targetLanguage);
      if (!r.success) throw new Error(r.message);
      setTranslatedText(r.translated_text || "");
      onTranslationSaved();
    } catch (e) { alert(e.message || "Translation failed"); }
    finally { setIsTranslating(false); }
  };

  const handleSaveTrans = async () => {
    const text = isEditingTrans ? editTrans : editTrans;
    if (!text.trim()) return;
    setIsSavingTrans(true);
    try {
      const ex = findExisting();
      if (ex) await updateTranslation(ex.id, text);
      else await createManualTranslation(item.source_text, targetLanguage, text);
      setTranslatedText(text);
      setIsEditingTrans(false);
      onTranslationSaved();
    } catch (e) { alert(e.message || "Save failed"); }
    finally { setIsSavingTrans(false); }
  };

  const handleSaveOrig = async () => {
    if (!editOrig.trim()) return;
    setIsSavingOrig(true);
    try {
      const r = await updateContent(item.id, { page: item.page, key: item.key, source_text: editOrig });
      if (!r.success) throw new Error(r.message);
      setIsEditingOrig(false);
      onContentSaved();
    } catch (e) { alert(e.message || "Save failed"); }
    finally { setIsSavingOrig(false); }
  };

  const isMultiline = item.source_text.length > 80 || item.html_tag === 'p';
  
  // Style text based on its HTML tag
  const getTextStyles = () => {
    switch(item.html_tag) {
      case 'h1': return 'text-xl font-bold text-slate-900';
      case 'h2': return 'text-lg font-bold text-slate-800';
      case 'h3': return 'text-base font-semibold text-slate-800';
      case 'h4': case 'h5': case 'h6': return 'text-sm font-semibold text-slate-700';
      case 'p': return 'text-sm text-slate-600 leading-relaxed';
      default: return 'text-sm text-slate-800 font-medium';
    }
  };

  const getTransTextStyles = () => {
    switch(item.html_tag) {
      case 'h1': return 'text-xl font-bold text-emerald-900';
      case 'h2': return 'text-lg font-bold text-emerald-800';
      case 'h3': return 'text-base font-semibold text-emerald-800';
      case 'h4': case 'h5': case 'h6': return 'text-sm font-semibold text-emerald-700';
      case 'p': return 'text-sm text-emerald-700 leading-relaxed';
      default: return 'text-sm text-emerald-900 font-medium';
    }
  };

  const textClass = getTextStyles();
  const transTextClass = getTransTextStyles();

  return (
    <div className="grid grid-cols-2 border-b border-slate-100 last:border-b-0 divide-x divide-slate-100 hover:bg-slate-50/50 transition-colors group">
      {/* Left: Original */}
      <div className="flex flex-col px-5 py-4 gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">&lt;{item.html_tag || 'text'}&gt;</span>
            {item.resource_id && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                📦 ID: {item.resource_id}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {!isEditingOrig ? (
              <button onClick={() => { setIsEditingOrig(true); setEditOrig(item.source_text); }}
                className="text-[11px] text-slate-400 hover:text-[#008060] flex items-center gap-0.5">
                <Edit3 className="h-3 w-3" /> Edit
              </button>
            ) : (
              <>
                <button onClick={() => setIsEditingOrig(false)} className="text-[11px] text-slate-400 flex items-center gap-0.5"><X className="h-3 w-3" /> Cancel</button>
                <button onClick={handleSaveOrig} disabled={isSavingOrig} className="text-[11px] text-[#008060] font-semibold flex items-center gap-0.5">
                  {isSavingOrig ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                </button>
              </>
            )}
            <button onClick={() => onDelete(item.id)} className="text-[11px] text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
          </div>
        </div>

        {isEditingOrig ? (
          <textarea className="input-field resize-none text-sm leading-relaxed w-full mt-1" rows={isMultiline ? 4 : 2}
            value={editOrig} onChange={e => setEditOrig(e.target.value)} autoFocus />
        ) : (
          <p className={`${textClass} mt-1`}>{item.source_text}</p>
        )}
      </div>

      {/* Right: Translation */}
      <div className="flex flex-col px-5 py-4 gap-2 bg-[#f4fbf9]">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">{LANG_FLAGS[targetLanguage]} {targetLanguage}</span>
          <div className="flex items-center gap-2 shrink-0">
            {translatedText && !isEditingTrans && (
              <button onClick={() => { setIsEditingTrans(true); setEditTrans(translatedText); }}
                className="text-[11px] text-slate-400 hover:text-[#008060] flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit3 className="h-3 w-3" /> Edit
              </button>
            )}
            {isEditingTrans && (
              <>
                <button onClick={() => setIsEditingTrans(false)} className="text-[11px] text-slate-400 flex items-center gap-0.5"><X className="h-3 w-3" /> Cancel</button>
                <button onClick={handleSaveTrans} disabled={isSavingTrans} className="text-[11px] text-[#008060] font-semibold flex items-center gap-0.5">
                  {isSavingTrans ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                </button>
              </>
            )}
            <button onClick={handleAI} disabled={isTranslating}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-[#008060] hover:bg-[#006e52] px-2 py-0.5 rounded-full transition-colors disabled:opacity-60">
              {isTranslating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              {isTranslating ? "…" : translatedText ? "Re-do" : "Translate"}
            </button>
          </div>
        </div>

        {isEditingTrans ? (
          <textarea className="input-field resize-none text-sm leading-relaxed w-full mt-1" rows={isMultiline ? 4 : 2}
            value={editTrans} onChange={e => setEditTrans(e.target.value)} autoFocus />
        ) : translatedText ? (
          <p className={`${transTextClass} mt-1`}>{translatedText}</p>
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <input type="text" className="input-field h-8 flex-1 text-sm bg-white" placeholder={`Type ${targetLanguage}…`}
              value={editTrans} onChange={e => setEditTrans(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSaveTrans(); }} />
            {editTrans.trim() && (
              <button onClick={handleSaveTrans} disabled={isSavingTrans} className="btn btn-primary h-8 px-2 text-xs">
                {isSavingTrans ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section block ─────────────────────────────────────────────────────────────
function SectionBlock({ sectionNumber, title, items, targetLanguage, allTranslations, onDelete, onContentSaved, onTranslationSaved }) {
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);

  const handleTranslateAll = async () => {
    setIsTranslatingAll(true);
    try {
      for (const item of items) {
        const existing = allTranslations.find(h => h.source_text === item.source_text && h.target_language === targetLanguage);
        if (!existing) await translateContent(item.id, targetLanguage);
      }
      onTranslationSaved();
    } catch (e) { alert(e.message || "Error"); }
    finally { setIsTranslatingAll(false); }
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-8 bg-white">
      {/* Section header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[#008060] text-white font-bold shadow-sm">
            {sectionNumber}
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-800">{title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{items.length} content element{items.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button onClick={handleTranslateAll} disabled={isTranslatingAll}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#008060] hover:bg-[#006e52] px-4 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-60">
          {isTranslatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {isTranslatingAll ? "Translating Section…" : "Translate Entire Section"}
        </button>
      </div>

      {/* Column sub-header */}
      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white border-b border-slate-100">
        <div className="px-5 py-2.5 flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Original Website Content</span>
        </div>
        <div className="px-5 py-2.5 flex items-center gap-1.5 bg-[#f4fbf9]">
          <Globe className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
            {LANG_FLAGS[targetLanguage]} {targetLanguage} Translation
          </span>
        </div>
      </div>

      {/* Rows */}
      <div className="bg-white">
        {items.map(item => (
          <TranslationRow
            key={item.id}
            item={item}
            targetLanguage={targetLanguage}
            allTranslations={allTranslations}
            onDelete={onDelete}
            onContentSaved={onContentSaved}
            onTranslationSaved={onTranslationSaved}
          />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TranslationsPage() {
  const [contents, setContents]             = useState([]);
  const [history, setHistory]               = useState([]);
  const [pageFilter, setPageFilter]         = useState("home");
  const [targetLanguage, setTargetLanguage] = useState("Hindi");
  const [searchTerm, setSearchTerm]         = useState("");
  const [isSyncing, setIsSyncing]           = useState(false);
  const [syncMessage, setSyncMessage]       = useState("");
  const [storeConnected, setStoreConnected] = useState(false);
  const [storeUrl, setStoreUrl]             = useState("");
  const [importUrl, setImportUrl]           = useState("");
  const [isImportingUrl, setIsImportingUrl] = useState(false);

  const loadContents = async (page = "home") => {
    try { setContents(await getContents(page)); } catch (e) { console.error(e); }
  };
  const loadTranslations = async () => {
    try { setHistory(await getTranslations()); } catch (e) { console.error(e); }
  };

  useEffect(() => { loadContents(pageFilter); }, [pageFilter]);
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
    try { await deleteContent(id); await loadContents(pageFilter); }
    catch (e) { alert(e.message); }
  };

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return contents.filter(
      c => c.key.toLowerCase().includes(q) || c.source_text.toLowerCase().includes(q)
    );
  }, [contents, searchTerm]);

  // Dynamically group items into website sections based on real section_id
  const dynamicSections = useMemo(() => {
    const groups = {};
    
    filtered.forEach(item => {
      let groupName = item.section_id || "Uncategorized Section";
      
      // Clean up "shopify-section-featured-products" -> "Featured Products"
      if (groupName.startsWith("shopify-section-")) {
        groupName = groupName.replace("shopify-section-", "");
      }
      
      // Capitalize nicely
      groupName = groupName.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
      
      // Add "Section" suffix if it doesn't have it
      if (!groupName.toLowerCase().includes("section")) {
        groupName += " Section";
      }
      
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    });

    // Convert to array and preserve insertion order roughly
    let sectionCount = 1;
    return Object.keys(groups).map(title => ({
      title,
      items: groups[title],
      sectionNumber: sectionCount++
    }));
  }, [filtered]);

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Translation Workspace</h1>
          <p className="text-sm text-slate-500 mt-0.5">Translate your website section by section.</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button className="btn btn-secondary h-9 gap-1.5 px-3 text-sm" onClick={handleSync}
            disabled={isSyncing || !["home","product","collection"].includes(pageFilter)}>
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing…" : "Sync Shopify"}
          </button>

          <div className="flex gap-1.5">
            <input type="text" placeholder="Import from URL…" className="input-field h-9 w-44 text-sm"
              value={importUrl} onChange={e => setImportUrl(e.target.value)} />
            <button className="btn btn-secondary h-9 px-3 text-sm" disabled={isImportingUrl}
              onClick={async () => {
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
            <input type="text" placeholder="Search…" className="input-field pl-9 h-9 w-44 text-sm"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Notices */}
      {!storeConnected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <Store className="h-4 w-4 shrink-0 text-amber-600" />
          No Shopify store connected.{" "}
          <Link to="/store-settings" className="font-semibold underline">Store Settings</Link>
        </div>
      )}
      {syncMessage && <p className="text-sm text-[#008060] font-medium">{syncMessage}</p>}

      {/* Render Dynamic Sections */}
      {dynamicSections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-slate-400">
          <LayoutGrid className="h-12 w-12 mb-3 text-slate-200" />
          <p className="text-base font-semibold text-slate-600">No content for "{pageFilter}"</p>
          <p className="text-sm mt-1">
            {["home","product","collection"].includes(pageFilter)
              ? 'Click "Sync Shopify" to import content from your store.'
              : "Switch to home, product, or collection to sync from Shopify."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {dynamicSections.map(section => (
            <SectionBlock
              key={section.title}
              sectionNumber={section.sectionNumber}
              title={section.title}
              items={section.items}
              targetLanguage={targetLanguage}
              allTranslations={history}
              onDelete={handleDelete}
              onContentSaved={() => loadContents(pageFilter)}
              onTranslationSaved={loadTranslations}
            />
          ))}
        </div>
      )}
    </div>
  );
}
