import { useState } from "react";
import { saveProvider } from "../services/providerService";

function ProvidersPage() {
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");

  const handleSave = async () => {
    try {
      const response = await saveProvider({
        provider,
        api_key: apiKey,
      });

      alert(response.message);
    } catch (error) {
      console.error(error);
      alert("Failed to save provider");
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Providers</h1>
      </div>

      <div className="card-container flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-1">Translation Provider</h3>
          <p className="text-sm text-slate-500">Choose the AI model you want to use for translations.</p>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Provider</label>
            <select
              className="input-field w-full md:max-w-md"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="openai">OpenAI</option>
              <option value="google">Google Translate</option>
              <option value="microsoft">Microsoft Translator</option>
              <option value="bhashini">Bhashini</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">API Key</label>
            <input
              type="password"
              placeholder="Enter API Key"
              className="input-field w-full md:max-w-md font-mono"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-2">Your API key is securely encrypted.</p>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
          <button className="btn btn-primary px-6 py-2" onClick={handleSave}>
            Save Provider
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProvidersPage;