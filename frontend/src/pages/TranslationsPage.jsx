import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search, RefreshCw, Store, Globe, Save, Loader2, X, Edit3, Check, Trash2, Zap, LayoutGrid, Layout, Wand2
} from "lucide-react";
import { getTranslations } from "../services/translationHistoryService";
import {
  getContents, getContentsStoreStatus, syncContentsFromShopify,
  deleteContent, fetchUrlContent, fetchAndParseUrl, importContentToLibrary,
  translateContent, updateContent, updateTranslation,
  createManualTranslation,
} from "../services/contentService";

const TARGET_LANGUAGES = ["Hindi", "Marathi", "French", "German", "Spanish", "Italian"];
const LANG_FLAGS = { Hindi: "🇮🇳", Marathi: "🇮🇳", French: "🇫🇷", German: "🇩🇪", Spanish: "🇪🇸", Italian: "🇮🇹" };

// ── Single translation row ────────────────────────────────────────────────────
function TranslationRow({ item, targetLanguage, allTranslations, onDelete, onContentSaved, onTranslationSaved }) {
  const findExisting = () => allTranslations.find(
    h => h.source_text === item.source_text && h.target_language === targetLanguage
  );

  const [translatedText, setTranslatedText] = useState(findExisting()?.translated_text || "");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isEditingOrig, setIsEditingOrig] = useState(false);
  const [editOrig, setEditOrig] = useState(item.source_text);
  const [isSavingOrig, setIsSavingOrig] = useState(false);
  const [isEditingTrans, setIsEditingTrans] = useState(false);
  const [editTrans, setEditTrans] = useState("");
  const [isSavingTrans, setIsSavingTrans] = useState(false);

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 group hover:bg-slate-50/50 transition-colors relative border-t border-emerald-50/50 md:divide-x divide-emerald-50/50">
      
      {/* Absolute action buttons shown on hover */}
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 backdrop-blur-sm p-1 rounded-lg border border-slate-100 shadow-sm z-10">
        {!isEditingOrig && !isEditingTrans && (
           <button onClick={() => { setIsEditingOrig(true); setEditOrig(item.source_text); }} className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50" title="Edit Original">
             <Edit3 className="h-3.5 w-3.5" />
           </button>
        )}
        {!isEditingTrans && translatedText && (
          <button onClick={() => { setIsEditingTrans(true); setEditTrans(translatedText); }} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded hover:bg-emerald-50" title="Edit Translation">
            <Edit3 className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={handleAI} disabled={isTranslating} className="p-1.5 text-slate-400 hover:text-[#008060] rounded hover:bg-emerald-50" title="Re-translate">
          {isTranslating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
        </button>
        <button onClick={() => onDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Left: Original */}
      <div className="px-5 py-4 flex items-start gap-4">
        <span className="h-6 w-6 shrink-0 rounded bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center uppercase" title={item.html_tag || 'text'}>
          {(item.html_tag || 'T').charAt(0)}
        </span>
        <div className="flex-1">
          {isEditingOrig ? (
            <div className="flex flex-col gap-2">
              <textarea className="input-field resize-none text-sm leading-relaxed w-full" rows={isMultiline ? 3 : 1} value={editOrig} onChange={e => setEditOrig(e.target.value)} autoFocus />
              <div className="flex gap-2">
                <button onClick={handleSaveOrig} disabled={isSavingOrig} className="btn btn-primary h-7 px-3 text-xs">{isSavingOrig ? 'Saving...' : 'Save'}</button>
                <button onClick={() => setIsEditingOrig(false)} className="btn btn-secondary h-7 px-3 text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-slate-700 leading-relaxed">{item.source_text}</p>
          )}
        </div>
      </div>

      {/* Right: Translation */}
      <div className="px-5 py-4 flex items-start gap-4">
        <span className="h-6 w-6 shrink-0 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold flex items-center justify-center uppercase">
          {(item.html_tag || 'T').charAt(0)}
        </span>
        <div className="flex-1">
          {isEditingTrans ? (
            <div className="flex flex-col gap-2">
              <textarea className="input-field resize-none text-sm leading-relaxed w-full border-emerald-200 focus:border-emerald-500" rows={isMultiline ? 3 : 1} value={editTrans} onChange={e => setEditTrans(e.target.value)} autoFocus />
              <div className="flex gap-2">
                <button onClick={handleSaveTrans} disabled={isSavingTrans} className="btn h-7 px-3 text-xs bg-[#008060] text-white hover:bg-[#006e52]">Save</button>
                <button onClick={() => setIsEditingTrans(false)} className="btn btn-secondary h-7 px-3 text-xs">Cancel</button>
              </div>
            </div>
          ) : translatedText ? (
            <p className="text-[13px] text-slate-700 leading-relaxed">{translatedText}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <input type="text" className="input-field h-8 text-[13px] bg-slate-50 border-dashed border-slate-300 w-full" placeholder={`Type ${targetLanguage} translation…`}
                value={editTrans} onChange={e => setEditTrans(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleSaveTrans(); }} />
               {editTrans.trim() && (
                 <button onClick={handleSaveTrans} disabled={isSavingTrans} className="btn btn-primary h-7 w-fit px-3 text-xs">Save</button>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section block ─────────────────────────────────────────────────────────────
function SectionBlock({ sectionNumber, title, items, targetLanguage, allTranslations, onDelete, onContentSaved, onTranslationSaved, defaultExpanded = false }) {
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleTranslateAll = async (e) => {
    e.stopPropagation();
    setIsTranslatingAll(true);
    try {
      for (const item of items) {
        const existing = allTranslations.find(h => h.source_text === item.source_text && h.target_language === targetLanguage);
        if (!existing) await translateContent(item.id, targetLanguage);
      }
      onTranslationSaved();
      setIsExpanded(true);
    } catch (e) { alert(e.message || "Error"); }
    finally { setIsTranslatingAll(false); }
  };

  const translatedCount = items.filter(item => 
    allTranslations.find(h => h.source_text === item.source_text && h.target_language === targetLanguage)
  ).length;
  const isFullyTranslated = translatedCount === items.length && items.length > 0;

  return (
    <div className={`rounded-3xl border transition-all duration-200 shadow-sm mb-4 bg-white overflow-hidden ${isExpanded ? 'border-[#008060] ring-1 ring-[#008060]/10' : 'border-slate-200'}`}>
      {/* Section header */}
      <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50/50" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 w-5">§{sectionNumber}</span>
          <span className={`text-[13px] font-semibold px-3 py-1 rounded-full ${isExpanded ? (title.toLowerCase() === 'meta my store' ? 'text-slate-700 bg-slate-100' : 'text-amber-600 bg-amber-50') : 'text-slate-700 bg-slate-100'}`}>
            {title}
          </span>
          <span className="text-[12px] text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
            {items.length} element{items.length !== 1 ? 's' : ''}
          </span>
          {isFullyTranslated && (
            <span className="text-[12px] font-semibold text-[#008060] bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Check className="h-3 w-3"/> Translated
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleTranslateAll} disabled={isTranslatingAll}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#111827] hover:bg-black px-4 py-2 rounded-full shadow-sm transition-colors disabled:opacity-60">
            {isTranslatingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {isTranslatingAll ? "Translating…" : "Translate"}
          </button>
          <div className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Column sub-header */}
          <div className="grid grid-cols-2 divide-x divide-emerald-50/50 bg-white border-t border-emerald-50/50 px-5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">ORIGINAL</span>
            </div>
            <div className="flex items-center gap-2 pl-5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#008060]"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#008060]">
                {targetLanguage.toUpperCase()}
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
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TranslationsPage() {
  const [contents, setContents] = useState([]);
  const [history, setHistory] = useState([]);
  const [pageFilter, setPageFilter] = useState("home");
  const [targetLanguage, setTargetLanguage] = useState("Hindi");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [storeConnected, setStoreConnected] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);

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
    if (!["home", "product", "collection"].includes(pageFilter)) {
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

  const handleFetchUrl = async () => {
    const urlToFetch = importUrl.trim() || storeUrl;
    if (!urlToFetch) return alert("Enter a URL or connect a store.");
    
    setIsImportingUrl(true);
    try {
      let url = urlToFetch;
      
      // Clean up common pasting errors (e.g., pasting a URL at the end of an existing domain string)
      // "0jeqkm-rp.myshopify.comhttps://0jeqkm-rp.myshopify.com/"
      const lastHttpIdx = url.lastIndexOf("http");
      if (lastHttpIdx > 0) {
        url = url.substring(lastHttpIdx);
      } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
      }
      
      // Try to determine page type from URL
      let determinedPage = "other";
      if (url.includes("/products/")) determinedPage = "product";
      else if (url.includes("/collections/")) determinedPage = "collection";
      else if (url.endsWith("/") || url === `https://${storeUrl}` || url === `http://${storeUrl}`) determinedPage = "home";

      const fetched = await fetchAndParseUrl(url, determinedPage);
      if (!fetched?.success) throw new Error(fetched?.message || "Failed to parse URL");
      
      setPageFilter(determinedPage); // Switch to the imported page type
      await loadContents(determinedPage);
      
      alert(fetched.message || `Successfully fetched ${fetched.imported} elements.`);
    } catch (err) { alert(err.message || String(err)); }
    finally { setIsImportingUrl(false); }
  };

  const handleTranslateAllGlobal = async () => {
    setIsTranslatingAll(true);
    try {
      for (const item of contents) {
        const existing = history.find(h => h.source_text === item.source_text && h.target_language === targetLanguage);
        if (!existing) await translateContent(item.id, targetLanguage);
      }
      await loadTranslations();
    } catch (e) { alert(e.message || "Error translating all"); }
    finally { setIsTranslatingAll(false); }
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

  // Group items by their element type (Headings, Paragraphs, Buttons, etc.)
  const dynamicSections = useMemo(() => {
    const groups = {};

    const getCategoryFromTag = (tag) => {
      const t = (tag || "text").toLowerCase();
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(t)) return "Headings";
      if (['p', 'span', 'strong', 'em', 'b', 'i', 'li', 'ul', 'ol', 'div', 'text', 'label'].includes(t)) return "Paragraphs & Text";
      if (['a'].includes(t)) return "Links";
      if (['button'].includes(t)) return "Buttons";
      if (['img', 'image'].includes(t)) return "Image Alt Text";
      if (['meta', 'title'].includes(t)) return "Meta & SEO";
      if (['input', 'textarea', 'placeholder', 'select', 'option'].includes(t)) return "Form Fields";
      return "Other Elements";
    };

    filtered.forEach(item => {
      const groupName = getCategoryFromTag(item.html_tag);
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    });

    // Determine the preferred display order
    const order = [
      "Meta & SEO", 
      "Headings", 
      "Paragraphs & Text", 
      "Buttons", 
      "Links", 
      "Form Fields", 
      "Image Alt Text", 
      "Other Elements"
    ];

    let sectionCount = 1;
    return order
      .filter(title => groups[title] && groups[title].length > 0)
      .map(title => ({
        title,
        items: groups[title],
        sectionNumber: sectionCount++
      }));
  }, [filtered]);

  // Calculate translation progress
  const totalElements = contents.length;
  const translatedElements = contents.filter(item => 
    history.find(h => h.source_text === item.source_text && h.target_language === targetLanguage)
  ).length;
  const progressPercent = totalElements === 0 ? 0 : Math.round((translatedElements / totalElements) * 100);

  return (
    <div className="flex flex-col max-w-5xl mx-auto pb-16">
      {/* Top bar Card */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] p-6 mb-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="h-12 w-12 bg-emerald-50 text-[#008060] rounded-full flex items-center justify-center shrink-0">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Translation Workspace</h1>
            <p className="text-sm text-slate-500 mt-0.5">Fetch any page — see every element by type, translate section by section</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full mb-5">
          <input 
            type="text" 
            className="input-field flex-1 h-11 bg-slate-50/80 border-slate-200 rounded-full px-5 text-[13px] w-full" 
            placeholder={storeUrl ? `e.g. https://${storeUrl}/` : "https://yourstore.myshopify.com/"}
            value={importUrl}
            onChange={e => setImportUrl(e.target.value)}
          />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select 
              className="input-field h-11 w-[120px] bg-slate-50/80 border-slate-200 rounded-full px-4 text-[13px] font-medium"
              value={targetLanguage} 
              onChange={e => setTargetLanguage(e.target.value)}
            >
              {TARGET_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <button 
              className="btn h-11 px-6 rounded-full bg-[#008060] hover:bg-[#006e52] text-white text-[13px] font-semibold flex items-center gap-2 whitespace-nowrap"
              onClick={handleFetchUrl}
              disabled={isImportingUrl}
            >
              {isImportingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>}
              Fetch
            </button>
            <button 
              className="btn h-11 px-6 rounded-full bg-[#111827] hover:bg-black text-white text-[13px] font-semibold flex items-center gap-2 whitespace-nowrap"
              onClick={handleTranslateAllGlobal}
              disabled={isTranslatingAll || contents.length === 0}
            >
              {isTranslatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Translate All
            </button>
            <button 
              className="btn h-11 w-11 p-0 shrink-0 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500"
              onClick={handleSync}
              disabled={isSyncing}
              title="Sync current page from Shopify"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
             <div className="h-full bg-[#008060] transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
           </div>
           <span className="text-[12px] text-slate-500 font-semibold whitespace-nowrap">
             {translatedElements}/{totalElements} elements - {progressPercent}%
           </span>
        </div>
      </div>

      {/* Notices */}
      {!storeConnected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2 mb-4">
          <Store className="h-4 w-4 shrink-0 text-amber-600" />
          No Shopify store connected.{" "}
          <Link to="/store-settings" className="font-semibold underline">Store Settings</Link>
        </div>
      )}
      {syncMessage && <p className="text-sm text-[#008060] font-medium mb-4 px-2">{syncMessage}</p>}

      {/* Render Dynamic Sections */}
      {dynamicSections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-slate-400 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <LayoutGrid className="h-12 w-12 mb-3 text-slate-200" />
          <p className="text-base font-semibold text-slate-600">No content available</p>
          <p className="text-sm mt-1">Enter a URL above and click Fetch to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {dynamicSections.map((section, idx) => (
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
              defaultExpanded={idx === 1 || dynamicSections.length === 1} // Expand second section by default to match screenshot
            />
          ))}
        </div>
      )}
    </div>
  );
}
