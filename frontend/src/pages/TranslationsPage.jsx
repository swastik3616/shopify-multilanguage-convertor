import { useState, useEffect } from "react";
import { translateText } from "../services/translationService";
import { getTranslations } from "../services/translationHistoryService";

function TranslationsPage() {
const [sourceText, setSourceText] = useState("");
const [targetLanguage, setTargetLanguage] = useState("Hindi");
const [translatedText, setTranslatedText] = useState("");
const [history, setHistory] = useState([]);
const [editingIndex, setEditingIndex] = useState(null);

const [searchTerm, setSearchTerm] = useState("");
const [filterLanguage, setFilterLanguage] = useState("All");

const loadTranslations = async () => {
try {
const data = await getTranslations();
setHistory(data);
} catch (error) {
console.error("Error loading translations:", error);
}
};

useEffect(() => {
  let mounted = true;

  (async () => {
    try {
      const data = await getTranslations();
      if (mounted) setHistory(data);
    } catch (error) {
      console.error("Error loading translations:", error);
    }
  })();

  return () => {
    mounted = false;
  };
}, []);

const handleTranslate = async () => {
try {
const response = await translateText({
source_text: sourceText,
target_language: targetLanguage,
});



  setTranslatedText(response.translated_text);

  await loadTranslations();
} catch (error) {
  console.error("Translation failed:", error);
}

};

const handleSaveChanges = () => {
if (editingIndex === null) return;


const updatedHistory = [...history];

updatedHistory[editingIndex] = {
  ...updatedHistory[editingIndex],
  source_text: sourceText,
  target_language: targetLanguage,
  translated_text: translatedText,
};

setHistory(updatedHistory);
setEditingIndex(null);

alert("Translation updated successfully");


};

const filteredHistory = history.filter((item) => {
const matchesSearch =
item.source_text
.toLowerCase()
.includes(searchTerm.toLowerCase()) ||
item.translated_text
.toLowerCase()
.includes(searchTerm.toLowerCase());

const matchesLanguage =
  filterLanguage === "All" ||
  item.target_language === filterLanguage;

return matchesSearch && matchesLanguage;


});

return ( <div> <h1>Translations</h1>
  <br />

  <div className="card">
    <h3>Source Text</h3>

    <textarea
      rows="6"
      value={sourceText}
      onChange={(e) => setSourceText(e.target.value)}
      placeholder="Enter text to translate"
    />

    <br />
    <br />

    <h3>Target Language</h3>

    <select
      value={targetLanguage}
      onChange={(e) => setTargetLanguage(e.target.value)}
    >
      <option>Hindi</option>
      <option>Marathi</option>
      <option>French</option>
      <option>German</option>
    </select>

    <br />
    <br />

    <button onClick={handleTranslate}>
      Translate
    </button>

    {editingIndex !== null && (
      <>
        <br />
        <br />
        <button onClick={handleSaveChanges}>
          Save Changes
        </button>
      </>
    )}

    <br />
    <br />

    <h3>Translated Output</h3>

    <textarea
      rows="6"
      value={translatedText}
      onChange={(e) => setTranslatedText(e.target.value)}
    />

    <br />
    <br />

    <h3>Translation History</h3>

    <input
      type="text"
      placeholder="Search translations..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />

    <br />
    <br />

    <select
      value={filterLanguage}
      onChange={(e) => setFilterLanguage(e.target.value)}
    >
      <option>All</option>
      <option>Hindi</option>
      <option>Marathi</option>
      <option>French</option>
      <option>German</option>
    </select>

    <br />
    <br />

    <table className="translation-table">
      <thead>
        <tr>
          <th>Source</th>
          <th>Language</th>
          <th>Translation</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
        {filteredHistory.length > 0 ? (
          filteredHistory.map((item, index) => (
            <tr key={index}>
              <td>{item.source_text}</td>
              <td>{item.target_language}</td>
              <td>{item.translated_text}</td>
              <td>
                <button
                  onClick={() => {
                    setEditingIndex(index);
                    setSourceText(item.source_text);
                    setTargetLanguage(item.target_language);
                    setTranslatedText(item.translated_text);
                  }}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="4">
              No translations available
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>


);
}

export default TranslationsPage;
