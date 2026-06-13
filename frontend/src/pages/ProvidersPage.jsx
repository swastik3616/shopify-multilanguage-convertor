import { useState, useEffect } from "react";
import { saveProvider, getProviderSettings } from "../services/providerService";

const PROVIDER_MODELS = {
  openai: ["gpt-3.5-turbo", "gpt-4", "gpt-4o"],
  gemini: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"],
  claude: ["claude-3-haiku-20240307", "claude-3-sonnet-20240229", "claude-3-opus-20240229"],
  groq: ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768"],
  ollama: ["llama3", "mistral", "gemma"]
};

function ProvidersPage() {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-3.5-turbo");
  const [apiKeys, setApiKeys] = useState({
    openai: "",
    gemini: "",
    claude: "",
    groq: "",
    ollama: ""
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const settings = await getProviderSettings();
        if (isMounted) {
          if (settings.provider) setProvider(settings.provider);
          if (settings.model) setModel(settings.model);
          if (settings.api_keys) setApiKeys(settings.api_keys);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to fetch provider settings", error);
        setIsLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    setProvider(newProvider);
    setModel(PROVIDER_MODELS[newProvider][0]);
  };

  const handleApiKeyChange = (e) => {
    setApiKeys({
      ...apiKeys,
      [provider]: e.target.value
    });
  };

  const handleSave = async () => {
    try {
      const response = await saveProvider({
        provider,
        model,
        api_key: apiKeys[provider] || "",
      });
      alert(response.message);
    } catch (error) {
      console.error(error);
      alert("Failed to save provider");
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading settings...</div>;
  }

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
              onChange={handleProviderChange}
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="claude">Claude</option>
              <option value="groq">Groq</option>
              <option value="ollama">Ollama (Local)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Model</label>
            <select
              className="input-field w-full md:max-w-md"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {PROVIDER_MODELS[provider]?.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">API Key ({provider})</label>
            <input
              type="password"
              placeholder={provider === "ollama" ? "Not required for default Ollama" : `Enter ${provider} API Key`}
              className="input-field w-full md:max-w-md font-mono"
              value={apiKeys[provider] || ""}
              onChange={handleApiKeyChange}
              disabled={provider === "ollama"}
            />
            <p className="text-xs text-slate-500 mt-2">
              {provider === "ollama" ? "Ollama generally uses the local endpoint without an API key." : "Your API key is securely encrypted."}
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
          <button className="btn btn-primary px-6 py-2" onClick={handleSave}>
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProvidersPage;