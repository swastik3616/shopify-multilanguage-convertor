import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Globe, Loader2, RefreshCw, Languages,
  ChevronDown, ChevronRight, PanelLeft,
  Image as ImageIcon, AlertCircle, Edit2, Check, X, Grid3x3, Rows, Zap,
} from "lucide-react";
import { fetchUrlContent, saveOverlayEdits, fetchOverlayEdits } from "../services/translationPageService";
import { translateText } from "../services/translationService";

/* ─── Constants ──────────────────────────────────────────────── */
const LANGUAGES = ["Hindi", "Marathi", "French", "German", "Spanish", "Portuguese", "Japanese", "Arabic"];
const HEADING_TAGS = ["H1", "H2", "H3", "H4", "H5", "H6"];
// SKIP_TAGS no longer needed — backend strips header/footer/nav before sending HTML
const TEXT_TAGS = new Set(["SPAN", "LI", "LABEL", "SMALL", "STRONG", "EM", "B", "I", "TD", "TH", "CAPTION", "SUMMARY"]);
const KIND_LABELS = {
  header: "Header", nav: "Navigation", main: "Main Content",
  footer: "Footer", aside: "Sidebar", section: "Section",
  article: "Article", content: "Content",
};
const DELIMITER = "\n\n";

/* ─── Styling helpers ────────────────────────────────────────── */
function tagBadge(tag) {
  if (HEADING_TAGS.includes(tag)) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (tag === "P") return "bg-slate-100 text-slate-600 border-slate-200";
  if (tag === "BUTTON") return "bg-violet-100 text-violet-700 border-violet-200";
  if (tag === "A") return "bg-sky-100 text-sky-700 border-sky-200";
  if (tag === "IMG") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-500 border-slate-200";
}

function kindBadge(kind) {
  const m = {
    header: "bg-rose-50 text-rose-600 border-rose-200",
    nav: "bg-indigo-50 text-indigo-600 border-indigo-200",
    main: "bg-sky-50 text-sky-700 border-sky-200",
    footer: "bg-slate-100 text-slate-600 border-slate-200",
    aside: "bg-orange-50 text-orange-600 border-orange-200",
    section: "bg-violet-50 text-violet-600 border-violet-200",
    article: "bg-teal-50 text-teal-600 border-teal-200",
  };
  return m[kind] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

/* ─── Tiny helpers ───────────────────────────────────────────── */
function uid(p = "id") { return `${p}_${Math.random().toString(36).slice(2, 9)}`; }
function norm(t = "") { return t.replace(/\s+/g, " ").trim(); }

function buildElementSelector(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return "";

  const parts = [];
  let current = node;
  let depth = 0;

  while (current && current.nodeType === Node.ELEMENT_NODE && depth < 20) {
    let part = current.tagName.toLowerCase();
    const parent = current.parentElement;

    // Add nth-of-type to ensure unique identification
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(child => child.tagName === current.tagName);
      if (sameTagSiblings.length > 1) {
        part += `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`;
      }
    }

    // Try to use ID or class for better uniqueness
    if (current.id) {
      return "#" + current.id;
    }
    if (current.className && typeof current.className === 'string' && current.className.trim()) {
      const classes = current.className.split(/\s+/).filter(c => !c.startsWith('_') && c.length > 0);
      if (classes.length > 0 && classes.length < 4) {
        return "." + classes.join(".");
      }
    }

    parts.unshift(part);
    current = parent;
    depth++;
  }

  // Return path from html or body
  const result = parts.join(" > ");
  return result || "body";
}

