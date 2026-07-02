import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, Languages, FileText, Trash2, RefreshCw, Store } from "lucide-react";
import { getTranslations } from "../services/translationHistoryService";
import {
  getContents,
  getContentsStoreStatus,
  syncContentsFromShopify,
  createContent,
  updateContent,
  deleteContent,
  fetchUrlContent,
  importContentToLibrary,
  translateContent,
  updateTranslation,
  deleteTranslation,
} from "../services/contentService";

const TARGET_LANGUAGES = ["Hindi", "Marathi", "French", "German"];

function TranslationsPage() {
  const [contents, setContents] = useState([]);
  const [history, setHistory] = useState([]);

  const [pageFilter, setPageFilter] = useState("home");
  const [contentKey, setContentKey] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [selectedContent, setSelectedContent] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [isSyncing, setIsSyncing] = useState(false);
  const [storeConnected, setStoreConnected] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [isImportingUrl, setIsImportingUrl] = useState(false);

  const loadContents = async (page = "home") => {
    try {
      const data = await getContents(page);
      setContents(data);
    } catch (error) {
      console.error("Error loading contents:", error);
    }
  };

  const loadTranslations = async () => {
    try {
      const data = await getTranslations();
      setHistory(data);
    } catch (error) {
      console.error("Error loading translations:", error);
    }
  };

  useEffect(() => {
    const fetchPageData = async () => {
      await loadContents(pageFilter);
      setSelectedContent(null);
    };

    fetchPageData();
  }, [pageFilter]);

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

  const handleSyncFromShopify = async () => {
    if (!["home", "product", "collection"].includes(pageFilter)) {
      setSyncMessage("Only home, product, and collection pages can be synced from Shopify.");
      return;
    }

    setIsSyncing(true);
    setSyncMessage("");

    try {
      const result = await syncContentsFromShopify(pageFilter);
      if (!result.success) {
        throw new Error(result.message || "Sync failed.");
      }

      setSyncMessage(result.message);
      await loadContents(pageFilter);
    } catch (error) {
      console.error("Error syncing from Shopify:", error);
      setSyncMessage(error.message || "Unable to sync content from Shopify.");
    } finally {
      setIsSyncing(false);
    }
  };

  const resetForm = () => {
    setSelectedContent(null);
    setContentKey("");
    setSourceText("");
  };

  const handleSelectContent = (content) => {
    setSelectedContent(content);
    setContentKey(content.key);
    setSourceText(content.source_text);
  };

  const handleSaveContent = async () => {
    if (!contentKey.trim() || !sourceText.trim()) {
      alert("Content key and source text are required.");
      return;
    }

    try {
      let result;
      if (selectedContent) {
        result = await updateContent(selectedContent.id, {
          page: selectedContent.page || pageFilter,
          key: contentKey,
          source_text: sourceText,
        });
      } else {
        result = await createContent({
          page: pageFilter,
          key: contentKey,
          source_text: sourceText,
        });
      }

      if (!result.success) {
        throw new Error(result.message || "Failed to save content.");
      }

      await loadContents(pageFilter);
      resetForm();
    } catch (error) {
      console.error("Error saving content:", error);
      alert(error.message || "Unable to save content.");
    }
  };

  const handleDeleteContent = async (contentId) => {
    if (!window.confirm("Delete this content item?")) {
      return;
    }

    try {
      const result = await deleteContent(contentId);
      if (!result.success) {
        throw new Error(result.message || "Failed to delete content.");
      }

      if (selectedContent?.id === contentId) {
        resetForm();
      }

      await loadContents(pageFilter);
    } catch (error) {
      console.error("Error deleting content:", error);
      alert(error.message || "Unable to delete content.");
    }
  };



  const filteredContents = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return contents.filter(
      (item) =>
        item.page.toLowerCase().includes(query) ||
        item.key.toLowerCase().includes(query) ||
        item.source_text.toLowerCase().includes(query)
    );
  }, [contents, searchTerm]);

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[640px] flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Website Content</h1>
          <p className="text-sm text-slate-500 mt-1">
            Content is pulled from your Shopify store. Select an item to edit its text.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <button
            type="button"
            className="btn btn-secondary h-9 gap-2 px-4"
            onClick={handleSyncFromShopify}
            disabled={isSyncing || !["home", "product", "collection"].includes(pageFilter)}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync from Shopify"}
          </button>
          <div className="flex items-end gap-2">
            <input
              type="text"
              placeholder="Import from URL (https://...)"
              className="input-field h-9 min-w-[220px] text-sm"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary h-9 px-3"
              onClick={async () => {
                if (!importUrl.trim()) return alert("Enter a URL to import.");
                setIsImportingUrl(true);
                try {
                  let url = importUrl.trim();
                  if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    url = `https://${url}`;
                  }
                  const fetched = await fetchUrlContent(url);
                  if (!fetched || !fetched.success) {
                    throw new Error(fetched?.message || "Failed to fetch URL content");
                  }

                  const text = fetched.text || "";
                  // Derive a key from the pathname or hostname.
                  let key = url;
                  try {
                    const u = new URL(url);
                    key = (u.pathname && u.pathname !== "/") ? u.pathname.replace(/\//g, "_") : u.hostname;
                  } catch (e) {}

                  const payload = { page: pageFilter || "other", key: key.slice(0, 200), source_text: text };
                  const imported = await importContentToLibrary(payload);
                  if (!imported || !imported.success) throw new Error(imported?.message || "Import failed");

                  await loadContents(pageFilter);
                  setImportUrl("");
                  alert("Imported content from URL.");
                } catch (err) {
                  console.error("Import URL error:", err);
                  alert(err.message || String(err));
                } finally {
                  setIsImportingUrl(false);
                }
              }}
              disabled={isImportingUrl}
            >
              {isImportingUrl ? "Importing..." : "Import URL"}
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Page</label>
            <select
              className="input-field h-9 min-w-[140px]"
              value={pageFilter}
              onChange={(e) => setPageFilter(e.target.value)}
            >
              <option value="home">home</option>
              <option value="product">product</option>
              <option value="checkout">checkout</option>
              <option value="collection">collection</option>
              <option value="other">other</option>
            </select>
          </div>
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
            <Search className="absolute left-2.5 bottom-2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search content..."
              className="input-field pl-9 h-9 text-sm w-full sm:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <Store className="mt-0.5 h-4 w-4 shrink-0 text-[#008060]" />
            <p>
              {storeConnected ? (
                <>
                  Connected to <span className="font-medium text-slate-900">{storeUrl}</span>.
                  {" "}Choose a page and click <span className="font-medium">Sync from Shopify</span> to import product titles, descriptions, pages, and collections.
                </>
              ) : (
                <>
                  No Shopify store connected yet. Go to{" "}
                  <Link to="/store-settings" className="font-medium text-[#008060] hover:text-[#006e52]">
                    Store Settings
                  </Link>
                  {" "}and add your store URL + access token, then sync content here.
                </>
              )}
            </p>
          </div>
        </div>
        {syncMessage && <p className="mt-2 text-[#008060]">{syncMessage}</p>}
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-4">
        {/* Website content */}
        <section className="card-container flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <FileText className="h-4 w-4 text-[#008060]" />
            <div>
              <h2 className="font-semibold text-slate-900">Original Content</h2>
              <p className="text-xs text-slate-500">Select an item to view and edit source text</p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="min-h-0 flex-1 overflow-y-auto border-b border-slate-100 lg:border-b-0 lg:border-r">
              {filteredContents.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {filteredContents.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectContent(item)}
                        className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                          selectedContent?.id === item.id ? "bg-emerald-50/80 ring-1 ring-inset ring-[#008060]/20" : ""
                        }`}
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{item.key}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-700">{item.source_text}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center text-slate-500">
                  <Search className="mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-medium text-slate-900">No content for this page</p>
                  <p className="mt-1 text-sm">
                    {["home", "product", "collection"].includes(pageFilter)
                      ? "Sync from Shopify or connect your store in Store Settings."
                      : "This page type is manual only. Add content yourself or switch to home, product, or collection."}
                  </p>
                </div>
              )}
            </div>

            <div className="flex min-h-0 w-full flex-col lg:w-[52%]">
              {selectedContent ? (
                <div className="flex min-h-0 flex-1 flex-col p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Selected</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedContent.key}</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-medium text-[#c92a2a] hover:text-[#a50e0e]"
                      onClick={() => handleDeleteContent(selectedContent.id)}
                    >
                      Delete
                    </button>
                  </div>

                  <label className="mb-1 block text-xs font-medium text-slate-500">Source text</label>
                  <textarea
                    className="input-field min-h-0 flex-1 resize-none text-sm leading-relaxed"
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                  />

                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-primary flex-1 py-2" onClick={handleSaveContent}>
                      Save changes
                    </button>
                    <button className="btn btn-secondary px-4 py-2" onClick={resetForm} type="button">
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center text-slate-500">
                  <FileText className="mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-medium text-slate-900">No item selected</p>
                  <p className="mt-1 text-sm">Pick content from the list to edit source text.</p>
                </div>
              )}
            </div>
          </div>
        </section>


      </div>
    </div>
  );
}

export default TranslationsPage;
