import { useState } from "react";
import { saveLanguages } from "../services/languageService";

function LanguagesPage() {
  const [sourceLanguage, setSourceLanguage] = useState("English");

  const [targetLanguages, setTargetLanguages] = useState([]);

  const handleLanguageChange = (language) => {
    if (targetLanguages.includes(language)) {
      setTargetLanguages(
        targetLanguages.filter((item) => item !== language)
      );
    } else {
      setTargetLanguages([...targetLanguages, language]);
    }
  };

const handleSave = async () => {
  try {
    const response = await saveLanguages({
      source_language: sourceLanguage,
      target_languages: targetLanguages,
    });

    alert(response.message);
  } catch (error) {
    console.error(error);
    alert("Failed to save settings");
  }
};


  return (
    <div>
      <h1>Languages</h1>

      <br />

      <div className="card">
        <h3>Source Language</h3>

        <select
          value={sourceLanguage}
          onChange={(e) => setSourceLanguage(e.target.value)}
        >
          <option>English</option>
          <option>Hindi</option>
          <option>French</option>
        </select>

        <br />
        <br />

        <h3>Target Languages</h3>

        <label>
          <input
            type="checkbox"
            onChange={() => handleLanguageChange("Hindi")}
          />
          Hindi
        </label>

        <br />

        <label>
          <input
            type="checkbox"
            onChange={() => handleLanguageChange("Marathi")}
          />
          Marathi
        </label>

        <br />

        <label>
          <input
            type="checkbox"
            onChange={() => handleLanguageChange("French")}
          />
          French
        </label>

        <br />

        <label>
          <input
            type="checkbox"
            onChange={() => handleLanguageChange("German")}
          />
          German
        </label>

        <br />
        <br />

        <button onClick={handleSave}>Save Settings</button>
      </div>
    </div>
  );
}

export default LanguagesPage;