import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Globe, Loader2, RefreshCw, Languages,
  ChevronDown, ChevronRight, PanelLeft, Sparkles,
  Image as ImageIcon, CheckCircle2, AlertCircle,
} from "lucide-react";
import { fetchUrlContent } from "../services/translationPageService";
import { translateText } from "../services/translationService";

/* ─── Constants ─────────────────────────────────────────────── */
const LANGUAGES = ["Hindi", "Marathi", "French", "German", "Spanish", "Portuguese", "Japanese", "Arabic"];
const HEADING_TAGS = ["H1", "H2", "H3", "H4", "H5", "H6"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG"]);
const TEXT_TAGS = new Set(["P","SPAN","A","LI","BUTTON","LABEL","SMALL","STRONG","EM","B","I","TD","TH","CAPTION","SUMMARY"]);
const STRUCTURAL_TAGS = new Set(["HEADER","NAV","MAIN","FOOTER","ASIDE","SECTION","ARTICLE"]);
const DELIMITER = "\n\n";

/* ─── Helpers ────────────────────────────────────────────────── */
function uid(p = "id") { return `${p}_${Math.random().toString(36).slice(2, 9)}`; }
function norm(t = "") { return t.replace(/\s+/g, " ").trim(); }
function keepLoose(node, text) {
  if (!text || text.length < 2 || text.length > 220) return false;
  const pt = node.parentElement?.tagName;
  return !pt || !["SCRIPT","STYLE","NOSCRIPT"].includes(pt);
}

function levelBadge(level) {
  if (level === 1) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (level === 2) return "border-sky-200 bg-sky-50 text-sky-700";
  if (level >= 3) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function kindLabel(kind) {
  return { header:"Header", nav:"Navigation", main:"Main", footer:"Footer", aside:"Aside", fallback:"Fallback" }[kind] ?? "Content";
}

function getTag(level) {
  return ["h1","h2","h3","h4","h5","h6"][level - 1] ?? "h6";
}

function hClass(level) {
  if (level === 1) return "text-2xl font-bold tracking-tight text-slate-950";
  if (level === 2) return "text-xl font-semibold text-slate-900";
  if (level === 3) return "text-lg font-semibold text-slate-800";
  return "text-base font-semibold text-slate-800";
}

/* ─── Parser ─────────────────────────────────────────────────── */
function parseHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const meta = {
    title: doc.title?.trim() || "",
    description: doc.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || "",
  };
  const sections = [];
  let cur = null;

  const start = ({ level = 0, heading = "", kind = "content" } = {}) => {
    cur = { id: uid("sec"), level, heading, kind, paragraphs: [], images: [] };
    sections.push(cur); return cur;
  };
  const ensure = (kind, heading, level = 1) => { if (!cur || cur.kind !== kind) start({ kind, heading, level }); };

  start({ level: 0, heading: "Intro", kind: "intro" });

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  const seen = new Set();

  while (node) {
    if (!SKIP_TAGS.has(node.tagName)) {
      const tag = node.tagName;
      if      (tag === "HEADER") ensure("header", "Header", 1);
      else if (tag === "NAV")    ensure("nav", "Navigation", 2);
      else if (tag === "MAIN")   ensure("main", "Main Content", 1);
      else if (tag === "FOOTER") ensure("footer", "Footer", 1);
      else if (tag === "ASIDE")  ensure("aside", "Sidebar / Aside", 2);
      else if (HEADING_TAGS.includes(tag)) {
        const t = norm(node.textContent || "");
        if (t) start({ level: Number(tag[1]), heading: t, kind: cur?.kind || "content" });
      } else if (tag === "P") {
        const t = norm(node.textContent || "");
        if (t.length > 1) { const k = `${cur?.id}::${t}`; if (!seen.has(k)) { cur.paragraphs.push({ id: uid("p"), text: t }); seen.add(k); } }
      } else if (tag === "IMG") {
        const alt = node.getAttribute("alt");
        if (alt !== null) cur.images.push({ id: uid("img"), alt: norm(alt) });
      } else if (TEXT_TAGS.has(tag) && node.children.length === 0) {
        const t = norm(node.textContent || "");
        if (keepLoose(node, t)) { const k = `${cur?.id}::${t}`; if (!seen.has(k)) { cur.paragraphs.push({ id: uid("p"), text: t }); seen.add(k); } }
      } else if (STRUCTURAL_TAGS.has(tag) && !cur) {
        start({ level: 0, heading: tag, kind: "content" });
      }
    }
    node = walker.nextNode();
  }

  return {
    meta,
    sections: sections.filter(s => (s.heading && s.heading !== "Intro") || s.paragraphs.length || s.images.length),
  };
}

function fallbackSection(text) {
  return {
    id: uid("sec"), level: 0, heading: "Imported Content", kind: "fallback",
    paragraphs: text.split(/\n{2,}/).map(t => t.trim()).filter(Boolean).map(t => ({ id: uid("p"), text: t })),
    images: [],
  };
}

/* ─── Translation helpers ────────────────────────────────────── */
function buildPayload(section) {
  const blocks = [];
  if (section.heading) blocks.push(section.heading);
  section.paragraphs.forEach(p => blocks.push(p.text));
  return blocks.join(DELIMITER);
}

function applyResult(section, joined) {
  const blocks = joined.split(DELIMITER).map(b => b.trim()).filter(Boolean);
  const expected = (section.heading ? 1 : 0) + section.paragraphs.length;
  if (blocks.length !== expected) {
    return { translatedHeading: section.heading ? joined.trim() : "", translatedParagraphs: section.paragraphs.map(p => ({ id: p.id, text: "" })), mismatch: true };
  }
  let i = 0;
  return {
    translatedHeading: section.heading ? blocks[i++] : "",
    translatedParagraphs: section.paragraphs.map(p => ({ id: p.id, text: blocks[i++] })),
    mismatch: false,
  };
}

/* ─── SectionRow: one row with original | translated ─────────── */
function SectionRow({ section, index, targetLanguage, isActive, onFocus, translatingId, onTranslate }) {
  const [collapsed, setCollapsed] = useState(index !== 0);
  const HeadingTag = getTag(section.level);
  const hasTranslation = !!(section.translatedHeading || section.translatedParagraphs?.some(p => p.text));
  const isTranslating = translatingId === section.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.025 }}
      className={`rounded-[28px] border bg-white shadow-sm transition-all ${isActive ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"}`}
      onClick={onFocus}
    >
      {/* Row header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            §{index + 1}
          </span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${levelBadge(section.level)}`}>
            {section.level ? `H${section.level}` : "Block"}
          </span>
          <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
            {kindLabel(section.kind)}
          </span>
          {section.mismatch && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
              <AlertCircle className="h-3 w-3" /> Review
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTranslate(section.id); }}
            disabled={translatingId !== null}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
          >
            {isTranslating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
            {isTranslating ? "Translating…" : "Translate"}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setCollapsed(c => !c); }}
            className="rounded-xl border border-slate-200 bg-slate-50 p-1.5 text-slate-500 transition hover:bg-slate-100"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Row body: 2 columns */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 divide-slate-100 lg:grid-cols-2 lg:divide-x">
              {/* LEFT — Original */}
              <div className="space-y-3 px-5 py-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Original</p>
                {section.heading && (
                  <HeadingTag className={hClass(section.level)}>{section.heading}</HeadingTag>
                )}
                {section.paragraphs.map(p => (
                  <p key={p.id} className="text-sm leading-7 text-slate-600">{p.text}</p>
                ))}
                {section.images.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {section.images.map((img, i) => (
                      <div key={img.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <ImageIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        Image {i + 1}: {img.alt || <span className="italic text-slate-400">no alt</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* RIGHT — Translated */}
              <div className={`space-y-3 px-5 py-5 ${hasTranslation ? "bg-emerald-50/40" : "bg-slate-50/60"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${hasTranslation ? "text-emerald-600" : "text-slate-400"}`}>
                  {hasTranslation ? targetLanguage : "Translation"}
                </p>
                {isTranslating ? (
                  <div className="flex items-center gap-3 py-6 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                    Translating section…
                  </div>
                ) : hasTranslation ? (
                  <>
                    {section.translatedHeading && (
                      <HeadingTag className={`${hClass(section.level)} text-emerald-900`}>
                        {section.translatedHeading}
                      </HeadingTag>
                    )}
                    {(section.translatedParagraphs || []).map(p => (
                      <p key={p.id} className="text-sm leading-7 text-emerald-900">{p.text || "—"}</p>
                    ))}
                  </>
                ) : (
                  <div className="flex flex-col items-start gap-2 py-4 text-sm text-slate-400">
                    <Sparkles className="h-4 w-4" />
                    Click <strong className="text-slate-600">Translate</strong> to generate
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function TranslationPage() {
  const [url, setUrl] = useState("");
  const [pageMeta, setPageMeta] = useState({ title: "", description: "" });
  const [sections, setSections] = useState([]);
  const [targetLanguage, setTargetLanguage] = useState("Hindi");
  const [fetchStatus, setFetchStatus] = useState("idle"); // idle | loading | done | error
  const [message, setMessage] = useState("");
  const [translatingId, setTranslatingId] = useState(null); // section id | "all" | null
  const [activeId, setActiveId] = useState(null);
  const topRef = useRef(null);

  const hasContent = sections.length > 0;
  const translatedCount = useMemo(() => sections.filter(s => s.translatedHeading || s.translatedParagraphs?.some(p => p.text)).length, [sections]);
  const progress = hasContent ? Math.round((translatedCount / sections.length) * 100) : 0;

  /* fetch */
  const handleFetch = async () => {
    if (!url.trim()) { setMessage("Enter a URL first."); return; }
    setFetchStatus("loading"); setMessage(""); setSections([]); setPageMeta({ title: "", description: "" }); setActiveId(null);
    try {
      const res = await fetchUrlContent(url.trim());
      if (!res.success) throw new Error(res.message || "Fetch failed.");
      if (res.html) {
        const { meta, sections: parsed } = parseHtml(res.html);
        setPageMeta(meta);
        setSections(parsed.map((s, i) => ({ ...s, translatedHeading: "", translatedParagraphs: [], mismatch: false })));
        setActiveId(parsed[0]?.id ?? null);
        if (!parsed.length) setMessage("HTML fetched but no text sections detected.");
      } else {
        setSections([{ ...fallbackSection(res.text || ""), translatedHeading: "", translatedParagraphs: [], mismatch: false }]);
        setMessage("Returned as plain text — structure could not be detected.");
      }
      setFetchStatus("done");
    } catch (err) {
      setFetchStatus("error"); setMessage(err.message || "Failed to fetch.");
    }
  };

  /* translate single section */
  const handleTranslate = async (sectionId) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    const payload = buildPayload(section);
    if (!payload.trim()) return;
    setTranslatingId(sectionId);
    try {
      const res = await translateText({ source_text: payload, target_language: targetLanguage });
      const applied = applyResult(section, res.translated_text || "");
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, ...applied } : s));
      if (applied.mismatch) setMessage(`Section "${section.heading || "§"}" translation needs manual review.`);
    } catch (err) {
      setMessage(err.message || "Translation failed.");
    } finally {
      setTranslatingId(null);
    }
  };

  /* translate all */
  const handleTranslateAll = async () => {
    if (!hasContent) return;
    setTranslatingId("all");
    for (const s of sections) {
      await handleTranslate(s.id);
    }
    setTranslatingId(null);
  };

  const reset = () => {
    setUrl(""); setSections([]); setPageMeta({ title: "", description: "" });
    setMessage(""); setFetchStatus("idle"); setActiveId(null); setTranslatingId(null);
  };

  /* ─── UI ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50" ref={topRef}>
      <div className="space-y-5">

        {/* ── Top bar ── */}
        <section className="rounded-[32px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-5">
            {/* Title row */}
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-600">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-950">Translation Workspace</h1>
                <p className="text-xs text-slate-500">Fetch any page and translate section by section side-by-side</p>
              </div>
            </div>

            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* URL */}
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleFetch()}
                placeholder="https://yourstore.com/products/example"
                className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
              {/* Language */}
              <select
                value={targetLanguage}
                onChange={e => setTargetLanguage(e.target.value)}
                className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              >
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              {/* Fetch */}
              <button
                type="button" onClick={handleFetch} disabled={fetchStatus === "loading"}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {fetchStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Fetch
              </button>
              {/* Translate all */}
              {hasContent && (
                <button
                  type="button" onClick={handleTranslateAll} disabled={translatingId !== null}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
                >
                  {translatingId === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                  Translate All
                </button>
              )}
              {/* Reset */}
              <button
                type="button" onClick={reset}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* Progress bar (only when content loaded) */}
            {hasContent && (
              <div className="flex items-center gap-4">
                <div className="flex-1 overflow-hidden rounded-full bg-slate-100" style={{ height: 6 }}>
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-500">
                  {translatedCount}/{sections.length} translated · {progress}%
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ── Message ── */}
        {message && (
          <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            fetchStatus === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"
          }`}>
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {message}
          </div>
        )}

        {/* ── Page meta strip ── */}
        {hasContent && (pageMeta.title || pageMeta.description) && (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Meta</span>
              <div className="min-w-0">
                {pageMeta.title && <p className="font-semibold text-slate-900">{pageMeta.title}</p>}
                {pageMeta.description && <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">{pageMeta.description}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Column headers ── */}
        {hasContent && (
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
            <div className="flex items-center gap-2 rounded-tl-2xl rounded-tr-2xl border border-b-0 border-slate-200 bg-white px-5 py-3 lg:rounded-tr-none">
              <div className="h-2 w-2 rounded-full bg-slate-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Original Content</span>
            </div>
            <div className="flex items-center gap-2 rounded-tl-2xl rounded-tr-2xl border border-b-0 border-l-0 border-emerald-200 bg-emerald-50 px-5 py-3 lg:rounded-tl-none">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
                {targetLanguage} Translation
              </span>
            </div>
          </div>
        )}

        {/* ── Sections ── */}
        {hasContent ? (
          <div className="space-y-4">
            {sections.map((section, index) => (
              <SectionRow
                key={section.id}
                section={section}
                index={index}
                targetLanguage={targetLanguage}
                isActive={activeId === section.id}
                onFocus={() => setActiveId(section.id)}
                translatingId={translatingId}
                onTranslate={handleTranslate}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[32px] border border-dashed border-slate-300 bg-white p-14 text-center shadow-sm">
            <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
              <div className="rounded-3xl bg-slate-100 p-5 text-slate-400">
                <PanelLeft className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Fetch a page to get started</h2>
              <p className="text-sm leading-7 text-slate-400">
                Paste any URL above and hit <strong className="text-slate-600">Fetch</strong>. The page will be parsed into sections — original on the left, translation on the right.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}