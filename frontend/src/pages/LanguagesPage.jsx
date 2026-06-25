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
    <div className="flex flex-col gap-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Languages</h1>
      </div>

      <div className="card-container flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-1">Language Settings</h3>
          <p className="text-sm text-slate-500">Configure your source and target languages for translation.</p>
        </div>
        
        <div className="p-6 flex flex-col gap-8">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Source Language</label>
            <select
              className="input-field w-full md:max-w-md"
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
            >
              <option>English</option>
              <option>French</option>
              <option>German</option>
              <option>Spanish</option>
              <option>Hindi</option>
              <option>Japanese</option>
            </select>
            <p className="text-xs text-slate-500 mt-2">The default language of your store.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Target Languages</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {["French", "German", "Spanish", "Hindi", "Arabic", "Japanese", "Portuguese", "Marathi", "Italian", "Chinese", "Korean"].map((lang) => (
                <label key={lang} className="relative flex items-start p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-[#008060] border-slate-300 rounded focus:ring-[#008060]"
                      checked={targetLanguages.includes(lang)}
                      onChange={() => handleLanguageChange(lang)}
                    />
                  </div>
                  <div className="ml-3 flex flex-col">
                    <span className="text-sm font-medium text-slate-900">{lang}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
          <button className="btn btn-primary px-6 py-2" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default LanguagesPage;