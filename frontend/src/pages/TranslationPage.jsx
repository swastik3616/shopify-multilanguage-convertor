import { useEffect, useMemo, useRef, useState } from "react";
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
  ChevronRight,
  Trash2,
  Image as ImageIcon,
  Search,
  FileText,
  Type,
  AlignLeft,
  Image as ImageLucide,
  Clock3,
  PanelLeft,
  Sparkles,
  CheckCircle2,
  BarChart3,
  Pencil,
  Eye,
  LayoutList,
  FolderTree,
} from "lucide-react";
import { fetchUrlContent } from "../services/translationPageService";
import { translateText } from "../services/translationService";
import { importContentToLibrary } from "../services/contentService";

const LANGUAGES = ["Hindi", "Marathi", "French", "German", "Spanish", "Portuguese"];
const PAGE_OPTIONS = ["home", "product", "collection", "checkout", "other"];
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;
const TRANSLATION_DELIMITER = "\n\n";

const HEADING_TAGS = ["H1", "H2", "H3", "H4", "H5", "H6"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG"]);
const TEXT_TAGS = new Set([
  "P",
  "SPAN",
  "A",
  "LI",
  "BUTTON",
  "LABEL",
  "SMALL",
  "STRONG",
  "EM",
  "B",
  "I",
  "TD",
  "TH",
  "CAPTION",
  "SUMMARY",
]);
const STRUCTURAL_TAGS = new Set(["HEADER", "NAV", "MAIN", "FOOTER", "ASIDE", "SECTION", "ARTICLE"]);

const emptyMeta = {
  title: "",
  description: "",
  translatedTitle: "",
  translatedDescription: "",
};

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
  return level ? `H${level}` : "Block";
}

