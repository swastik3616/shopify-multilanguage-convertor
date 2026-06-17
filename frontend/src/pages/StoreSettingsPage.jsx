import { useState } from "react";
import { saveStoreSettings, checkShopifyToken } from "../services/storeSettingsService";

function StoreSettingsPage() {
  const [storeUrl, setStoreUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const handleSave = async () => {
    try {
      const response = await saveStoreSettings({
        store_url: storeUrl,
        access_token: accessToken,
      });

      alert(response.message);
      // auto-validate after save
      try {
        const check = await checkShopifyToken();
        if (check && check.connected) {
          alert("Token validated: OK");
        } else {
          alert(`Token validation failed: ${check?.message || JSON.stringify(check?.response) || 'unknown'}`);
        }
      } catch (err) {
        console.error("Validation after save failed:", err);
        alert(`Validation after save failed: ${err.message || err}`);
      }
    } catch (error) {
      console.error(error);
      alert(`Failed to save store settings: ${error.message || error}`);
    }
  };

  const handleValidate = async () => {
    try {
      const result = await checkShopifyToken();
      if (result && result.connected) {
        alert("Token is valid — connected to store: " + (result.store_url || ""));
      } else {
        alert("Token validation failed: " + (result?.message || JSON.stringify(result?.response) || "Unknown"));
      }
    } catch (err) {
      console.error(err);
      alert(`Token validation request failed: ${err.message || err}`);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Store Settings</h1>
      </div>

      <div className="card-container flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-1">Connection Details</h3>
          <p className="text-sm text-slate-500">Use your store hostname only, without https:// (e.g. mystore.myshopify.com).</p>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Store URL</label>
            <input
              type="text"
              placeholder="translator-test-store.myshopify.com"
              className="input-field w-full md:max-w-md"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Access Token</label>
            <input
              type="password"
              placeholder="Enter Access Token"
              className="input-field w-full md:max-w-md font-mono"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
          <div className="flex gap-3">
            <button className="btn btn-secondary px-4 py-2" onClick={handleValidate}>
              Validate Token
            </button>
            <button className="btn btn-primary px-6 py-2" onClick={handleSave}>
              Save Store Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StoreSettingsPage;