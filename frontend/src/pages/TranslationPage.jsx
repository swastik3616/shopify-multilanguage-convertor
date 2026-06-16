import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Copy, Loader2, RefreshCw, Globe, Save, ExternalLink } from "lucide-react";
import { fetchUrlContent } from "../services/translationPageService";
import { translateText } from "../services/translationService";
import { importContentToLibrary } from "../services/contentService";

const LANGUAGES = ["Hindi", "Marathi", "French", "German", "Spanish", "Portuguese"];
const PAGE_OPTIONS = ["home", "product", "collection", "checkout", "other"];

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

function TranslationPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [targetLanguage, setTargetLanguage] = useState(LANGUAGES[0]);
  const [translatedText, setTranslatedText] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");

  const [savePage, setSavePage] = useState("other");
  const [contentKey, setContentKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedContentId, setSavedContentId] = useState(null);

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

      const text = result.text || "";
      setSourceContent(text);
      setContentKey(suggestKeyFromUrl(url.trim()));
      setSavePage(suggestPageFromUrl(url.trim()));
      setStatus("loaded");
    } catch (error) {
      setStatus("error");
      setMessageType("error");
      setMessage(error.message || "Failed to load URL content.");
    }
  };

  const handleTranslate = async () => {
    if (!sourceContent.trim()) {
      setMessageType("error");
      setMessage("Please fetch source content before translating.");
      return;
    }

    setStatus("translating");
    setMessage("");

    try {
      const result = await translateText({ source_text: sourceContent, target_language: targetLanguage });
      setTranslatedText(result.translated_text || "");
      setStatus("translated");
    } catch (error) {
      setStatus("error");
      setMessageType("error");
      setMessage(error.message || "Translation request failed.");
    }
  };

  const handleSaveToLibrary = async () => {
    if (!sourceContent.trim()) {
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

    try {
      const result = await importContentToLibrary({
        page: savePage,
        key: contentKey.trim(),
        source_text: sourceContent.trim(),
        source_url: url.trim(),
        target_language: translatedText ? targetLanguage : "",
        translated_text: translatedText.trim(),
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

  const copyTranslation = async () => {
    if (!translatedText) return;
    await navigator.clipboard.writeText(translatedText);
    setMessageType("success");
    setMessage("Translation copied to clipboard.");
  };

  const resetAll = () => {
    setUrl("");
    setSourceContent("");
    setTranslatedText("");
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
            <h1 className="text-4xl font-semibold leading-tight">Fetch, translate, and save website content to your library.</h1>
            <p className="max-w-2xl text-slate-300 leading-8">
              Pull copy from any URL, translate it side by side, then save it to Translations for ongoing review and editing.
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
                        ? "Content loaded"
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

      <div className="grid gap-6 xl:grid-cols-2">
        <motion.article
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-[32px] border border-slate-200/40 bg-white/90 p-7 shadow-xl shadow-slate-900/10 backdrop-blur"
        >
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Source content</h2>
              <p className="mt-1 text-sm text-slate-500">Enter a URL to fetch the page copy you want to translate.</p>
            </div>
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <RefreshCw className="h-4 w-4" /> Reset
            </button>
          </div>

          <div className="space-y-5">
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

            <textarea
              className="min-h-[320px] w-full rounded-[28px] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-900 outline-none transition focus:border-[#008060] focus:ring-2 focus:ring-emerald-100"
              value={sourceContent}
              onChange={(e) => setSourceContent(e.target.value)}
              placeholder="Your fetched content appears here. You can edit it before translating or saving."
            />
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="rounded-[32px] border border-slate-200/40 bg-white/90 p-7 shadow-xl shadow-slate-900/10 backdrop-blur"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-slate-900">Translation panel</h2>
            <p className="mt-1 text-sm text-slate-500">Choose a language, translate, then save to your library.</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700">Target language</label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#008060] focus:ring-2 focus:ring-emerald-100"
              >
                {LANGUAGES.map((language) => (
                  <option key={language} value={language}>{language}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleTranslate}
              disabled={!sourceContent.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-3xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-slate-900/15 transition hover:bg-slate-800 disabled:opacity-50"
            >
              {status === "translating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Translate
            </button>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 min-h-[220px] text-sm leading-7 text-slate-700">
              {!translatedText && <p className="text-slate-500">Translation output will appear here after you translate.</p>}
              {translatedText && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">Translated result</p>
                    <button
                      type="button"
                      onClick={copyTranslation}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                    >
                      <Copy className="h-4 w-4" /> Copy
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-slate-900">{translatedText}</pre>
                </div>
              )}
            </div>
          </div>
        </motion.article>
      </div>

      {sourceContent && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[32px] border border-emerald-200/60 bg-emerald-50/50 p-7 shadow-sm"
        >
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Save to Translations library</h3>
              <p className="text-sm text-slate-600">
                Store this content so it appears on the Translations page for future editing.
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
            <p className="text-xs text-slate-500">
              {translatedText
                ? "Source and current translation will both be saved."
                : "Only source content will be saved. Translate first to include a translation."}
            </p>
          </div>
        </motion.section>
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
