import { Hammer } from "lucide-react";

function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Settings</h1>
      <div className="card-container p-12 flex flex-col items-center justify-center text-center max-w-3xl mx-auto w-full mt-8">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <Hammer className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Under Construction</h2>
        <p className="text-slate-500 max-w-md">This feature is currently being built and will be available in a future update.</p>
      </div>
    </div>
  );
}
export default SettingsPage;