function getTagColor(tag) {
  if (HEADING_TAGS.includes(tag)) return "bg-emerald-100 text-emerald-700";
  if (tag === "P") return "bg-slate-100 text-slate-700";
  if (tag === "BUTTON") return "bg-violet-100 text-violet-700";
  if (tag === "A") return "bg-sky-100 text-sky-700";
  if (tag === "IMG") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function getTruncated(text, length = 100) {
  if (!text) return "";
  return text.length > length ? text.substring(0, length) + "..." : text;
}

function TranslationGridRow({ item, translatingId, onTranslateItem, onEditOriginal, onEditTranslation }) {
  const [editingSource, setEditingSource] = useState(false);
  const [editingTranslation, setEditingTranslation] = useState(false);
  const [sourceValue, setSourceValue] = useState(item.text || "");
  const [translationValue, setTranslationValue] = useState(item.translatedText || "");

  const openSourceEditor = () => {
    setSourceValue(item.text || "");
    setEditingSource(true);
  };

  const openTranslationEditor = () => {
    setTranslationValue(item.translatedText || "");
    setEditingTranslation(true);
  };

  return (
    <tr key={item.id} className="divide-x divide-slate-200 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${getTagColor(item.tag || "P")}`}>
          {item.tag || "P"}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 font-mono">{item.sectionLabel || item.sectionId}</td>
      <td className="px-4 py-3">
        {editingSource ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              className="input-field w-full text-sm"
              value={sourceValue}
              onChange={e => setSourceValue(e.target.value)}
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setSourceValue(item.text || ""); setEditingSource(false); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => { onEditOriginal(item.sectionId, item.id, sourceValue, true); setEditingSource(false); }}
                className="rounded-lg bg-slate-900 p-1.5 text-white hover:bg-slate-800 transition"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-slate-700 break-words" title={item.text}>{getTruncated(item.text, 90)}</div>
            <button
              type="button"
              onClick={openSourceEditor}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Edit source"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {editingTranslation ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              className="input-field w-full text-sm"
              value={translationValue}
              onChange={e => setTranslationValue(e.target.value)}
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setTranslationValue(item.translatedText || ""); setEditingTranslation(false); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => { onEditTranslation(item.sectionId, item.id, translationValue, false); setEditingTranslation(false); }}
                className="rounded-lg bg-emerald-100 p-1.5 text-emerald-700 hover:bg-emerald-200 transition"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : item.translatedText ? (
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-slate-800 break-words" title={item.translatedText}>{getTruncated(item.translatedText, 90)}</div>
            <button
              type="button"
              onClick={openTranslationEditor}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Edit translation"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400 italic">Not translated</span>
            <button
              type="button"
              onClick={openTranslationEditor}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Add translation"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onTranslateItem(item.sectionId)}
          disabled={translatingId === item.sectionId}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-1.5 text-white text-xs font-semibold transition hover:bg-slate-800 disabled:opacity-50"
        >
          {translatingId === item.sectionId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
        </button>
      </td>
    </tr>
  );
}

function TranslationGrid({ items, targetLanguage, translatingId, onTranslateItem, onEditOriginal, onEditTranslation }) {
  if (!items || !items.length) {
    return (
      <div className="text-center py-12 text-slate-500">
        No content items to display
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
          <tr className="divide-x divide-slate-200">
            <th className="px-4 py-3 text-left font-semibold text-slate-700 w-20">Tag</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700 w-32">Section</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-[22rem]">Source Text</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-[22rem]">{targetLanguage}</th>
            <th className="px-4 py-3 text-center font-semibold text-slate-700 w-32">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map(item => (
            <TranslationGridRow
              key={item.id}
              item={item}
              translatingId={translatingId}
              onTranslateItem={onTranslateItem}
              onEditOriginal={onEditOriginal}
              onEditTranslation={onEditTranslation}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
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

  const startSec = (kind = "content") => {
    cur = { id: uid("sec"), kind, label: KIND_LABELS[kind] || "Content", elements: [], mismatch: false };
    sections.push(cur);
    return cur;
  };

  const addEl = (tag, text, node = null) => {
    if (!cur) startSec("content");
    const t = (text || "").replace(/\s+/g, " ").trim();
    if (!t && tag !== "IMG") return;
    // Deduplicate within the same section
    if (cur.elements.some(e => e.tag === tag && e.text === t)) return;
    cur.elements.push({
      id: uid("el"),
      tag,
      text: t,
      originalText: t,
      translatable: true,
      translatedText: "",
      selector: buildElementSelector(node) || null,
    });
  };

  // Start with a single content section
  startSec("content");

  // Walk every element — backend already stripped header/footer/nav
  const walker = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;

  // Track all text seen globally to deduplicate identical strings across
  // product cards — one saved edit for "Product title" should not create
  // 16 identical rows in the workspace.
  const seenTexts = new Set();

  while (node) {
    const tag = node.tagName;

    // Skip non-content tags
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG"].includes(tag)) {
      node = walker.nextNode();
      continue;
    }

    // Only capture leaf-ish elements (no block children) to avoid capturing
    // a parent whose textContent is just the concatenation of its children.
    const isLeaf = !([...node.children].some(c =>
      ["DIV", "SECTION", "ARTICLE", "MAIN", "UL", "OL", "TABLE"].includes(c.tagName)
    ));

    const captureText = (resolvedTag) => {
      const t = norm(node.textContent || "");
      // Skip empty, too short (<2 chars), or very long strings (>300 = likely
      // a concatenated block, not a translatable phrase).
      if (!t || t.length < 2 || t.length > 300) return;
      // Global dedup: same exact text already captured somewhere on the page
      if (seenTexts.has(t)) return;
      seenTexts.add(t);
      addEl(resolvedTag, t, node);
    };

    if (HEADING_TAGS.includes(tag) && isLeaf) {
      const t = norm(node.textContent || "");
      if (t.length > 0) { startSec("content"); captureText(tag); }
    }
    else if (tag === "P" && isLeaf) { captureText("P"); }
    else if (tag === "BUTTON" && isLeaf) { captureText("BUTTON"); }
    else if (tag === "A" && isLeaf) { captureText("A"); }
    else if (tag === "LABEL" && isLeaf) { captureText("LABEL"); }
    else if (tag === "SPAN" && isLeaf) {
      // Only capture short spans — prices, badges, labels (not full paragraphs)
      const t = norm(node.textContent || "");
      if (t.length >= 2 && t.length <= 150) { captureText("SPAN"); }
    }
    else if (tag === "IMG") {
      const alt = norm(node.getAttribute("alt") || "");
      if (alt.length > 0) addEl("IMG", alt, node);
    }

    node = walker.nextNode();
  }

  return { meta, sections: sections.filter(s => s.elements.length > 0) };
}

function fallbackSection(text) {
  return {
    id: uid("sec"), kind: "content", label: "Imported Content", mismatch: false,
    elements: text.split(/\n{2,}/).map(t => t.trim()).filter(Boolean)
      .map(t => ({ id: uid("el"), tag: "P", text: t, originalText: t, translatable: true, translatedText: "" })),
  };
}

/* ─── Translation helpers ────────────────────────────────────── */
function buildPayload(section) {
  return section.elements.filter(e => e.translatable && e.text).map(e => e.text).join(DELIMITER);
}

function applyResult(section, joined) {
  const translatables = section.elements.filter(e => e.translatable && e.text);
  const blocks = joined.split(DELIMITER).map(b => b.trim()).filter(Boolean);
  const mismatch = blocks.length !== translatables.length;
  let i = 0;
  const elements = section.elements.map(el => {
    if (el.translatable && el.text) return { ...el, translatedText: blocks[i++] || "" };
    return el;
  });
  return { elements, mismatch };
}

/* ─── ElementContent ─────────────────────────────────────────── */
function ElementContent({ tag, text, translated = false }) {
  const base = translated ? "text-emerald-900" : "text-slate-800";

  if (HEADING_TAGS.includes(tag)) {
    const sz = {
      H1: "text-xl font-bold", H2: "text-lg font-bold", H3: "text-base font-semibold",
      H4: "text-sm font-semibold", H5: "text-sm font-medium", H6: "text-xs font-medium"
    };
    return <span className={`${sz[tag] || "text-sm font-semibold"} ${base} leading-snug`}>{text}</span>;
  }
  if (tag === "P")
    return <p className={`text-sm leading-7 ${base}`}>{text}</p>;

  if (tag === "BUTTON")
    return (
      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${translated ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-slate-300 bg-slate-50 text-slate-700"}`}>
        {text}
      </span>
    );

  if (tag === "A")
    return (
      <span className={`text-sm underline decoration-dotted underline-offset-2 ${translated ? "text-emerald-700" : "text-sky-700"}`}>
        {text}
      </span>
    );

  if (tag === "IMG")
    return (
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${translated ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"}`}>
        <ImageIcon className="h-3.5 w-3.5 shrink-0" />
        {text ? <span>{text}</span> : <span className="italic opacity-50">no alt text</span>}
      </div>
    );

  return <span className={`text-sm ${base}`}>{text}</span>;
}

/* ─── ElementRow ─────────────────────────────────────────────── */
function ElementRow({ element, isTranslating, onEdit, onEditOriginal }) {
  const [isEditingT, setIsEditingT] = useState(false);
  const [editedTextT, setEditedTextT] = useState(element.translatedText || "");

  const [isEditingO, setIsEditingO] = useState(false);
  const [editedTextO, setEditedTextO] = useState(element.text || "");

  const hasT = !!element.translatedText;

  const handleSaveT = () => {
    if (onEdit) onEdit(editedTextT);
    setIsEditingT(false);
  };

  const handleSaveO = () => {
    if (onEditOriginal) onEditOriginal(editedTextO);
    setIsEditingO(false);
  };

  return (
    <div className="grid grid-cols-1 border-b border-slate-50 last:border-b-0 lg:grid-cols-2 lg:divide-x lg:divide-slate-100">
      {/* Original */}
      <div className={`group flex items-start gap-3 px-5 py-4 bg-white`}>
        <span className={`mt-0.5 shrink-0 rounded border font-mono text-[9px] font-bold px-1.5 py-0.5 ${tagBadge(element.tag)}`}>
          {element.tag}
        </span>
        <div className="min-w-0 flex-1 relative">
          {isEditingO ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editedTextO}
                onChange={e => setEditedTextO(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setIsEditingO(false); setEditedTextO(element.text || ""); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                  <X className="h-4 w-4" />
                </button>
                <button onClick={handleSaveO} className="rounded-lg bg-slate-100 p-1.5 text-slate-700 hover:bg-slate-200 transition">
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <ElementContent tag={element.tag} text={element.text} />
              </div>
              <button
                onClick={() => setIsEditingO(true)}
                className="shrink-0 opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition"
                title="Edit original text"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Translated */}
      <div className={`group flex items-start gap-3 px-5 py-4 ${hasT ? "bg-emerald-50/30" : "bg-slate-50/40"}`}>
        <span className={`mt-0.5 shrink-0 rounded border font-mono text-[9px] font-bold px-1.5 py-0.5 ${tagBadge(element.tag)}`}>
          {element.tag}
        </span>
        <div className="min-w-0 flex-1 relative">
          {isTranslating ? (
            <div className="flex items-center gap-2 pt-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              <span className="text-xs text-slate-400">translating…</span>
            </div>
          ) : isEditingT ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editedTextT}
                onChange={e => setEditedTextT(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setIsEditingT(false); setEditedTextT(element.translatedText || ""); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                  <X className="h-4 w-4" />
                </button>
                <button onClick={handleSaveT} className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600 hover:bg-emerald-200 transition">
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {hasT ? (
                  <ElementContent tag={element.tag} text={element.translatedText} translated />
                ) : (
                  <span className="text-sm italic text-slate-300">—</span>
                )}
              </div>
              <button
                onClick={() => setIsEditingT(true)}
                className="shrink-0 opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-100 transition"
                title="Edit translation"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── SectionRow ─────────────────────────────────────────────── */
function SectionRow({ section, index, targetLanguage, isActive, onFocus, translatingId, onTranslate, onEditElement }) {
  const [collapsed, setCollapsed] = useState(index !== 0);
  const hasTranslation = section.elements.some(e => e.translatedText);
  const isTranslating = translatingId === section.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.025 }}
      className={`overflow-hidden rounded-[24px] border bg-white shadow-sm transition-all ${isActive ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"}`}
      onClick={onFocus}
    >
      {/* Section header bar */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            §{index + 1}
          </span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${kindBadge(section.kind)}`}>
            {section.label}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-500">
            {section.elements.length} element{section.elements.length !== 1 ? "s" : ""}
          </span>
          {section.mismatch && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
              <AlertCircle className="h-3 w-3" /> Review
            </span>
          )}
          {hasTranslation && !isTranslating && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              ✓ Translated
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onTranslate(section.id); }}
            disabled={translatingId !== null}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
          >
            {isTranslating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
            {isTranslating ? "Translating…" : "Translate"}
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setCollapsed(c => !c); }}
            className="rounded-xl border border-slate-200 bg-slate-50 p-1.5 text-slate-500 transition hover:bg-slate-100"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Column headers */}
      {!collapsed && (
        <div className="grid grid-cols-1 border-b border-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-slate-100">
          <div className="flex items-center gap-2 bg-slate-50/60 px-5 py-2">
            <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Original</span>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50/50 px-5 py-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">{targetLanguage}</span>
          </div>
        </div>
      )}

      {/* Element rows */}
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
            {section.elements.map(el => (
              <ElementRow
                key={`${el.id}-${el.text || ""}-${el.translatedText || ""}`}
                element={el}
                isTranslating={isTranslating}
                onEdit={(newText) => onEditElement(section.id, el.id, newText, false)}
                onEditOriginal={(newText) => onEditElement(section.id, el.id, newText, true)}
              />
            ))}
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
  const [targetLang, setTargetLang] = useState("Hindi");
  const [fetchStatus, setFetchStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [translatingId, setTranslatingId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "panel"
  const topRef = useRef(null);

  const hasContent = sections.length > 0;
  const totalEls = useMemo(() => sections.reduce((a, s) => a + s.elements.length, 0), [sections]);
  const doneEls = useMemo(() => sections.reduce((a, s) => a + s.elements.filter(e => e.translatedText).length, 0), [sections]);
  const progress = totalEls ? Math.round((doneEls / totalEls) * 100) : 0;

  /* ── Normalize a URL the same way handleSaveToWebsite does ── */
  const normalizeUrl = (raw) => {
    try {
      let u = raw.trim();
      if (!u.startsWith("http")) u = "https://" + u;
      const parsed = new URL(u);
      return (parsed.origin + parsed.pathname).replace(/\/$/, "");
    } catch {
      return raw.trim();
    }
  };

  /* ── Fetch ── */
  const handleFetch = async () => {
    if (!url.trim()) { setMessage("Enter a URL first."); return; }
    setFetchStatus("loading"); setMessage(""); setSections([]); setPageMeta({ title: "", description: "" }); setActiveId(null);

    // Normalize URL once — same format used when saving edits
    const fetchUrl = normalizeUrl(url.trim());

    try {
      // Fetch HTML and saved edits in parallel using the same normalized URL
      const [res, savedEdits] = await Promise.all([
        fetchUrlContent(fetchUrl),
        fetchOverlayEdits(fetchUrl, targetLang).catch(() => ({ base: {}, translations: {} })),
      ]);

      if (!res.success) throw new Error(res.message || "Fetch failed.");

      if (res.html) {
        const { meta, sections: parsed } = parseHtml(res.html);
        setPageMeta(meta);

        // Merge saved overlay edits back into parsed elements.
        // Matching is done case-insensitively and whitespace-normalised
        // so minor scraping differences don't break the lookup.
        const baseEntries = Object.entries(savedEdits?.base || {});
        const transEntries = Object.entries(savedEdits?.translations || {});

        const findSavedNew = (elText, entries) => {
          if (!elText) return null;
          const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
          const normEl = norm(elText);
          for (const [orig, newVal] of entries) {
            if (norm(orig) === normEl) return newVal;
          }
          return null;
        };

        const merged = (baseEntries.length > 0 || transEntries.length > 0)
          ? parsed.map(sec => ({
            ...sec,
            elements: sec.elements.map(el => {
              const savedBase = findSavedNew(el.text, baseEntries);
              const savedTrans = findSavedNew(el.text, transEntries);

              let updatedEl = { ...el };
              if (savedBase) {
                // Keep originalText as the real Shopify text so future
                // saves still reference the correct original_text in DB
                updatedEl.text = savedBase;
                updatedEl.originalText = el.text;
              }
              if (savedTrans) {
                updatedEl.translatedText = savedTrans;
              }
              return updatedEl;
            }),
          }))
          : parsed;

        setSections(merged);
        setActiveId(merged[0]?.id ?? null);
        if (!merged.length) setMessage("HTML fetched but no content sections detected.");
      } else {
        setSections([fallbackSection(res.text || "")]);
        setMessage("Returned as plain text — structure could not be detected.");
      }
      setFetchStatus("done");
    } catch (err) {
      setFetchStatus("error"); setMessage(err.message || "Failed to fetch.");
    }
  };

  /* ── Translate single section ── */
  const handleTranslate = async (sectionId) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    const payload = buildPayload(section);
    if (!payload.trim()) return;
    setTranslatingId(sectionId);
    try {
      const res = await translateText({ source_text: payload, target_language: targetLang });
      const { elements, mismatch } = applyResult(section, res.translated_text || "");
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, elements, mismatch } : s));
      if (mismatch) setMessage(`Section "${section.label}" — translation count mismatch, please review.`);
    } catch (err) {
      setMessage(err.message || "Translation failed.");
    } finally {
      setTranslatingId(null);
    }
  };

  /* ── Translate all ── */
  const handleTranslateAll = async () => {
    if (!hasContent) return;
    setTranslatingId("all");
    for (const s of sections) await handleTranslate(s.id);
    setTranslatingId(null);
  };

  const handleEditElement = (sectionId, elementId, newText, isOriginal = false) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        elements: s.elements.map(e => {
          if (e.id !== elementId) return e;
          return isOriginal
            ? { ...e, text: newText }
            : { ...e, translatedText: newText };
        })
      };
    }));
  };

  const handleSaveToWebsite = async () => {
    if (!url.trim()) return;
    setIsSavingEdits(true);

    let normalizedUrl = url.trim();
    try {
      if (!normalizedUrl.startsWith("http")) normalizedUrl = "https://" + normalizedUrl;
      const u = new URL(normalizedUrl);
      normalizedUrl = (u.origin + u.pathname).replace(/\/$/, "");
    } catch (error) {
      console.warn("Failed to normalize URL", error);
    }

    const edits = [];
    sections.forEach(s => {
      s.elements.forEach(e => {
        const orig = e.originalText || e.text;
        const selector = e.selector || null;
        const elementTag = e.tag || null;
        if (e.originalText && e.text !== e.originalText) {
          edits.push({
            original_text: e.originalText,
            new_text: e.text,
            is_translation: false,
            target_language: null,
            selector,
            element_tag: elementTag,
            field_name: e.tag || null,
          });
        }
        if (e.translatedText) {
          edits.push({
            original_text: orig,
            new_text: e.translatedText,
            is_translation: true,
            target_language: targetLang,
            selector,
            element_tag: elementTag,
            field_name: e.tag || null,
          });
        }
      });
    });

    try {
      const res = await saveOverlayEdits(normalizedUrl, edits);
      if (res.success) {
        setMessage("Saved successfully to live website overlay!");
      } else {
        setMessage("Failed to save: " + res.message);
      }
    } catch (err) {
      setMessage("Failed to save: " + err.message);
    }
    setIsSavingEdits(false);
  };

  const reset = () => {
    setUrl(""); setSections([]); setPageMeta({ title: "", description: "" });
    setMessage(""); setFetchStatus("idle"); setActiveId(null); setTranslatingId(null);
  };

  /* ── UI ── */
  return (
    <div className="min-h-screen bg-slate-50" ref={topRef}>
      <div className="space-y-5">

        {/* Top bar */}
        <section className="rounded-[32px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-600">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-950">Translation Workspace</h1>
                <p className="text-xs text-slate-500">Fetch any page — see every element by type, translate section by section</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                value={url} onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleFetch()}
                placeholder="https://yourstore.com/products/example"
                className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
              <select
                value={targetLang} onChange={e => setTargetLang(e.target.value)}
                className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              >
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <button
                type="button" onClick={handleFetch} disabled={fetchStatus === "loading"}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {fetchStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Fetch
              </button>
              {hasContent && (
                <button
                  type="button" onClick={handleTranslateAll} disabled={translatingId !== null}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
                >
                  {translatingId === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                  Translate All
                </button>
              )}
              {hasContent && (
                <button
                  type="button" onClick={handleSaveToWebsite} disabled={isSavingEdits}
                  className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSavingEdits ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save to Website
                </button>
              )}
              <button
                type="button" onClick={reset}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* Progress */}
            {hasContent && (
              <div className="flex items-center gap-4">
                <div className="flex-1 overflow-hidden rounded-full bg-slate-100" style={{ height: 6 }}>
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-500">
                  {doneEls}/{totalEls} elements · {progress}%
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Message */}
        {message && (
          <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${fetchStatus === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {message}
          </div>
        )}

        {/* Page meta */}
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

        {/* Sections */}
        {hasContent ? (
          <div className="space-y-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-white border border-slate-200">
              <span className="text-sm font-medium text-slate-600">View:</span>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${viewMode === "grid"
                    ? "bg-[#008060] text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
              >
                <Grid3x3 className="h-4 w-4" />
                <span className="text-sm font-medium">Grid Table</span>
              </button>
              <button
                onClick={() => setViewMode("panel")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${viewMode === "panel"
                    ? "bg-[#008060] text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
              >
                <Rows className="h-4 w-4" />
                <span className="text-sm font-medium">Panel View</span>
              </button>
              <span className="text-xs text-slate-500 ml-auto">
                {sections.reduce((sum, s) => sum + s.elements.length, 0)} items
              </span>
            </div>

            {/* Grid View */}
            {viewMode === "grid" ? (
              <TranslationGrid
                items={sections.reduce((all, section) => [...all, ...section.elements.map(el => ({ ...el, sectionId: section.id, sectionLabel: section.label }))], [])}
                targetLanguage={targetLang}
                translatingId={translatingId}
                onTranslateItem={handleTranslate}
                onEditOriginal={handleEditElement}
                onEditTranslation={handleEditElement}
              />
            ) : (
              /* Panel View */
              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 items-start">
                {sections.map((section, index) => (
                  <SectionRow
                    key={section.id}
                    section={section}
                    index={index}
                    targetLanguage={targetLang}
                    isActive={activeId === section.id}
                    onFocus={() => setActiveId(section.id)}
                    translatingId={translatingId}
                    onTranslate={handleTranslate}
                    onEditElement={handleEditElement}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[32px] border border-dashed border-slate-300 bg-white p-14 text-center shadow-sm">
            <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
              <div className="rounded-3xl bg-slate-100 p-5 text-slate-400">
                <PanelLeft className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Fetch a page to get started</h2>
              <p className="text-sm leading-7 text-slate-400">
                Paste any URL above and hit <strong className="text-slate-600">Fetch</strong>. The page will be parsed into sections — each element shown by its tag type, with original on the left and translation on the right.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}