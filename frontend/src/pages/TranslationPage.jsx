import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Languages,
  Loader2,
  RefreshCw,
  Globe,
  Save,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { fetchUrlContent } from "../services/translationPageService";
import { translateText } from "../services/translationService";
import { importContentToLibrary } from "../services/contentService";

const LANGUAGES = ["Hindi", "Marathi", "French", "German", "Spanish", "Portuguese"];
const PAGE_OPTIONS = ["home", "product", "collection", "checkout", "other"];
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

// Delimiter used to bundle a section's heading + paragraphs into one string
// for translation, then split the translated result back into the same
// blocks. Double newline is generally preserved by translation APIs.
const TRANSLATION_DELIMITER = "\n\n";

const HEADING_TAGS = ["H1", "H2", "H3", "H4", "H5", "H6"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

const emptyMeta = { title: "", description: "", translatedTitle: "", translatedDescription: "" };

function generateId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function suggestKeyFromUrl(urlString) {
  try {
    const normalized = urlString.startsWith("http") ? urlString : `https://${urlString}`;
    const parsed = new URL(normalized);
    const slug = parsed.pathname
      .replace(/^\/+|\/+$/g, "")
      .replace(/\//g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    return slug || "homepage";
  } catch {
    return "imported_content";
  }
}

function suggestPageFromUrl(urlString) {
  const lower = urlString.toLowerCase();
  if (lower.includes("/products/")) return "product";
  if (lower.includes("/collections/")) return "collection";
  if (lower.includes("/checkout")) return "checkout";
  if (lower.includes("/pages/")) return "home";
  return "other";
}

function levelLabel(level) {
  return level ? `H${level}` : "Untitled section";
}

function levelBadgeClasses(level) {
  if (level === 1) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (level === 2) return "bg-sky-50 text-sky-700 border-sky-200";
  if (level >= 3) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

/**
 * Parses raw page HTML into page-level SEO meta + an array of sections
 * grouped by heading hierarchy (H1 -> H2 -> H3 ...), instead of one flat
 * blob of text. Requires fetchUrlContent to return a `html` field -- see
 * the fallback in handleFetchUrl below for when it only returns `text`.
 */
function parseHtmlToSections(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const descriptionTag = doc.querySelector('meta[name="description"]');
  const meta = {
    title: doc.title?.trim() || "",
    description: descriptionTag?.getAttribute("content")?.trim() || "",
  };

  const root = doc.querySelector("main") || doc.body;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

  const sections = [];
  let current = null;

  const startSection = (level, headingText) => {
    current = {
      id: generateId("sec"),
      level,
      heading: headingText,
      paragraphs: [],
      images: [],
      translatedHeading: "",
      translatedParagraphs: [],
      collapsed: false,
    };
    sections.push(current);
  };

  // Anything before the first real heading lands in an implicit intro
  // section (level 0). It's dropped below if it ends up empty.
  startSection(0, "");

  let node = walker.currentNode;
  while (node) {
    if (!SKIP_TAGS.has(node.tagName)) {
      if (HEADING_TAGS.includes(node.tagName)) {
        const text = node.textContent.trim();
        if (text) startSection(Number(node.tagName[1]), text);
      } else if (node.tagName === "P") {
        const text = node.textContent.trim();
        if (text.length > 1) {
          current.paragraphs.push({ id: generateId("p"), text });
        }
      } else if (node.tagName === "IMG") {
        const alt = node.getAttribute("alt");
        // Only surface images that had an alt attribute at all -- this
        // filters out most decorative icons/sprites that never had one.
        if (alt !== null) {
          current.images.push({ id: generateId("img"), alt: alt.trim() });
        }
      }
    }
    node = walker.nextNode();
  }

  const cleaned = sections.filter((s) => s.heading || s.paragraphs.length || s.images.length);

  return { meta, sections: cleaned };
}

function makeFallbackSection(plainText) {
  return {
    id: generateId("sec"),
    level: 0,
    heading: "",
    paragraphs: plainText
      .split(/\n{2,}/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({ id: generateId("p"), text })),
    images: [],
    translatedHeading: "",
    translatedParagraphs: [],
    collapsed: false,
  };
}

function buildSectionTranslationPayload(section) {
  const blocks = [];
  if (section.heading) blocks.push(section.heading);
  section.paragraphs.forEach((p) => blocks.push(p.text));
  return blocks.join(TRANSLATION_DELIMITER);
}

/**
 * Splits a translated string back into heading/paragraphs for one section.
 * If the translation didn't preserve the same number of blocks, this
 * degrades gracefully (heading gets everything, paragraphs stay empty) and
 * flags `mismatch: true` so the UI can ask for a manual check.
 */
function applyTranslatedSection(section, translatedJoined) {
  const blocks = translatedJoined
    .split(TRANSLATION_DELIMITER)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const expectedCount = (section.heading ? 1 : 0) + section.paragraphs.length;

  if (blocks.length !== expectedCount) {
    return {
      translatedHeading: section.heading ? translatedJoined.trim() : "",
      translatedParagraphs: section.paragraphs.map((p) => ({ id: p.id, text: "" })),
      mismatch: true,
    };
  }

  let i = 0;
  const translatedHeading = section.heading ? blocks[i++] : "";
  const translatedParagraphs = section.paragraphs.map((p) => ({ id: p.id, text: blocks[i++] }));

  return { translatedHeading, translatedParagraphs, mismatch: false };
}

// Flattens sections back to plain text -- a backward-compatible fallback for
// saving, in case importContentToLibrary doesn't yet store structured
// `sections` JSON.
function sectionsToFlatText(sections) {
  return sections
    .map((s) => [s.heading, ...s.paragraphs.map((p) => p.text)].filter(Boolean).join("\n\n"))
    .filter(Boolean)
    .join("\n\n\n");
}

function translatedSectionsToFlatText(sections) {
  return sections
    .map((s) =>
      [s.translatedHeading, ...s.translatedParagraphs.map((p) => p.text)].filter(Boolean).join("\n\n")
    )
    .filter(Boolean)
    .join("\n\n\n");
}

function TranslationPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [pageMeta, setPageMeta] = useState(emptyMeta);
  const [sections, setSections] = useState([]);
  const [isStructured, setIsStructured] = useState(true);
  const [targetLanguage, setTargetLanguage] = useState(LANGUAGES[0]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [translatingId, setTranslatingId] = useState(null); // section id, "meta", or "all"

  const [savePage, setSavePage] = useState("other");
  const [contentKey, setContentKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedContentId, setSavedContentId] = useState(null);

  const hasContent = sections.length > 0;

  const handleFetchUrl = async () => {
    if (!url.trim()) {
      setMessageType("error");
      setMessage("Enter a valid URL to fetch content.");
      return;
    }

    setStatus("loading");
    setMessage("");
    setSavedContentId(null);

    try {
      const result = await fetchUrlContent(url.trim());
      if (!result.success) {
        throw new Error(result.message || "Unable to fetch content.");
      }

      if (result.html) {
        const { meta, sections: parsedSections } = parseHtmlToSections(result.html);
        setPageMeta({ ...emptyMeta, title: meta.title, description: meta.description });
        setSections(parsedSections);
        setIsStructured(true);
      } else {
        // Backend hasn't been updated to return raw HTML yet -- degrade to
        // a single editable block instead of breaking entirely.
        setPageMeta(emptyMeta);
        setSections([makeFallbackSection(result.text || "")]);
        setIsStructured(false);
        setMessageType("error");
        setMessage(
          "This content came back as plain text, so headings couldn't be detected. Ask your backend to also return raw HTML (a `html` field) from fetchUrlContent for section-based editing."
        );
      }

      setContentKey(suggestKeyFromUrl(url.trim()));
      setSavePage(suggestPageFromUrl(url.trim()));
      setStatus("loaded");
    } catch (error) {
      setStatus("error");
      setMessageType("error");
      setMessage(error.message || "Failed to load URL content.");
    }
  };

  const updateSectionHeading = (id, value) =>
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, heading: value } : s)));

  const updateSectionParagraph = (sectionId, paragraphId, value) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, paragraphs: s.paragraphs.map((p) => (p.id === paragraphId ? { ...p, text: value } : p)) }
          : s
      )
    );

  const updateTranslatedHeading = (id, value) =>
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, translatedHeading: value } : s)));

  const updateTranslatedParagraph = (sectionId, paragraphId, value) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              translatedParagraphs: s.translatedParagraphs.map((p) =>
                p.id === paragraphId ? { ...p, text: value } : p
              ),
            }
          : s
      )
    );

  const updateImageAlt = (sectionId, imageId, value) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, images: s.images.map((img) => (img.id === imageId ? { ...img, alt: value } : img)) }
          : s
      )
    );

  const toggleCollapse = (id) =>
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s)));

  const removeSection = (id) => setSections((prev) => prev.filter((s) => s.id !== id));

  const handleTranslateSection = async (sectionId) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    const payload = buildSectionTranslationPayload(section);
    if (!payload.trim()) return;

    setTranslatingId(sectionId);
    try {
      const result = await translateText({ source_text: payload, target_language: targetLanguage });
      const { translatedHeading, translatedParagraphs, mismatch } = applyTranslatedSection(
        section,
        result.translated_text || ""
      );

      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, translatedHeading, translatedParagraphs } : s))
      );

      if (mismatch) {
        setMessageType("error");
        setMessage(
          `The translation for "${section.heading || "this section"}" didn't map cleanly back to its paragraphs -- please review it manually below.`
        );
      }
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Translation failed for this section.");
    } finally {
      setTranslatingId(null);
    }
  };

  const handleTranslateMeta = async () => {
    if (!pageMeta.title && !pageMeta.description) return;

    setTranslatingId("meta");
    try {
      const payload = [pageMeta.title, pageMeta.description].filter(Boolean).join(TRANSLATION_DELIMITER);
      const result = await translateText({ source_text: payload, target_language: targetLanguage });
      const blocks = (result.translated_text || "").split(TRANSLATION_DELIMITER).map((b) => b.trim());

      setPageMeta((prev) => ({
        ...prev,
        translatedTitle: prev.title ? blocks[0] || "" : "",
        translatedDescription: prev.description ? blocks[prev.title ? 1 : 0] || "" : "",
      }));
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to translate page SEO fields.");
    } finally {
      setTranslatingId(null);
    }
  };

  const handleTranslateAll = async () => {
    if (!hasContent) {
      setMessageType("error");
      setMessage("Fetch content before translating.");
      return;
    }

    setTranslatingId("all");
    setStatus("translating");
    try {
      await handleTranslateMeta();
      for (const section of sections) {
        await handleTranslateSection(section.id);
      }
      setStatus("translated");
    } finally {
      setTranslatingId(null);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!hasContent) {
      setMessageType("error");
      setMessage("Fetch content before saving to Translations.");
      return;
    }

    if (!contentKey.trim()) {
      setMessageType("error");
      setMessage("Enter a content key before saving.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const hasTranslation = sections.some(
      (s) => s.translatedHeading || s.translatedParagraphs.some((p) => p.text)
    );

    try {
      const result = await importContentToLibrary({
        page: savePage,
        key: contentKey.trim(),
        source_url: url.trim(),
        // Structured payload -- requires importContentToLibrary / its backend
        // to accept and persist `meta` + `sections` (JSON) so this content
        // can be reopened later as the same section-based editor.
        meta: pageMeta,
        sections,
        // Flattened fallbacks so saving still works even before the backend
        // is updated to store the structured fields above.
        source_text: sectionsToFlatText(sections),
        target_language: hasTranslation ? targetLanguage : "",
        translated_text: hasTranslation ? translatedSectionsToFlatText(sections) : "",
      });

      if (!result.success) {
        throw new Error(result.message || "Failed to save content.");
      }

      setSavedContentId(result.content?.id ?? null);
      setMessageType("success");
      setMessage(result.message + (result.translation_saved ? " Translation included." : ""));
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to save to Translations library.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetAll = () => {
    setUrl("");
    setPageMeta(emptyMeta);
    setSections([]);
    setIsStructured(true);
    setMessage("");
    setStatus("idle");
    setSavePage("other");
    setContentKey("");
    setSavedContentId(null);
  };

  return (
    <div className="space-y-10">
      <section className="rounded-[32px] border border-slate-200/40 bg-slate-950/95 p-8 shadow-2xl shadow-slate-900/20 backdrop-blur-xl">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr] items-center">
          <div className="space-y-4 text-white">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.35em] text-emerald-200">
              <Globe className="h-4 w-4" /> live translation
            </span>
            <h1 className="text-4xl font-semibold leading-tight">Fetch, translate, and save website content -- section by section.</h1>
            <p className="max-w-2xl text-slate-300 leading-8">
              Pull copy from any URL, see it broken into headings and paragraphs just like the page itself, translate each piece, then save it to Translations.
            </p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/20">
            <div className="space-y-4">
              <div className="rounded-3xl bg-slate-950/80 p-4 text-sm text-slate-300">
                <p className="uppercase tracking-[0.2em] text-slate-500">Current status</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {status === "idle"
                    ? "Ready to translate"
                    : status === "loading"
                      ? "Fetching content"
                      : status === "loaded"
                        ? `Content loaded -- ${sections.length} section${sections.length === 1 ? "" : "s"}`
                        : status === "translating"
                          ? "Translating"
                          : status === "translated"
                            ? "Translation ready"
                            : "Error"}
                </p>
              </div>
              <div className="rounded-3xl bg-slate-950/80 p-4 text-sm text-slate-300">
                <p className="uppercase tracking-[0.2em] text-slate-500">Target language</p>
                <p className="mt-2 text-lg font-semibold text-white">{targetLanguage}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <motion.article
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-[32px] border border-slate-200/40 bg-white/90 p-7 shadow-xl shadow-slate-900/10 backdrop-blur"
      >
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Source URL</h2>
            <p className="mt-1 text-sm text-slate-500">Enter a page URL to fetch and break it into editable sections.</p>
          </div>
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <RefreshCw className="h-4 w-4" /> Reset
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourstore.com/products/example"
            className="rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#008060] focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="button"
            onClick={handleFetchUrl}
            className="inline-flex items-center justify-center gap-2 rounded-3xl bg-[#008060] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-600"
          >
            {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Fetch content
          </button>
        </div>
      </motion.article>

      {hasContent && (
        <>
          <motion.article
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-slate-200/40 bg-white/90 p-7 shadow-xl shadow-slate-900/10 backdrop-blur"
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Page SEO</h2>
                <p className="mt-1 text-sm text-slate-500">Meta title and description -- these matter for search results, so keep an eye on length.</p>
              </div>
              <button
                type="button"
                onClick={handleTranslateMeta}
                disabled={translatingId === "meta"}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                {translatingId === "meta" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                Translate SEO fields
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Meta title</label>
                <input
                  type="text"
                  className="input-field"
                  value={pageMeta.title}
                  onChange={(e) => setPageMeta((p) => ({ ...p, title: e.target.value }))}
                />
                <p className={`mt-1 text-xs ${pageMeta.title.length > TITLE_LIMIT ? "text-rose-600" : "text-slate-400"}`}>
                  {pageMeta.title.length} / {TITLE_LIMIT} characters
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Meta description</label>
                <textarea
                  className="input-field min-h-[70px]"
                  value={pageMeta.description}
                  onChange={(e) => setPageMeta((p) => ({ ...p, description: e.target.value }))}
                />
                <p className={`mt-1 text-xs ${pageMeta.description.length > DESCRIPTION_LIMIT ? "text-rose-600" : "text-slate-400"}`}>
                  {pageMeta.description.length} / {DESCRIPTION_LIMIT} characters
                </p>
              </div>

              {(pageMeta.translatedTitle || pageMeta.translatedDescription) && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{targetLanguage} translation</p>
                  <input
                    type="text"
                    className="input-field"
                    value={pageMeta.translatedTitle}
                    onChange={(e) => setPageMeta((p) => ({ ...p, translatedTitle: e.target.value }))}
                  />
                  <textarea
                    className="input-field min-h-[60px]"
                    value={pageMeta.translatedDescription}
                    onChange={(e) => setPageMeta((p) => ({ ...p, translatedDescription: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-slate-200/40 bg-white/90 p-7 shadow-xl shadow-slate-900/10 backdrop-blur"
          >
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Sections</h2>
                <p className="mt-1 text-sm text-slate-500">Grouped by heading level, the same way search engines read the page.</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="rounded-3xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#008060] focus:ring-2 focus:ring-emerald-100"
                >
                  {LANGUAGES.map((language) => (
                    <option key={language} value={language}>{language}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleTranslateAll}
                  disabled={translatingId !== null}
                  className="inline-flex items-center gap-2 rounded-3xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xl shadow-slate-900/15 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {translatingId === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                  Translate all
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.id} className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${levelBadgeClasses(section.level)}`}>
                      {levelLabel(section.level)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleTranslateSection(section.id)}
                        disabled={translatingId !== null}
                        aria-label="Translate this section"
                        className="rounded-full p-2 text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"
                      >
                        {translatingId === section.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCollapse(section.id)}
                        aria-label={section.collapsed ? "Expand section" : "Collapse section"}
                        className="rounded-full p-2 text-slate-500 transition hover:bg-slate-200"
                      >
                        {section.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSection(section.id)}
                        aria-label="Remove section"
                        className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {!section.collapsed && (
                    <div className="space-y-3">
                      {section.level > 0 && (
                        <input
                          type="text"
                          className="input-field font-medium"
                          value={section.heading}
                          onChange={(e) => updateSectionHeading(section.id, e.target.value)}
                        />
                      )}

                      {section.paragraphs.map((p) => (
                        <textarea
                          key={p.id}
                          className="input-field min-h-[70px]"
                          value={p.text}
                          onChange={(e) => updateSectionParagraph(section.id, p.id, e.target.value)}
                        />
                      ))}

                      {section.images.map((img) => (
                        <div key={img.id} className="flex items-center gap-2 border-t border-slate-200 pt-3">
                          <ImageIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                          <input
                            type="text"
                            className="input-field text-sm"
                            placeholder="Image alt text"
                            value={img.alt}
                            onChange={(e) => updateImageAlt(section.id, img.id, e.target.value)}
                          />
                        </div>
                      ))}

                      {(section.translatedHeading || section.translatedParagraphs.length > 0) && (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-4 space-y-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{targetLanguage} translation</p>
                          {section.level > 0 && (
                            <input
                              type="text"
                              className="input-field font-medium"
                              value={section.translatedHeading}
                              onChange={(e) => updateTranslatedHeading(section.id, e.target.value)}
                            />
                          )}
                          {section.translatedParagraphs.map((p) => (
                            <textarea
                              key={p.id}
                              className="input-field min-h-[60px]"
                              value={p.text}
                              onChange={(e) => updateTranslatedParagraph(section.id, p.id, e.target.value)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.article>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-emerald-200/60 bg-emerald-50/50 p-7 shadow-sm"
          >
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Save to Translations library</h3>
                <p className="text-sm text-slate-600">
                  Store these sections so they appear on the Translations page for future editing.
                  {!isStructured && " Note: this content is unstructured, so it will save as one block."}
                </p>
              </div>
              {savedContentId && (
                <Link
                  to="/translations"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#008060] hover:text-[#006e52]"
                >
                  Open in Translations <ExternalLink className="h-4 w-4" />
                </Link>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Page</label>
                <select
                  className="input-field"
                  value={savePage}
                  onChange={(e) => setSavePage(e.target.value)}
                >
                  {PAGE_OPTIONS.map((page) => (
                    <option key={page} value={page}>{page}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Content key</label>
                <input
                  type="text"
                  className="input-field"
                  value={contentKey}
                  onChange={(e) => setContentKey(e.target.value)}
                  placeholder="e.g. products_blue_tshirt"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleSaveToLibrary}
                disabled={isSaving}
                className="btn btn-primary inline-flex items-center gap-2 px-6 py-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? "Saving..." : "Save to Translations"}
              </button>
              {savedContentId && (
                <button
                  type="button"
                  onClick={() => navigate("/translations")}
                  className="btn btn-secondary px-6 py-2"
                >
                  Go to Translations page
                </button>
              )}
            </div>
          </motion.section>
        </>
      )}

      {message && (
        <p
          className={`rounded-3xl border px-4 py-3 text-sm ${
            messageType === "success"
              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
              : "border-rose-100 bg-rose-50 text-rose-700"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export default TranslationPage;