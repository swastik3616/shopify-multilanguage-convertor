import { useState } from "react";
import { saveStoreSettings } from "../services/storeSettingsService";

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
    } catch (error) {
      console.error(error);
      alert("Failed to save store settings");
    }
  };

  return (
    <div>
      <h1>Store Settings</h1>

      <br />

      <div className="card">
        <h3>Store URL</h3>

        <input
          type="text"
          placeholder="mystore.myshopify.com"
          value={storeUrl}
          onChange={(e) => setStoreUrl(e.target.value)}
        />

        <br />
        <br />

        <h3>Access Token</h3>

        <input
          type="password"
          placeholder="Enter Access Token"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
        />

        <br />
        <br />

        <button onClick={handleSave}>
          Save Store Settings
        </button>
      </div>
    </div>
  );
}

export default StoreSettingsPage;