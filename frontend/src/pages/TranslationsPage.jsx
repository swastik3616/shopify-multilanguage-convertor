import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  FolderTree,
  LayoutList,
  Type,
  AlignLeft,
  Image as ImageLucide,
  FileText,
  Clock3,
  ChevronDown,
  ChevronRight,
  PanelLeft,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { fetchUrlContent } from "../services/translationPageService";

/* ─── Constants ─────────────────────────────────────────────── */
const HEADING_TAGS = ["H1", "H2", "H3", "H4", "H5", "H6"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG"]);
const TEXT_TAGS = new Set([
  "P", "SPAN", "A", "LI", "BUTTON", "LABEL", "SMALL",
  "STRONG", "EM", "B", "I", "TD", "TH", "CAPTION", "SUMMARY",
]);
const STRUCTURAL_TAGS = new Set(["HEADER", "NAV", "MAIN", "FOOTER", "ASIDE", "SECTION", "ARTICLE"]);

/* ─── Helpers ────────────────────────────────────────────────── */
function generateId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
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

function countWords(text = "") {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function countSectionWords(section) {
  return [section.heading, ...section.paragraphs.map((p) => p.text), ...section.images.map((img) => img.alt || "")]
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function estimateReadTime(wordCount) {
  return Math.max(1, Math.ceil(wordCount / 200));
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

function getHeadingTag(level) {
  const map = { 1: "h1", 2: "h2", 3: "h3", 4: "h4", 5: "h5" };
  return map[level] || "h6";
}

function headingClasses(level) {
  if (level === 1) return "text-3xl font-semibold tracking-tight text-slate-950";
  if (level === 2) return "text-2xl font-semibold tracking-tight text-slate-900";
  if (level === 3) return "text-xl font-semibold text-slate-900";
  if (level === 4) return "text-lg font-semibold text-slate-900";
  return "text-base font-semibold text-slate-900";
}

function kindBadge(section) {
  const map = { header: "Header", nav: "Navigation", main: "Main", footer: "Footer", aside: "Aside", fallback: "Fallback" };
  return map[section.kind] || "Content";
}

/* ─── HTML → Sections parser ─────────────────────────────────── */
function parseHtmlToSections(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const descriptionTag = doc.querySelector('meta[name="description"]');
  const meta = {
    title: doc.title?.trim() || "",
    description: descriptionTag?.getAttribute("content")?.trim() || "",
  };

  const root = doc.body;
  const sections = [];
  let current = null;

  const startSection = ({ level = 0, heading = "", kind = "content" } = {}) => {
    current = { id: generateId("sec"), level, heading, kind, paragraphs: [], images: [], collapsed: false };
    sections.push(current);
    return current;
  };

  const ensureSection = (kind, defaultHeading, level = 1) => {
    if (!current || current.kind !== kind) startSection({ kind, heading: defaultHeading, level });
  };

  startSection({ level: 0, heading: "Intro", kind: "intro" });

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  const seenTexts = new Set();

  while (node) {
    if (!SKIP_TAGS.has(node.tagName)) {
      const tag = node.tagName;

      if (tag === "HEADER") ensureSection("header", "Header", 1);
      else if (tag === "NAV") ensureSection("nav", "Navigation", 2);
      else if (tag === "MAIN") ensureSection("main", "Main Content", 1);
      else if (tag === "FOOTER") ensureSection("footer", "Footer", 1);
      else if (tag === "ASIDE") ensureSection("aside", "Sidebar / Aside", 2);
      else if (HEADING_TAGS.includes(tag)) {
        const headingText = normalizeText(node.textContent || "");
        if (headingText) startSection({ level: Number(tag[1]), heading: headingText, kind: current?.kind || "content" });
      } else if (tag === "P") {
        const paragraphText = normalizeText(node.textContent || "");
        if (paragraphText.length > 1) {
          const key = `${current?.id || "none"}::${paragraphText}`;
          if (!seenTexts.has(key)) { current.paragraphs.push({ id: generateId("p"), text: paragraphText }); seenTexts.add(key); }
        }
      } else if (tag === "IMG") {
        const alt = node.getAttribute("alt");
        if (alt !== null) current.images.push({ id: generateId("img"), alt: normalizeText(alt) });
      } else if (TEXT_TAGS.has(tag) && node.children.length === 0) {
        const looseText = normalizeText(node.textContent || "");
        if (shouldKeepLooseText(node, looseText)) {
          const key = `${current?.id || "none"}::${looseText}`;
          if (!seenTexts.has(key)) { current.paragraphs.push({ id: generateId("p"), text: looseText }); seenTexts.add(key); }
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
    id: generateId("sec"), level: 0, heading: "Imported Content", kind: "fallback",
    paragraphs: plainText.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).map((text) => ({ id: generateId("p"), text })),
    images: [], collapsed: false,
  };
}

/* ─── Sub-components ─────────────────────────────────────────── */
function OutlineItem({ section, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition ${isActive ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      style={{ paddingLeft: `${12 + getSectionIndent(section.level)}px` }}
    >
      <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${levelBadgeClasses(section.level)}`}>
        {levelLabel(section.level)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{section.heading || "Untitled section"}</span>
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

/* ─── Main Component ─────────────────────────────────────────── */
function TranslationPage() {
  const sectionRefs = useRef({});
  const [url, setUrl] = useState("");
  const [pageMeta, setPageMeta] = useState({ title: "", description: "" });
  const [sections, setSections] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | loaded | error
  const [message, setMessage] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [sectionSearch, setSectionSearch] = useState("");

  const hasContent = sections.length > 0;

  const filteredSections = useMemo(() => {
    const q = sectionSearch.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) =>
      [s.heading, ...s.paragraphs.map((p) => p.text), ...s.images.map((img) => img.alt || "")]
        .join(" ").toLowerCase().includes(q)
    );
  }, [sections, sectionSearch]);

  const summary = useMemo(() => {
    const headings = sections.filter((s) => s.level > 0 && s.heading.trim()).length;
    const paragraphs = sections.reduce((sum, s) => sum + s.paragraphs.length, 0);
    const images = sections.reduce((sum, s) => sum + s.images.length, 0);
    const words = sections.reduce((sum, s) => sum + countSectionWords(s), 0) + countWords(pageMeta.title) + countWords(pageMeta.description);
    return { sections: sections.length, headings, paragraphs, images, words, readTime: estimateReadTime(words) };
  }, [sections, pageMeta]);

  /* ─── Fetch ──────────────────────────────────────────────── */
  const handleFetchUrl = async () => {
    if (!url.trim()) { setMessage("Enter a valid URL to fetch content."); return; }
    setStatus("loading");
    setMessage("");
    setSections([]);
    setPageMeta({ title: "", description: "" });
    setSelectedSectionId(null);

    try {
      const result = await fetchUrlContent(url.trim());
      if (!result.success) throw new Error(result.message || "Unable to fetch content.");

      if (result.html) {
        const { meta, sections: parsed } = parseHtmlToSections(result.html);
        setPageMeta({ title: meta.title, description: meta.description });
        setSections(parsed.map((s, i) => ({ ...s, collapsed: i !== 0 })));
        setSelectedSectionId(parsed[0]?.id ?? null);
        if (parsed.length === 0) setMessage("HTML fetched, but no editable text sections were detected.");
      } else {
        setSections([makeFallbackSection(result.text || "")]);
        setMessage("Content returned as plain text — page structure could not be detected.");
      }
      setStatus("loaded");
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Failed to load URL content.");
    }
  };

  const resetAll = () => {
    setUrl(""); setSections([]); setPageMeta({ title: "", description: "" });
    setMessage(""); setStatus("idle"); setSectionSearch(""); setSelectedSectionId(null);
  };

  const toggleCollapse = (id) =>
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s)));

  const collapseAll = () => setSections((prev) => prev.map((s) => ({ ...s, collapsed: true })));
  const expandAll = () => setSections((prev) => prev.map((s) => ({ ...s, collapsed: false })));

  const scrollToSection = (id) => {
    setSelectedSectionId(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="space-y-6">

        {/* ── Header / URL input ── */}
        <section className="rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                <Globe className="h-4 w-4" />
                Content Fetcher
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Fetch Page Content</h1>
              <p className="text-sm leading-7 text-slate-600">
                Enter a URL to extract the full page content — headings, paragraphs, images, and page structure.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-[1fr_auto_auto] xl:max-w-2xl">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
                placeholder="https://yourstore.com/products/example"
                className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:shadow-sm"
              />
              <button
                type="button"
                onClick={handleFetchUrl}
                disabled={status === "loading"}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
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

        {/* ── Error / info message ── */}
        {message && (
          <p className={`rounded-3xl border px-4 py-3 text-sm ${status === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
            }`}>
            {message}
          </p>
        )}

        {/* ── Stats row ── */}
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

        {/* ── Page meta banner ── */}
        {hasContent && (pageMeta.title || pageMeta.description) && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Page Meta</p>
            {pageMeta.title && (
              <p className="mb-1 text-lg font-semibold text-slate-900">{pageMeta.title}</p>
            )}
            {pageMeta.description && (
              <p className="text-sm leading-7 text-slate-600">{pageMeta.description}</p>
            )}
          </section>
        )}

        {/* ── Content area ── */}
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">

          {/* Sidebar outline */}
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-600"><FolderTree className="h-4 w-4" /></div>
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
                <button type="button" onClick={collapseAll} className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100">Collapse all</button>
                <button type="button" onClick={expandAll} className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100">Expand all</button>
              </div>

              <div className="max-h-[65vh] space-y-1 overflow-y-auto pr-1">
                {filteredSections.length ? (
                  filteredSections.map((section) => (
                    <OutlineItem key={section.id} section={section} isActive={selectedSectionId === section.id} onClick={() => scrollToSection(section.id)} />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    {hasContent ? "No matching sections found." : "Fetch a page to see its structure."}
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Sections main panel */}
          <main className="min-w-0 space-y-6">
            {hasContent ? (
              sections.map((section, index) => {
                const HeadingTag = getHeadingTag(section.level);
                const wordCount = countSectionWords(section);
                return (
                  <motion.article
                    key={section.id}
                    ref={(node) => { sectionRefs.current[section.id] = node; }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.03 }}
                    className={`rounded-[32px] border bg-white shadow-sm transition ${selectedSectionId === section.id ? "border-emerald-200 ring-2 ring-emerald-100" : "border-slate-200"
                      }`}
                    style={{ marginLeft: `${getSectionIndent(section.level)}px` }}
                  >
                    {/* Section header */}
                    <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                              Section {index + 1}
                            </span>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${levelBadgeClasses(section.level)}`}>
                              {levelLabel(section.level)}
                            </span>
                            <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                              {kindBadge(section)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                            <span>Words: {wordCount}</span>
                            <span>Paragraphs: {section.paragraphs.length}</span>
                            <span>Images: {section.images.length}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCollapse(section.id)}
                          className="rounded-2xl border border-slate-300 bg-white p-2.5 text-slate-600 transition hover:bg-slate-100"
                          aria-label={section.collapsed ? "Expand section" : "Collapse section"}
                        >
                          {section.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Section body */}
                    {!section.collapsed && (
                      <div className="space-y-5 px-5 py-6 sm:px-6">
                        <div className="prose max-w-none prose-slate">
                          {section.heading && (
                            <HeadingTag className={headingClasses(section.level)}>{section.heading}</HeadingTag>
                          )}
                          {section.paragraphs.map((p) => (
                            <p key={p.id} className="text-[15px] leading-8 text-slate-700">{p.text}</p>
                          ))}
                        </div>

                        {section.images.length > 0 && (
                          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <ImageIcon className="h-4 w-4 text-slate-500" />
                              <h4 className="text-sm font-semibold text-slate-900">Images ({section.images.length})</h4>
                            </div>
                            <div className="space-y-2">
                              {section.images.map((img, imgIndex) => (
                                <div key={img.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                  <span>Image {imgIndex + 1}: {img.alt || <span className="italic text-slate-400">No alt text</span>}</span>
                                </div>
                              ))}
                            </div>
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
                  <h2 className="text-xl font-semibold text-slate-900">Start by fetching a webpage</h2>
                  <p className="text-sm leading-7 text-slate-500">
                    Enter a URL above and click <strong>Fetch</strong> to extract and view the page structure — header, nav, main content, and footer.
                  </p>
                </div>
              </section>
            )}
          </main>

        </div>
      </div>
    </div>
  );
}

export default TranslationPage;