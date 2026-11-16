
import { useEffect, useMemo, useState } from "react";
import { Settings, ShieldCheck, ShieldAlert, RotateCcw, ChevronDown } from "lucide-react";

const API = "";

const initialForm = {
  amount: "1200",
  merchant: "retail",
  location: "domestic",
  avgTxn: "5000",
  maxTxn: "20000",
  device: "known",
  time: ""
};

function createSession() {
  return window.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem("fraud-session-id");
    if (saved) return saved;
    const id = createSession();
    localStorage.setItem("fraud-session-id", id);
    return id;
  });

  const [form, setForm] = useState(initialForm);
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState({ score: 5, decision: "APPROVED", reasons: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [lastTxnAt, setLastTxnAt] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const requestOptions = {
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId
    }
  };

  const maxSpend = useMemo(() => {
    if (!history.length) return Number(form.maxTxn) || 0;
    return Math.max(...history.map(x => Number(x.amount)), Number(form.maxTxn) || 0);
  }, [history, form.maxTxn]);

  const secondsSinceLast = lastTxnAt == null
    ? null
    : Math.max(0, Math.floor((currentTime - lastTxnAt) / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  async function loadHistory() {
    try {
      const response = await fetch(`${API}/history`, requestOptions);
      if (response.ok) {
        setHistory(await response.json());
      }
    } catch {}
  }

  useEffect(() => {
    loadHistory();
  }, []);

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  async function runCheck(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        amount: Number(form.amount),
        merchant: form.merchant,
        location: form.location,
        avgTxn: Number(form.avgTxn),
        maxTxn: Number(form.maxTxn),
        device: form.device,
        ...(form.time !== "" ? { time: Number(form.time) } : {})
      };

      const response = await fetch(`${API}/check`, {
        ...requestOptions,
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();

      setResult(data);
      setLastTxnAt(Date.now());
      setCurrentTime(Date.now());

      await loadHistory();
    } catch (err) {
      setError(`Could not connect to the fraud API. ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function resetSession() {
    try {
      await fetch(`${API}/reset`, {
        ...requestOptions,
        method: "POST"
      });
    } catch {}

    const fresh = createSession();

    localStorage.setItem("fraud-session-id", fresh);
    setSessionId(fresh);
    setHistory([]);
    setResult({ score: 5, decision: "APPROVED", reasons: [] });
    setLastTxnAt(null);
    setCurrentTime(Date.now());
    setError("");
    setForm(initialForm);
  }

  function chooseDemo(type) {
    const scenarios = {
      stolen: {
        amount: "85000",
        merchant: "crypto",
        location: "international",
        avgTxn: "5000",
        maxTxn: "20000",
        device: "new",
        time: "2"
      },
      rapid: {
        amount: "18000",
        merchant: "gaming",
        location: "domestic",
        avgTxn: "5000",
        maxTxn: "20000",
        device: "new",
        time: "14"
      },
      normal: initialForm
    };

    setForm(scenarios[type]);
    setDemoOpen(false);
  }

  return (
    <div className="page">
      <header className="site-header">
        <div className="site-title">
          <span className="wallet-icon">▣</span>
          Fraud Risk Engine
        </div>

        <button
          className="icon-button"
          title="Settings"
          onClick={() => setSettingsOpen(v => !v)}
        >
          <Settings size={20} />
        </button>
      </header>

      <section className="status-bar">
        <div className="status-items">
          <span>
            Time Since Last Txn:{" "}
            <b>
              {secondsSinceLast == null ? "—" : `${secondsSinceLast}s`}
            </b>
          </span>

          <span>
            Session Txns: <b>{history.length}</b>
          </span>

          <span>
            Max Spend: <b>₹{maxSpend.toLocaleString("en-IN")}</b>
          </span>
        </div>

        <div className="status-actions">
          <span>Device:</span>

          <span className={`device-pill ${form.device === "new" ? "new" : ""}`}>
            {form.device === "new" ? "NEW" : "KNOWN"}
          </span>

          <div className="demo-wrap">
            <button
              className="demo-button"
              onClick={() => setDemoOpen(v => !v)}
            >
              Try Demo Scenarios <ChevronDown size={14} />
            </button>

            {demoOpen && (
              <div className="demo-menu">
                <button onClick={() => chooseDemo("normal")}>
                  Normal transaction
                </button>

                <button onClick={() => chooseDemo("stolen")}>
                  Stolen card scenario
                </button>

                <button onClick={() => chooseDemo("rapid")}>
                  High-risk / rapid scenario
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {settingsOpen && (
        <section className="settings-panel">
          <div className="settings-heading">
            <b>Risk profile settings</b>
            <button onClick={() => setSettingsOpen(false)}>Close</button>
          </div>

          <div className="settings-fields">
            <label>
              Average transaction (₹)
              <input
                type="number"
                min="1"
                value={form.avgTxn}
                onChange={e => update("avgTxn", e.target.value)}
              />
            </label>

            <label>
              Historical maximum (₹)
              <input
                type="number"
                min="1"
                value={form.maxTxn}
                onChange={e => update("maxTxn", e.target.value)}
              />
            </label>

            <label>
              Device trust
              <select
                value={form.device}
                onChange={e => update("device", e.target.value)}
              >
                <option value="known">Known device</option>
                <option value="new">New device</option>
              </select>
            </label>

            <label>
              Transaction hour (0–23)
              <input
                type="number"
                min="0"
                max="23"
                placeholder="Current hour"
                value={form.time}
                onChange={e => update("time", e.target.value)}
              />
            </label>
          </div>
        </section>
      )}

      <main className="main-content">
        <div className="work-area">
          <section className="card input-card">
            <form onSubmit={runCheck}>
              <label className="amount-field">
                <span className="sr-only">Transaction amount</span>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.amount}
                  onChange={e => update("amount", e.target.value)}
                />
              </label>

              <label className="select-field">
                <span>Merchant Type</span>
                <select
                  value={form.merchant}
                  onChange={e => update("merchant", e.target.value)}
                >
                  <option value="retail">Groceries &amp; Retail (Low Risk)</option>
                  <option value="travel">Travel</option>
                  <option value="crypto">Cryptocurrency (High Risk)</option>
                  <option value="gaming">Gaming (High Risk)</option>
                  <option value="jewelry">Jewellery (High Risk)</option>
                </select>
              </label>

              <label className="select-field">
                <span>Location</span>
                <select
                  value={form.location}
                  onChange={e => update("location", e.target.value)}
                >
                  <option value="domestic">Home Area</option>
                  <option value="international">International</option>
                </select>
              </label>

              <button className="run-button" disabled={loading}>
                {loading ? "Evaluating…" : "Run Fraud Check"}
              </button>

              {error && <p className="error-message">{error}</p>}
            </form>
          </section>

          <section className="card risk-card">
            <h2>Risk Meter</h2>

            <div className="meter">
              <div
                className={`meter-fill ${result.decision === "DECLINED" ? "danger" : ""}`}
                style={{ width: `${result.score}%` }}
              />
            </div>

            <div className="score-text">
              Score: {result.score} / 100
            </div>

            <div className="decision-line">
              Decision:{" "}
              <span className={`decision-pill ${result.decision.toLowerCase()}`}>
                {result.decision}
              </span>
            </div>

            <h3>Triggered Rules</h3>

            {result.reasons?.length ? (
              <ul className="trigger-list">
                {result.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            ) : (
              <div className="safe-message">
                <ShieldCheck size={15} />
                All security checks passed. No anomalies detected.
              </div>
            )}
          </section>
        </div>

        <section className="card history-card">
          <div className="history-heading">
            <h2>Transaction History</h2>

            <button className="reset-button" onClick={resetSession}>
              <RotateCcw size={14} /> Reset
            </button>
          </div>

          {history.length === 0 ? (
            <div className="empty-history">
              No transactions yet. Run a fraud check to see the history.
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Amount</th>
                    <th>Merchant</th>
                    <th>Score</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((item, i) => (
                    <tr key={`${item.time}-${i}`}>
                      <td>{item.time}</td>
                      <td>₹{Number(item.amount).toLocaleString("en-IN")}</td>
                      <td>{item.merchant}</td>
                      <td>{item.score}</td>
                      <td>
                        <span className={`decision-pill ${item.decision.toLowerCase()}`}>
                          {item.decision}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <footer className="footer-note">
        Rule-based transaction risk assessment · Demonstration only
      </footer>
    </div>
  );
}
