import { useEffect, useState } from "react";
import { getAuditHistory } from "../services/auditService";

function AuditHistoryPage() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const data = await getAuditHistory();
        setLogs(data);
      } catch (error) {
        console.error(error);
      }
    };

    loadLogs();
  }, []);

  return (
    <div>
      <h1>Audit History</h1>

      <div className="card">
        <table className="translation-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Action</th>
              <th>Timestamp</th>
            </tr>
          </thead>

          <tbody>
            {logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td>{log.action}</td>
                  <td>{log.created_at}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3">
                  No audit history available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AuditHistoryPage;