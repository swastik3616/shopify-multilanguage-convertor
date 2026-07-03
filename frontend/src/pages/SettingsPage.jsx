import { Monitor, Moon, Sun, AlertCircle, Check } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useState } from "react";

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [expandExclusions, setExpandExclusions] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your application preferences and appearance.</p>
      </div>
      
      <div className="card-container p-6 w-full max-w-3xl">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          Appearance
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-900 dark:text-slate-50 block mb-3">
              Theme Preference
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setTheme("light")}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                  theme === "light" 
                    ? "border-[#008060] bg-[#008060]/5 dark:bg-[#008060]/10" 
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900"
                }`}
              >
                <Sun className={`h-6 w-6 mb-2 ${theme === "light" ? "text-[#008060]" : "text-slate-500 dark:text-slate-400"}`} />
                <span className={`text-sm font-medium ${theme === "light" ? "text-[#008060]" : "text-slate-700 dark:text-slate-300"}`}>Light</span>
              </button>
              
              <button
                onClick={() => setTheme("dark")}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                  theme === "dark" 
                    ? "border-[#008060] bg-[#008060]/5 dark:bg-[#008060]/10" 
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900"
                }`}
              >
                <Moon className={`h-6 w-6 mb-2 ${theme === "dark" ? "text-[#008060]" : "text-slate-500 dark:text-slate-400"}`} />
                <span className={`text-sm font-medium ${theme === "dark" ? "text-[#008060]" : "text-slate-700 dark:text-slate-300"}`}>Dark</span>
              </button>
              
              <button
                onClick={() => setTheme("system")}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                  theme === "system" 
                    ? "border-[#008060] bg-[#008060]/5 dark:bg-[#008060]/10" 
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900"
                }`}
              >
                <Monitor className={`h-6 w-6 mb-2 ${theme === "system" ? "text-[#008060]" : "text-slate-500 dark:text-slate-400"}`} />
                <span className={`text-sm font-medium ${theme === "system" ? "text-[#008060]" : "text-slate-700 dark:text-slate-300"}`}>System</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card-container p-6 w-full max-w-3xl">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          Translation Exclusions
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Automatic Protection Active
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-200 mt-1">
                The following content types are automatically excluded from translation across ALL languages:
              </p>
            </div>
          </div>

          <button
            onClick={() => setExpandExclusions(!expandExclusions)}
            className="w-full text-left px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
          >
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {expandExclusions ? "▼ Hide Protected Content Types" : "▶ Show Protected Content Types"}
            </span>
          </button>

          {expandExclusions && (
            <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-2">
                <span className="text-2xl">📧</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Email Addresses</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">contact@example.com, support@store.com</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-2xl">📱</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Phone Numbers</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">+1-800-123-4567, (555) 123-4567</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-2xl">🔗</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">URLs & Links</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">https://example.com, www.mysite.com</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-2xl">🔢</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Numbers & IDs</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">#12345, ID: 98765, Pure numbers</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-2xl">🏷️</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">HTML Tags</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">&lt;div&gt;, &lt;span&gt;, &lt;button&gt;</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                UI Language Always English
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-200 mt-1">
                All control buttons, labels, and interface elements always display in English. Only content (headings, descriptions, text) changes when switching languages.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default SettingsPage;