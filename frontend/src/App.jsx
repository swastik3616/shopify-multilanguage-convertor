import { useState } from "react";

function App() {
  const [sourceLanguage, setSourceLanguage] = useState("English");

  const [targetLanguages, setTargetLanguages] = useState([]);

  const handleCheckbox = (language) => {
    if (targetLanguages.includes(language)) {
      setTargetLanguages(
        targetLanguages.filter((item) => item !== language)
      );
    } else {
      setTargetLanguages([...targetLanguages, language]);
    }
  };

  const saveLanguages = async () => {
    const response = await fetch(
      "http://localhost:5000/save-languages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source_language: sourceLanguage,
          target_languages: targetLanguages
        })
      }
    );

    const data = await response.json();

    alert(data.message);
  };

  return (
    <div style={{ padding: "30px" }}>
      <h1>Shopify Translator</h1>

      <h3>Source Language</h3>

      <select
        value={sourceLanguage}
        onChange={(e) => setSourceLanguage(e.target.value)}
      >
        <option>English</option>
        <option>Hindi</option>
      </select>

      <h3>Target Languages</h3>

      <label>
        <input
          type="checkbox"
          onChange={() => handleCheckbox("Hindi")}
        />
        Hindi
      </label>

      <br />

      <label>
        <input
          type="checkbox"
          onChange={() => handleCheckbox("Marathi")}
        />
        Marathi
      </label>

      <br />

      <label>
        <input
          type="checkbox"
          onChange={() => handleCheckbox("French")}
        />
        French
      </label>

      <br /><br />

      <button onClick={saveLanguages}>
        Save Settings
      </button>
    </div>
  );
}

export default App;