function levelBadgeClasses(level) {
  if (level === 1) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (level === 2) return "border-sky-200 bg-sky-50 text-sky-700";
  if (level >= 3) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function getSectionIndent(level) {
  if (!level || level <= 1) return 0;
  return (level - 1) * 20;
}

function countWords(text = "") {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function countSectionWords(section) {
  return [
    section.heading,
    ...section.paragraphs.map((p) => p.text),
    ...section.images.map((img) => img.alt || ""),
  ]
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function estimateReadTime(wordCount) {
  return Math.max(1, Math.ceil(wordCount / 200));
}

function hasSectionTranslation(section) {
  return Boolean(
    section.translatedHeading ||
      (section.translatedParagraphs || []).some((p) => p.text?.trim())
  );
}

function normalizeText(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function shouldKeepLooseText(node, text) {
  if (!text || text.length < 2) return false;
  if (text.length > 220) return false;

  const parentTag = node.parentElement?.tagName;
  if (parentTag && ["SCRIPT", "STYLE", "NOSCRIPT"].includes(parentTag)) return false;

  return true;
}

function parseHtmlToSections(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const descriptionTag = doc.querySelector('meta[name="description"]');
  const meta = {
    title: doc.title?.trim() || "",
    description: descriptionTag?.getAttribute("content")?.trim() || "",
  };

  // IMPORTANT FIX:
  // Use full body instead of <main> so header/footer/nav content is included.
  const root = doc.body;

  const sections = [];
  let current = null;

  const startSection = ({ level = 0, heading = "", kind = "content" } = {}) => {
    current = {
      id: generateId("sec"),
      level,
      heading,
      kind,
      paragraphs: [],
      images: [],
      translatedHeading: "",
      translatedParagraphs: [],
      collapsed: false,
      isEditing: false,
      mismatch: false,
    };
    sections.push(current);
    return current;
  };

  const ensureSection = (kind, defaultHeading, level = 1) => {
    if (!current || current.kind !== kind) {
      startSection({ kind, heading: defaultHeading, level });
    }
  };

  startSection({ level: 0, heading: "Intro", kind: "intro" });

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  const seenTexts = new Set();

  while (node) {
    if (!SKIP_TAGS.has(node.tagName)) {
      const tag = node.tagName;
      const text = normalizeText(node.textContent || "");

      if (tag === "HEADER") {
        ensureSection("header", "Header", 1);
      } else if (tag === "NAV") {
        ensureSection("nav", "Navigation", 2);
      } else if (tag === "MAIN") {
        ensureSection("main", "Main Content", 1);
      } else if (tag === "FOOTER") {
        ensureSection("footer", "Footer", 1);
      } else if (tag === "ASIDE") {
        ensureSection("aside", "Sidebar / Aside", 2);
      } else if (HEADING_TAGS.includes(tag)) {
        const headingText = normalizeText(node.textContent || "");
        if (headingText) {
          startSection({
            level: Number(tag[1]),
            heading: headingText,
            kind: current?.kind || "content",
          });
        }
      } else if (tag === "P") {
        const paragraphText = normalizeText(node.textContent || "");
        if (paragraphText.length > 1) {
          const key = `${current?.id || "none"}::${paragraphText}`;
          if (!seenTexts.has(key)) {
            current.paragraphs.push({ id: generateId("p"), text: paragraphText });
            seenTexts.add(key);
          }
        }
      } else if (tag === "IMG") {
        const alt = node.getAttribute("alt");
        if (alt !== null) {
          const altText = normalizeText(alt);
          current.images.push({ id: generateId("img"), alt: altText });
        }
      } else if (TEXT_TAGS.has(tag) && node.children.length === 0) {
        const looseText = normalizeText(node.textContent || "");
        if (shouldKeepLooseText(node, looseText)) {
          const key = `${current?.id || "none"}::${looseText}`;
          if (!seenTexts.has(key)) {
            current.paragraphs.push({ id: generateId("p"), text: looseText });
            seenTexts.add(key);
          }
        }
      } else if (STRUCTURAL_TAGS.has(tag) && !current) {
        startSection({ level: 0, heading: tag, kind: "content" });
      }
    }

    node = walker.nextNode();
  }

  const cleaned = sections.filter((s) => {
    const hasUsefulHeading = s.heading && s.heading !== "Intro";
    return hasUsefulHeading || s.paragraphs.length || s.images.length;
  });

  return { meta, sections: cleaned };
}

function makeFallbackSection(plainText) {
  return {
    id: generateId("sec"),
    level: 0,
    heading: "Imported Content",
    kind: "fallback",
    paragraphs: plainText
      .split(/\n{2,}/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({ id: generateId("p"), text })),
    images: [],
    translatedHeading: "",
    translatedParagraphs: [],
    collapsed: false,
    isEditing: true,
    mismatch: false,
  };
}

function buildSectionTranslationPayload(section) {
  const blocks = [];
  if (section.heading) blocks.push(section.heading);
  section.paragraphs.forEach((p) => blocks.push(p.text));
  return blocks.join(TRANSLATION_DELIMITER);
}

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

function getHeadingTag(level) {
  if (level === 1) return "h1";
  if (level === 2) return "h2";
  if (level === 3) return "h3";
  if (level === 4) return "h4";
  if (level === 5) return "h5";
  return "h6";
}

function headingClasses(level) {
  if (level === 1) return "text-3xl font-semibold tracking-tight text-slate-950";
  if (level === 2) return "text-2xl font-semibold tracking-tight text-slate-900";
  if (level === 3) return "text-xl font-semibold text-slate-900";
  if (level === 4) return "text-lg font-semibold text-slate-900";
  return "text-base font-semibold text-slate-900";
}

function kindBadge(section) {
  const kind = section.kind || "content";
  if (kind === "header") return "Header";
  if (kind === "nav") return "Navigation";
  if (kind === "main") return "Main";
  if (kind === "footer") return "Footer";
  if (kind === "aside") return "Aside";
  if (kind === "fallback") return "Fallback";
  return "Content";
}

function OutlineItem({ section, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
        isActive
          ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
      style={{ paddingLeft: `${12 + getSectionIndent(section.level)}px` }}
    >
      <span
        className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${levelBadgeClasses(
          section.level
        )}`}
      >
        {levelLabel(section.level)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {section.heading || "Untitled section"}
      </span>
    </button>
  );
}

function StatCard({ icon: Icon, label, value, tone = "slate" }) {
  const toneMap = {
    slate: "bg-white border-slate-200 text-slate-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    sky: "bg-sky-50 border-sky-200 text-sky-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
  };

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${toneMap[tone]}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{label}</span>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function TranslationPage() {
  const navigate = useNavigate();
  const sectionRefs = useRef({});
  const [url, setUrl] = useState("");
  const [pageMeta, setPageMeta] = useState(emptyMeta);
  const [sections, setSections] = useState([]);
  const [isStructured, setIsStructured] = useState(true);
  const [targetLanguage, setTargetLanguage] = useState(LANGUAGES[0]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [translatingId, setTranslatingId] = useState(null);

  const [savePage, setSavePage] = useState("other");
  const [contentKey, setContentKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedContentId, setSavedContentId] = useState(null);

  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [sectionSearch, setSectionSearch] = useState("");

  const hasContent = sections.length > 0;

  useEffect(() => {
    if (!selectedSectionId && sections.length) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections, selectedSectionId]);

  const filteredSections = useMemo(() => {
    const q = sectionSearch.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) =>
      [s.heading, ...s.paragraphs.map((p) => p.text), ...s.images.map((img) => img.alt || "")]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [sections, sectionSearch]);

  const summary = useMemo(() => {
    const headings = sections.filter((s) => s.level > 0 && s.heading.trim()).length;
    const paragraphs = sections.reduce((sum, s) => sum + s.paragraphs.length, 0);
    const images = sections.reduce((sum, s) => sum + s.images.length, 0);
    const words =
      sections.reduce((sum, s) => sum + countSectionWords(s), 0) +
      countWords(pageMeta.title) +
      countWords(pageMeta.description);
    const translatedSections = sections.filter(hasSectionTranslation).length;

    return {
      sections: sections.length,
      headings,
      paragraphs,
      images,
      words,
      readTime: estimateReadTime(words),
      translatedSections,
      progress: sections.length ? Math.round((translatedSections / sections.length) * 100) : 0,
    };
  }, [sections, pageMeta]);

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
        setSections(parsedSections.map((section, index) => ({ ...section, collapsed: index !== 0 })));
        setIsStructured(true);
        if (parsedSections.length === 0) {
          setMessageType("error");
          setMessage("Full HTML was fetched, but no editable text sections were detected.");
        }
      } else {
        setPageMeta(emptyMeta);
        setSections([makeFallbackSection(result.text || "")]);
        setIsStructured(false);
        setMessageType("error");
        setMessage(
          "This content came back as plain text, so headings, header, footer, and page structure could not be fully detected. Ask your backend to also return raw HTML in a `html` field from fetchUrlContent."
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

  const toggleEdit = (id) =>
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isEditing: !s.isEditing, collapsed: false } : s))
    );

  const removeSection = (id) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
    if (selectedSectionId === id) setSelectedSectionId(null);
  };

  const collapseAll = () => {
    setSections((prev) => prev.map((s) => ({ ...s, collapsed: true, isEditing: false })));
  };

  const expandAll = () => {
    setSections((prev) => prev.map((s) => ({ ...s, collapsed: false })));
  };

  const scrollToSection = (id) => {
    setSelectedSectionId(id);
    const node = sectionRefs.current[id];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleTranslateSection = async (sectionId) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    const payload = buildSectionTranslationPayload(section);
    if (!payload.trim()) return;

    setTranslatingId(sectionId);
    try {
      const result = await translateText({
        source_text: payload,
        target_language: targetLanguage,
      });

      const { translatedHeading, translatedParagraphs, mismatch } = applyTranslatedSection(
        section,
        result.translated_text || ""
      );

      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId ? { ...s, translatedHeading, translatedParagraphs, mismatch } : s
        )
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
      const payload = [pageMeta.title, pageMeta.description]
        .filter(Boolean)
        .join(TRANSLATION_DELIMITER);

      const result = await translateText({
        source_text: payload,
        target_language: targetLanguage,
      });

      const blocks = (result.translated_text || "")
        .split(TRANSLATION_DELIMITER)
        .map((b) => b.trim());

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
        meta: pageMeta,
        sections,
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
    setSectionSearch("");
    setSelectedSectionId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="space-y-6">
        <section className="rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                <Globe className="h-4 w-4" />
                Full-page translation workspace
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Translation CMS
              </h1>
              <p className="text-sm leading-7 text-slate-600">
                Fetch full page HTML, including header, navigation, main content, and footer, then translate and save it section by section.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-[1fr_auto_auto] xl:max-w-2xl">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourstore.com/products/example"
                className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:shadow-sm"
              />
              <button
                type="button"
                onClick={handleFetchUrl}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                {status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Fetch
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>
        </section>

        {hasContent && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <StatCard icon={LayoutList} label="Sections" value={summary.sections} />
            <StatCard icon={Type} label="Headings" value={summary.headings} tone="sky" />
            <StatCard icon={AlignLeft} label="Paragraphs" value={summary.paragraphs} />
            <StatCard icon={ImageLucide} label="Images" value={summary.images} tone="amber" />
            <StatCard icon={FileText} label="Words" value={summary.words} />
            <StatCard icon={Clock3} label="Read time" value={`${summary.readTime} min`} tone="emerald" />
          </section>
        )}

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
                  <FolderTree className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Page Outline</h2>
                  <p className="text-xs text-slate-500">Full page structure</p>
                </div>
              </div>

              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={sectionSearch}
                  onChange={(e) => setSectionSearch(e.target.value)}
                  placeholder="Search sections"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={collapseAll}
                  className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Collapse all
                </button>
                <button
                  type="button"
                  onClick={expandAll}
                  className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Expand all
                </button>
              </div>

              <div className="max-h-[65vh] space-y-1 overflow-y-auto pr-1">
                {filteredSections.length ? (
                  filteredSections.map((section) => (
                    <OutlineItem
                      key={section.id}
                      section={section}
                      isActive={selectedSectionId === section.id}
                      onClick={() => scrollToSection(section.id)}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    No matching sections found.
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className="min-w-0 space-y-6">
            {hasContent ? (
              sections.map((section, index) => {
                const HeadingTag = getHeadingTag(section.level);
                const sectionWordCount = countSectionWords(section);
                const hasTranslation = hasSectionTranslation(section);

                return (
                  <motion.article
                    key={section.id}
                    ref={(node) => {
                      sectionRefs.current[section.id] = node;
                    }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`rounded-[32px] border bg-white shadow-sm transition ${
                      selectedSectionId === section.id
                        ? "border-emerald-200 ring-2 ring-emerald-100"
                        : "border-slate-200"
                    }`}
                    style={{ marginLeft: `${getSectionIndent(section.level)}px` }}
                  >
                    <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                              Section {index + 1}
                            </span>
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${levelBadgeClasses(
                                section.level
                              )}`}
                            >
                              {levelLabel(section.level)}
                            </span>
                            <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                              {kindBadge(section)}
                            </span>
                            {section.mismatch && (
                              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                Needs review
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                            <span>Words: {sectionWordCount}</span>
                            <span>Paragraphs: {section.paragraphs.length}</span>
                            <span>Images: {section.images.length}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedSectionId(section.id)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            <Eye className="h-4 w-4" />
                            Focus
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleEdit(section.id)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            <Pencil className="h-4 w-4" />
                            {section.isEditing ? "Preview" : "Edit"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTranslateSection(section.id)}
                            disabled={translatingId !== null}
                            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                          >
                            {translatingId === section.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Languages className="h-4 w-4" />
                            )}
                            Translate
                          </button>

                          <button
                            type="button"
                            onClick={() => removeSection(section.id)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleCollapse(section.id)}
                            className="rounded-2xl border border-slate-300 bg-white p-2.5 text-slate-600 transition hover:bg-slate-100"
                            aria-label={section.collapsed ? "Expand section" : "Collapse section"}
                          >
                            {section.collapsed ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {!section.collapsed && (
                      <div className="space-y-6 px-5 py-6 sm:px-6">
                        {!section.isEditing ? (
                          <div className="space-y-5">
                            <div className="prose max-w-none prose-slate">
                              {section.heading && (
                                <HeadingTag className={headingClasses(section.level)}>
                                  {section.heading}
                                </HeadingTag>
                              )}

                              {section.paragraphs.map((p) => (
                                <p key={p.id} className="text-[15px] leading-8 text-slate-700">
                                  {p.text}
                                </p>
                              ))}
                            </div>

                            {section.images.length > 0 && (
                              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                <div className="mb-3 flex items-center gap-2">
                                  <ImageIcon className="h-4 w-4 text-slate-500" />
                                  <h4 className="text-sm font-semibold text-slate-900">Images</h4>
                                </div>
                                <div className="space-y-2">
                                  {section.images.map((img, imageIndex) => (
                                    <div
                                      key={img.id}
                                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
                                    >
                                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                      <span>
                                        Image {imageIndex + 1}: {img.alt || "No alt text"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {hasTranslation && (
                              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4">
                                <div className="mb-4 flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-emerald-600" />
                                  <h4 className="text-sm font-semibold text-emerald-900">
                                    Translation preview
                                  </h4>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-2">
                                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                      Original
                                    </p>
                                    <div className="space-y-3">
                                      {section.heading && (
                                        <div>
                                          <p className="mb-1 text-xs font-medium text-slate-400">Heading</p>
                                          <p className="font-medium text-slate-900">{section.heading}</p>
                                        </div>
                                      )}
                                      {section.paragraphs.map((p, idx) => (
                                        <div key={p.id}>
                                          <p className="mb-1 text-xs font-medium text-slate-400">
                                            Paragraph {idx + 1}
                                          </p>
                                          <p className="text-sm leading-7 text-slate-700">{p.text}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                                      {targetLanguage}
                                    </p>
                                    <div className="space-y-3">
                                      {section.heading && (
                                        <div>
                                          <p className="mb-1 text-xs font-medium text-slate-400">
                                            Heading translation
                                          </p>
                                          <p className="font-medium text-slate-900">
                                            {section.translatedHeading || "—"}
                                          </p>
                                        </div>
                                      )}
                                      {section.translatedParagraphs.map((p, idx) => (
                                        <div key={p.id}>
                                          <p className="mb-1 text-xs font-medium text-slate-400">
                                            Paragraph {idx + 1} translation
                                          </p>
                                          <p className="text-sm leading-7 text-slate-700">
                                            {p.text || "—"}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-5">
                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                              <div className="mb-3 flex items-center gap-2">
                                <Pencil className="h-4 w-4 text-slate-500" />
                                <h4 className="text-sm font-semibold text-slate-900">Edit section</h4>
                              </div>

                              <div className="space-y-4">
                                <div>
                                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                    Heading
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                                    value={section.heading}
                                    onChange={(e) => updateSectionHeading(section.id, e.target.value)}
                                  />
                                </div>

                                {section.paragraphs.map((p, idx) => (
                                  <div key={p.id}>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                      Paragraph {idx + 1}
                                    </label>
                                    <textarea
                                      className="min-h-[120px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-emerald-500"
                                      value={p.text}
                                      onChange={(e) => updateSectionParagraph(section.id, p.id, e.target.value)}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            {section.images.length > 0 && (
                              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                                <div className="mb-3 flex items-center gap-2">
                                  <ImageIcon className="h-4 w-4 text-slate-500" />
                                  <h4 className="text-sm font-semibold text-slate-900">Images</h4>
                                </div>
                                <div className="space-y-3">
                                  {section.images.map((img, idx) => (
                                    <div key={img.id}>
                                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                        Image {idx + 1} alt text
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                                        value={img.alt}
                                        onChange={(e) => updateImageAlt(section.id, img.id, e.target.value)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {hasTranslation && (
                              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4">
                                <div className="mb-4 flex items-center gap-2">
                                  <Languages className="h-4 w-4 text-emerald-600" />
                                  <h4 className="text-sm font-semibold text-emerald-900">Translation editor</h4>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-2">
                                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                      Original content
                                    </p>
                                    <div>
                                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                        Heading
                                      </label>
                                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                        {section.heading}
                                      </div>
                                    </div>
                                    {section.paragraphs.map((p, idx) => (
                                      <div key={p.id}>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                          Paragraph {idx + 1}
                                        </label>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">
                                          {p.text}
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                                      Translated content
                                    </p>
                                    <div>
                                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                        Heading translation
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                                        value={section.translatedHeading}
                                        onChange={(e) => updateTranslatedHeading(section.id, e.target.value)}
                                      />
                                    </div>
                                    {section.translatedParagraphs.map((p, idx) => (
                                      <div key={p.id}>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                          Paragraph {idx + 1} translation
                                        </label>
                                        <textarea
                                          className="min-h-[120px] w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                                          value={p.text}
                                          onChange={(e) =>
                                            updateTranslatedParagraph(section.id, p.id, e.target.value)
                                          }
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.article>
                );
              })
            ) : (
              <section className="rounded-[32px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                <div className="mx-auto flex max-w-md flex-col items-center space-y-4">
                  <div className="rounded-3xl bg-slate-100 p-4 text-slate-500">
                    <PanelLeft className="h-7 w-7" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Start by fetching a full webpage
                  </h2>
                  <p className="text-sm leading-7 text-slate-500">
                    The editor will try to parse the full document body, including header, nav, main content, and footer.
                  </p>
                </div>
              </section>
            )}
          </main>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="space-y-6">
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">SEO & Progress</h2>
                    <p className="text-xs text-slate-500">Metadata and translation status</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                        Translation progress
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{summary.progress || 0}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${summary.progress || 0}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {summary.translatedSections} of {summary.sections} sections translated
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Target language</label>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                    >
                      {LANGUAGES.map((language) => (
                        <option key={language} value={language}>
                          {language}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={handleTranslateMeta}
                      disabled={translatingId === "meta"}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                    >
                      {translatingId === "meta" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Languages className="h-4 w-4" />
                      )}
                      Translate SEO
                    </button>

                    <button
                      type="button"
                      onClick={handleTranslateAll}
                      disabled={translatingId !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      {translatingId === "all" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Languages className="h-4 w-4" />
                      )}
                      Translate all
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">SEO Information</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Titles under 60 characters and descriptions around 160 characters are commonly recommended to reduce truncation in search results. [web:45][web:46]
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Meta title</label>
                    <input
                      type="text"
                      value={pageMeta.title}
                      onChange={(e) => setPageMeta((p) => ({ ...p, title: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                    />
                    <p
                      className={`mt-1 text-xs ${
                        pageMeta.title.length > TITLE_LIMIT ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {pageMeta.title.length} / {TITLE_LIMIT}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Meta description</label>
                    <textarea
                      value={pageMeta.description}
                      onChange={(e) => setPageMeta((p) => ({ ...p, description: e.target.value }))}
                      className="min-h-[110px] w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                    />
                    <p
                      className={`mt-1 text-xs ${
                        pageMeta.description.length > DESCRIPTION_LIMIT
                          ? "text-rose-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {pageMeta.description.length} / {DESCRIPTION_LIMIT}
                    </p>
                  </div>

                  {(pageMeta.translatedTitle || pageMeta.translatedDescription) && (
                    <div className="space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                        {targetLanguage} translation
                      </p>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Translated meta title
                        </label>
                        <input
                          type="text"
                          value={pageMeta.translatedTitle}
                          onChange={(e) =>
                            setPageMeta((p) => ({ ...p, translatedTitle: e.target.value }))
                          }
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Translated meta description
                        </label>
                        <textarea
                          value={pageMeta.translatedDescription}
                          onChange={(e) =>
                            setPageMeta((p) => ({ ...p, translatedDescription: e.target.value }))
                          }
                          className="min-h-[100px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {hasContent && (
                <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Save to library</h3>
                    <p className="mt-1 text-xs leading-6 text-slate-600">
                      Save full-page content, translations, and structure for later editing.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Page</label>
                      <select
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                        value={savePage}
                        onChange={(e) => setSavePage(e.target.value)}
                      >
                        {PAGE_OPTIONS.map((page) => (
                          <option key={page} value={page}>
                            {page}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Content key</label>
                      <input
                        type="text"
                        value={contentKey}
                        onChange={(e) => setContentKey(e.target.value)}
                        placeholder="e.g. products_blue_tshirt"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveToLibrary}
                      disabled={isSaving}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {isSaving ? "Saving..." : "Save to Translations"}
                    </button>

                    {savedContentId && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => navigate("/translations")}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                        >
                          Open Translations page
                        </button>
                        <Link
                          to="/translations"
                          className="inline-flex w-full items-center justify-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          View saved content <ExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </aside>
        </div>

        {message && (
          <p
            className={`rounded-3xl border px-4 py-3 text-sm ${
              messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default TranslationPage;