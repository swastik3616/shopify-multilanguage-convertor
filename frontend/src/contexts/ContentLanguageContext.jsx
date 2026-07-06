import React, { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "../services/apiClient";

const ContentLanguageContext = createContext();

export function ContentLanguageProvider({ children }) {
  const [contentLanguage, setContentLanguage] = useState(() => {
    // Load from localStorage if available
    return localStorage.getItem("content_language") || "English";
  });

  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load available languages on mount
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await apiFetch("/get-languages");
        const data = await response.json();
        if (data.targets) {
          setAvailableLanguages(data.targets);
        }
      } catch (error) {
        console.error("Failed to load available languages:", error);
      } finally {
        setLoading(false);
      }
    };

    loadLanguages();
  }, []);

  const changeContentLanguage = (language) => {
    setContentLanguage(language);
    localStorage.setItem("content_language", language);
  };

  const value = {
    contentLanguage,
    setContentLanguage: changeContentLanguage,
    availableLanguages,
    loading,
  };

  return (
    <ContentLanguageContext.Provider value={value}>
      {children}
    </ContentLanguageContext.Provider>
  );
}

export const useContentLanguage = () => {
  const context = useContext(ContentLanguageContext);

  if (context === undefined) {
    throw new Error(
      "useContentLanguage must be used within a ContentLanguageProvider"
    );
  }

  return context;
};
