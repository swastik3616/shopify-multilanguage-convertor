import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

function SettingsPage() {
  const { theme, setTheme } = useTheme();

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
    </div>
  );
}
export default SettingsPage;