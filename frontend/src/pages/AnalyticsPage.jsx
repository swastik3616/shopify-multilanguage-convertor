import { useEffect, useState } from "react";
import { getAnalytics } from "../services/analyticsService";
import StatCard from "../components/StatCard";
import { Languages, ArrowRightLeft, Cpu, Clock } from "lucide-react";

const getLanguageName = (code) => {
  if (!code) return "";
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code);
  } catch (e) {
    return code;
  }
};

function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      const data = await getAnalytics();
      setAnalytics(data);
    };

    loadAnalytics();
  }, []);

  if (!analytics) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Analytics Dashboard</h1>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#008060] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Analytics Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Translations" 
          value={analytics.total_translations} 
          icon={ArrowRightLeft} 
        />
        <StatCard 
          title="Total Languages" 
          value={analytics.total_languages} 
          icon={Languages} 
        />
        <StatCard 
          title="Active Provider" 
          value={analytics.provider} 
          icon={Cpu} 
          trend="Connected"
        />
        <StatCard 
          title="Status" 
          value="Healthy" 
          icon={Clock} 
        />
      </div>

      <div className="card-container p-6">
          <h3 className="font-semibold text-slate-900 mb-6">Last Translation Details</h3>
          
          <div className="bg-slate-50 rounded-lg p-6 border border-slate-100">
            {typeof analytics.last_translation === "string" ? (
              <p className="text-slate-600">{analytics.last_translation}</p>
            ) : (
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Source Language: {analytics.last_translation.source_language ? getLanguageName(analytics.last_translation.source_language) : 'Auto'}
                  </span>
                  <div className="bg-white border border-slate-200 rounded-md p-4 min-h-[100px]">
                    <p className="text-slate-800">{analytics.last_translation.source_text}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-center px-4">
                  <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-3 whitespace-nowrap">
                    <span>{analytics.last_translation.source_language ? getLanguageName(analytics.last_translation.source_language) : 'Auto'}</span>
                    <ArrowRightLeft className="h-4 w-4" />
                    <span>{getLanguageName(analytics.last_translation.target_language)}</span>
                  </div>
                </div>

                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Translation Language: {getLanguageName(analytics.last_translation.target_language)}
                  </span>
                  <div className="bg-[#f2fcf9] border border-[#b2e5d5] rounded-md p-4 min-h-[100px]">
                    <p className="text-[#006e52]">{analytics.last_translation.translated_text}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;