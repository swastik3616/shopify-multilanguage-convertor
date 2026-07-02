import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search, Languages, FileText, RefreshCw, Store,
  Globe, Save, Loader2, X, Edit3, Check, Trash2,
  Zap, Type, AlignLeft, Package, Tag, DollarSign, LayoutGrid
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

// ── Classify a content item into a section type ──────────────────────────────
function classifyItem(item) {
  const key = item.key.toLowerCase();
  const text = item.source_text.trim();

  // Price: looks like a currency amount
  if (/price|amount|cost|₹|\$|rs\.?/i.test(key) || /^(₹|\$|rs\.?\s*)[\d,]+(\.\d{1,2})?$/i.test(text)) return "prices";

  // Heading tags: h1–h4 in key
  if (/\bh[1-4]\b/.test(key) || /heading|header|banner_title|hero_title|page_title|section_title/.test(key)) return "headings";

  // Product names/titles
  if (/(product|item|prod)[_\s]*(name|title)|name.*product|title.*product/.test(key)) return "product_names";

  // Collection names
  if (/collection[_\s]*(name|title)|category[_\s]*(name|title)/.test(key)) return "collection_names";

  // Descriptions / paragraphs / body
  if (/desc(ription)?|body|paragraph|para\b|content|about|text|story|detail/.test(key)) return "descriptions";

  // Short text (≤60 chars) that wasn't classified = likely a heading/label
  if (text.length <= 80) return "headings";

  return "paragraphs";
}

const SECTIONS = [
  { id: "headings",        label: "Headings & Titles",       icon: Type,       color: "violet",  desc: "h1, h2, h3, page titles, banners" },
  { id: "product_names",   label: "Product Names",            icon: Package,    color: "blue",    desc: "product & item names" },
  { id: "prices",          label: "Prices",                   icon: DollarSign, color: "amber",   desc: "prices, amounts, costs" },
  { id: "collection_names",label: "Collection & Category Names",icon: Tag,      color: "pink",    desc: "collection & category names" },
  { id: "descriptions",    label: "Descriptions",             icon: AlignLeft,  color: "emerald", desc: "product descriptions, about sections" },
  { id: "paragraphs",      label: "Paragraphs & Body Text",   icon: FileText,   color: "slate",   desc: "general body text" },
];

const COLOR_MAP = {
  violet:  { section: "bg-violet-50 border-violet-200", badge: "bg-violet-100 text-violet-700", header: "text-violet-700", dot: "bg-violet-400" },
  blue:    { section: "bg-blue-50 border-blue-200",     badge: "bg-blue-100 text-blue-700",     header: "text-blue-700",   dot: "bg-blue-400" },
  amber:   { section: "bg-amber-50 border-amber-200",   badge: "bg-amber-100 text-amber-700",   header: "text-amber-700",  dot: "bg-amber-400" },
  pink:    { section: "bg-pink-50 border-pink-200",     badge: "bg-pink-100 text-pink-700",     header: "text-pink-700",   dot: "bg-pink-400" },
  emerald: { section: "bg-emerald-50 border-emerald-200",badge:"bg-emerald-100 text-emerald-700",header:"text-emerald-700",dot:"bg-emerald-400" },
  slate:   { section: "bg-slate-50 border-slate-200",   badge: "bg-slate-100 text-slate-600",   header: "text-slate-600",  dot: "bg-slate-400" },
};

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

  const isMultiline = item.source_text.length > 120;

  return (
    <div className="grid grid-cols-2 border-b border-slate-100 last:border-b-0 divide-x divide-slate-100 hover:bg-slate-50/50 transition-colors group">

      {/* Left: Original */}
      <div className="flex flex-col px-4 py-3 gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">{item.key}</span>
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
          <textarea className="input-field resize-none text-sm leading-relaxed w-full" rows={isMultiline ? 4 : 2}
            value={editOrig} onChange={e => setEditOrig(e.target.value)} autoFocus />
        ) : (
          <p className={`text-sm text-slate-800 leading-relaxed ${isMultiline ? "" : "font-medium"}`}>{item.source_text}</p>
        )}
      </div>

      {/* Right: Translation */}
      <div className="flex flex-col px-4 py-3 gap-2 bg-emerald-50/30">
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
          <textarea className="input-field resize-none text-sm leading-relaxed w-full" rows={isMultiline ? 4 : 2}
            value={editTrans} onChange={e => setEditTrans(e.target.value)} autoFocus />
        ) : translatedText ? (
          <p className={`text-sm text-slate-700 leading-relaxed ${isMultiline ? "" : "font-medium"}`}>{translatedText}</p>
        ) : (
          <div className="flex items-center gap-2">
            <input type="text" className="input-field h-8 flex-1 text-sm" placeholder={`Type ${targetLanguage}…`}
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
function SectionBlock({ section, items, targetLanguage, allTranslations, onDelete, onContentSaved, onTranslationSaved }) {
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const colors = COLOR_MAP[section.color];
  const Icon = section.icon;

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
    <div className={`rounded-xl border ${colors.section} overflow-hidden`}>
      {/* Section header */}
      <div className={`flex items-center justify-between px-5 py-3 ${colors.section} border-b ${colors.section.split(" ")[1]}`}>
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg bg-white shadow-sm`}>
            <Icon className={`h-4 w-4 ${colors.header}`} />
          </div>
          <div>
            <h2 className={`font-bold text-sm ${colors.header}`}>{section.label}</h2>
            <p className="text-[11px] text-slate-400">{section.desc} · {items.length} item{items.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button onClick={handleTranslateAll} disabled={isTranslatingAll}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#008060] hover:bg-[#006e52] px-3 py-1.5 rounded-full transition-colors disabled:opacity-60">
          {isTranslatingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {isTranslatingAll ? "Translating…" : "Translate All"}
        </button>
      </div>

      {/* Column sub-header */}
      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white/60 border-b border-slate-200">
        <div className="px-4 py-2 flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Original Text</span>
        </div>
        <div className="px-4 py-2 flex items-center gap-1.5">
          <Globe className="h-3 w-3 text-emerald-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
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

  // Group by section type
  const grouped = useMemo(() => {
    const map = {};
    for (const s of SECTIONS) map[s.id] = [];
    for (const item of filtered) {
      const type = classifyItem(item);
      if (map[type]) map[type].push(item);
      else map["paragraphs"].push(item);
    }
    return map;
  }, [filtered]);

  const activeSections = SECTIONS.filter(s => grouped[s.id]?.length > 0);

  return (
    <div className="flex flex-col gap-5 pb-10">

      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Translation Workspace</h1>
          <p className="text-sm text-slate-500 mt-0.5">Content grouped by type — headings, products, descriptions etc. Original left · Translation right.</p>
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

      {/* Section summary pills */}
      {activeSections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeSections.map(s => {
            const colors = COLOR_MAP[s.color];
            const Icon = s.icon;
            return (
              <span key={s.id} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${colors.section} ${colors.header}`}>
                <Icon className="h-3 w-3" />
                {s.label} <span className="opacity-60">({grouped[s.id].length})</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Grouped sections */}
      {activeSections.length === 0 ? (
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
        <div className="flex flex-col gap-6">
          {activeSections.map(section => (
            <SectionBlock
              key={section.id}
              section={section}
              items={grouped[section.id]}
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
