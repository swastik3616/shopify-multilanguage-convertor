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
    <div>
      <h1>Providers</h1>

      <br />

      <div className="card">
        <h3>Translation Provider</h3>

        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="openai">OpenAI</option>
          <option value="google">Google Translate</option>
          <option value="microsoft">Microsoft Translator</option>
          <option value="bhashini">Bhashini</option>
        </select>

        <br />
        <br />

        <h3>API Key</h3>

        <input
          type="password"
          placeholder="Enter API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />

        <br />
        <br />

        <button onClick={handleSave}>
          Save Provider
        </button>
      </div>
    </div>
  );
}

export default ProvidersPage;