import { useEffect, useState } from "react";
import { getAnalytics } from "../services/analyticsService";

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
    return <h2>Loading...</h2>;
  }

  return (
    <div>
      <h1>Analytics Dashboard</h1>

      <div className="analytics-grid">

        <div className="card">
          <h3>Total Translations</h3>
          <h2>{analytics.total_translations}</h2>
        </div>

        <div className="card">
          <h3>Total Languages</h3>
          <h2>{analytics.total_languages}</h2>
        </div>

        <div className="card">
          <h3>Provider</h3>
          <h2>{analytics.provider}</h2>
        </div>

        <div className="card">
          <h3>Last Translation</h3>
          {typeof analytics.last_translation === "string" ? (
            <p>{analytics.last_translation}</p>
          ) : (
            <div>
              <p><strong>Source:</strong> {analytics.last_translation.source_text}</p>
              <p><strong>Language:</strong> {analytics.last_translation.target_language}</p>
              <p><strong>Translation:</strong> {analytics.last_translation.translated_text}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default AnalyticsPage;