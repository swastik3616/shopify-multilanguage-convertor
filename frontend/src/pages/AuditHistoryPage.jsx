import { useEffect, useState } from "react";
import { getAuditHistory } from "../services/auditService";

function AuditHistoryPage() {
  const [logs, setLogs] = useState([]);
  const [overview, setOverview] = useState([]);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const data = await getAuditHistory();
        if (data && data.logs) {
          setLogs(data.logs);
          setOverview(data.overview || []);
        } else if (Array.isArray(data)) {
          setLogs(data);
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadLogs();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Audit History</h1>
      </div>

      <div className="card-container p-6 mb-2">
        <h3 className="font-semibold text-slate-900 mb-6">Language Usage Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {overview.length > 0 ? (
            overview.map((stat, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-100 p-5 rounded-lg flex flex-col items-center justify-center text-center shadow-sm">
                <span className="text-3xl font-bold text-emerald-600 mb-1">{stat.count}</span>
                <span className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{stat.language}</span>
                <span className="text-xs text-slate-400 mt-1">translations generated</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 col-span-full">No translation data available yet.</p>
          )}
        </div>
      </div>

      <div className="card-container flex flex-col">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-semibold text-slate-900">Activity Logs</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-900 font-medium">{log.id}</td>
                    <td className="px-6 py-4 text-slate-700">{log.action}</td>
                    <td className="px-6 py-4 text-slate-500">{log.created_at}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="px-6 py-12 text-center text-slate-500">
                    No audit history available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AuditHistoryPage;