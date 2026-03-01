import { useState, useEffect } from "react";

const API = "http://localhost:8000";

export default function History() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/history`);
      setRecords(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function expand(id) {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    try {
      const res = await fetch(`${API}/history/${id}`);
      setDetail(await res.json());
    } catch {
      setDetail(null);
    }
  }

  async function deleteRecord(id, e) {
    e.stopPropagation();
    if (!confirm("Delete this diagnosis record?")) return;
    await fetch(`${API}/history/${id}`, { method: "DELETE" });
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
    }
  }

  const severityFor = (prediction) => {
    const high = ["Melanoma", "Basal cell carcinoma"];
    const med = ["Actinic keratoses"];
    if (high.includes(prediction)) return "high";
    if (med.includes(prediction)) return "medium";
    return "low";
  };

  if (loading) {
    return (
      <div className="history-empty">
        <span className="spinner" style={{ borderTopColor: "var(--accent)" }} />
        <p>Loading history...</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="history-empty">
        <svg width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.3 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3>No history yet</h3>
        <p>Your diagnosis records will appear here after you analyze an image.</p>
      </div>
    );
  }

  return (
    <div className="history-list">
      {records.map((r) => (
        <div key={r.id} className={`history-card ${expanded === r.id ? "expanded" : ""}`}>
          <div className="history-card-header" onClick={() => expand(r.id)}>
            <img
              src={`${API}/history/${r.id}/image`}
              alt="Lesion"
              className="history-thumb"
            />
            <div className="history-meta">
              <div className="history-prediction">{r.prediction}</div>
              <div className="history-date">
                {new Date(r.created_at).toLocaleDateString(undefined, {
                  year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </div>
            </div>
            <div className={`confidence-badge severity-${severityFor(r.prediction)}`}>
              {(r.confidence * 100).toFixed(0)}%
            </div>
            <button className="history-delete" onClick={(e) => deleteRecord(r.id, e)} title="Delete">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {expanded === r.id && detail && (
            <div className="history-detail">
              <div className="history-detail-image">
                <img src={`data:image/jpeg;base64,${detail.image_base64}`} alt="Full" />
              </div>
              <div className="history-scores">
                <h4>Class Probabilities</h4>
                {Object.entries(detail.all_scores)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, score], i) => (
                    <div className="history-score-row" key={name}>
                      <span className="score-name">{name}</span>
                      <div className="bar-bg">
                        <div
                          className={`bar ${i === 0 ? "bar-top" : ""}`}
                          style={{ width: `${score * 100}%` }}
                        />
                      </div>
                      <span className="score-pct">{(score * 100).toFixed(1)}%</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
