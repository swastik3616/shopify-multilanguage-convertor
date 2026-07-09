import { useState, useEffect } from "react";
import { Search, Globe, Save, Loader2, Store } from "lucide-react";
import { getSeoResources, translateSeoResource, updateOriginalSeo } from "../services/seoService";
import { getContentsStoreStatus } from "../services/contentService";
import { translateText } from "../services/translationService";
import { Link } from "react-router-dom";

// Mapping languages to Shopify ISO locales
const LANGUAGE_LOCALES = {
  "Hindi": "hi",
  "Marathi": "mr",
  "French": "fr",
  "German": "de",
  "Spanish": "es",
  "Italian": "it"
};

function SeoPage() {
  const [resourceType, setResourceType] = useState("products");
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);

  // Original SEO editing state
  const [originalTitle, setOriginalTitle] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");
  const [isSavingOriginal, setIsSavingOriginal] = useState(false);

  // Translation state
  const [targetLang, setTargetLang] = useState("Hindi");
  const [translatedTitle, setTranslatedTitle] = useState("");
  const [translatedDescription, setTranslatedDescription] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [storeConnected, setStoreConnected] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");

  useEffect(() => {
    const loadStoreStatus = async () => {
      try {
        const status = await getContentsStoreStatus();
        setStoreConnected(Boolean(status.connected));
        setStoreUrl(status.store_url || "");
      } catch (error) {
        console.error("Error loading store status:", error);
      }
    };
    loadStoreStatus();
  }, []);

  const [errorMsg, setErrorMsg] = useState(null);

  const fetchResources = async () => {
    if (!storeConnected) return;
    setIsLoading(true);
    setSelectedResource(null);
    setErrorMsg(null);
    try {
      const data = await getSeoResources(resourceType);
      setResources(data.resources || []);
    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || "Failed to fetch resources. Please check your store settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (storeConnected) {
      fetchResources();
    }
  }, [resourceType, storeConnected]);

  const handleSelectResource = (resource) => {
    setSelectedResource(resource);
    setOriginalTitle(resource.originalMetaTitle || "");
    setOriginalDescription(resource.originalMetaDescription || "");
    setTranslatedTitle("");
    setTranslatedDescription("");
  };

  const handleSaveOriginal = async () => {
    if (!selectedResource) return;

    setIsSavingOriginal(true);
    try {
      const payload = {
        resourceId: selectedResource.id,
        metaTitle: originalTitle,
        metaDescription: originalDescription
      };

      await updateOriginalSeo(payload);
      alert("Original SEO metadata successfully updated in Shopify!");
      fetchResources();
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update original SEO metadata");
    } finally {
      setIsSavingOriginal(false);
    }
  };

  const handleTranslate = async () => {
    if (!selectedResource) return;
    setIsTranslating(true);
    try {
      // 1. Actually translate the original content to the target language
      let newTitle = translatedTitle;
      let newDesc = translatedDescription;

      if (originalTitle && !translatedTitle) {
        const rTitle = await translateText({ source_text: originalTitle, target_language: targetLang });
        newTitle = rTitle.translated_text || originalTitle;
      }

      if (originalDescription && !translatedDescription) {
        const rDesc = await translateText({ source_text: originalDescription, target_language: targetLang });
        newDesc = rDesc.translated_text || originalDescription;
      }

      setTranslatedTitle(newTitle);
      setTranslatedDescription(newDesc);

      // 2. Map target language to Shopify locale
      const locale = LANGUAGE_LOCALES[targetLang] || "es";

      // 3. Save to Shopify
      const payload = {
        resourceId: selectedResource.id,
        locale: locale,
        metaTitle: newTitle,
        metaDescription: newDesc,
        titleDigest: selectedResource.titleDigest,
        descriptionDigest: selectedResource.descriptionDigest
      };

      await translateSeoResource(payload);
      alert("Successfully translated and saved to Shopify!");
    } catch (error) {
      console.error(error);
      alert(error.message || "Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };



  const filteredResources = resources.filter(res =>
    res.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[640px] flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">SEO Manager</h1>
          <p className="text-sm text-slate-500 mt-1">
            Edit Page Titles and Meta Descriptions directly on Shopify.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Resource Type</label>
            <select
              className="input-field h-9 min-w-[140px]"
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
            >
              <option value="pages">Pages</option>
            </select>
          </div>
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
            <Search className="absolute left-2.5 bottom-2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              className="input-field pl-9 h-9 text-sm w-full sm:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {!storeConnected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <Store className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              No Shopify store connected. Go to{" "}
              <Link to="/store-settings" className="font-medium text-amber-700 hover:text-amber-900 underline">
                Store Settings
              </Link>
              {" "}and add your store URL + access token to load SEO data.
            </p>
          </div>
        </div>
      )}

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: Resource List */}
        <section className="card-container flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Search className="h-4 w-4 text-[#008060]" />
            <div>
              <h2 className="font-semibold text-slate-900">Original Resources</h2>
              <p className="text-xs text-slate-500">Select an item to edit its SEO data</p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : errorMsg ? (
                <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center text-red-500">
                  <Globe className="mb-3 h-8 w-8 text-red-300" />
                  <p className="text-sm font-medium text-red-900">{errorMsg}</p>
                </div>
              ) : filteredResources.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {filteredResources.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectResource(item)}
                        className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 ${selectedResource?.id === item.id ? "bg-emerald-50/80 ring-1 ring-inset ring-[#008060]/20" : ""
                          }`}
                      >
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <div className="mt-1 flex flex-col gap-1 text-xs text-slate-500">
                          <p><span className="font-medium">SEO Title:</span> {item.originalMetaTitle || "None"}</p>
                          <p className="truncate"><span className="font-medium">Meta Description:</span> {item.originalMetaDescription || "None"}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center text-slate-500">
                  <Search className="mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-medium text-slate-900">No resources found</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right: Translation Editor */}
        <section className="card-container flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Globe className="h-4 w-4 text-[#008060]" />
            <div>
              <h2 className="font-semibold text-slate-900">SEO Editor</h2>
              <p className="text-xs text-slate-500">Edit metadata</p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-4 overflow-y-auto">
            {selectedResource ? (
              <div className="space-y-6">
                {/* ORIGINAL SEO EDITOR */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-slate-800 mb-3 uppercase tracking-wide flex items-center gap-2">
                    Original Metadata (Shopify)
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <label className="block text-xs font-medium text-slate-500">Original SEO Title</label>
                        <span className={`text-[10px] ${originalTitle.length > 60 ? 'text-red-400' : 'text-slate-400'}`}>
                          {originalTitle.length} / 60
                        </span>
                      </div>
                      <input
                        type="text"
                        className="input-field w-full text-sm bg-white"
                        placeholder="Store's original SEO title"
                        value={originalTitle}
                        onChange={(e) => setOriginalTitle(e.target.value)}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <label className="block text-xs font-medium text-slate-500">Original Meta Description</label>
                        <span className={`text-[10px] ${originalDescription.length > 160 ? 'text-red-400' : 'text-slate-400'}`}>
                          {originalDescription.length} / 160
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        className="input-field w-full text-sm bg-white resize-none"
                        placeholder="Store's original meta description"
                        value={originalDescription}
                        onChange={(e) => setOriginalDescription(e.target.value)}
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        className="btn btn-secondary w-full sm:w-auto px-4 py-1.5 text-xs flex items-center justify-center gap-1"
                        onClick={handleSaveOriginal}
                        disabled={isSavingOriginal || (!originalTitle && !originalDescription)}
                      >
                        {isSavingOriginal ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        {isSavingOriginal ? "Updating..." : "Update Original in Shopify"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* TRANSLATED SEO EDITOR */}
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-emerald-800 uppercase tracking-wide flex items-center gap-2">
                      Translate Metadata
                    </h3>
                    <select
                      className="input-field h-8 py-0 px-2 text-xs w-32 border-emerald-200"
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                    >
                      {Object.keys(LANGUAGE_LOCALES).map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <label className="block text-xs font-medium text-emerald-700">Translated SEO Title</label>
                        <span className={`text-[10px] ${translatedTitle.length > 60 ? 'text-red-400' : 'text-emerald-500'}`}>
                          {translatedTitle.length} / 60
                        </span>
                      </div>
                      <input
                        type="text"
                        className="input-field w-full text-sm bg-white border-emerald-200"
                        placeholder="Click translate to generate..."
                        value={translatedTitle}
                        onChange={(e) => setTranslatedTitle(e.target.value)}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <label className="block text-xs font-medium text-emerald-700">Translated Meta Description</label>
                        <span className={`text-[10px] ${translatedDescription.length > 160 ? 'text-red-400' : 'text-emerald-500'}`}>
                          {translatedDescription.length} / 160
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        className="input-field w-full text-sm bg-white resize-none border-emerald-200"
                        placeholder="Click translate to generate..."
                        value={translatedDescription}
                        onChange={(e) => setTranslatedDescription(e.target.value)}
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto px-4 py-1.5 text-xs flex items-center justify-center gap-1"
                        onClick={handleTranslate}
                        disabled={isTranslating}
                      >
                        {isTranslating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                        {isTranslating ? "Translating..." : "Translate & Save"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-slate-500">
                <Globe className="mb-3 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-900">No resource selected</p>
                <p className="mt-1 text-sm">Select a product or page to edit its SEO metadata.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default SeoPage;
