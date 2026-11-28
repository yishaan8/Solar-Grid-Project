import { useEffect, useState } from "react";
import "./SettingsView.css";
import {
  Server,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  UserCheck,
  Database,
} from "lucide-react";
import { apiFetch, fetchHealth } from "../api/client";
import { useAuth } from "../context/AuthContext";

function SettingsView() {
  const { user } = useAuth();
  const [health, setHealth] = useState(null);
  const [dbHealth, setDbHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const apiBase =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      const [healthRes, dbRes] = await Promise.all([
        fetchHealth(),
        apiFetch("/api/db-health"),
      ]);

      if (cancelled) return;

      setHealth(healthRes.error ? null : healthRes.data);
      setDbHealth(dbRes.error ? null : dbRes.data);
      setLoading(false);
    }

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshTick((tick) => tick + 1);
  };

  const apiConnected = health?.status === "ok";
  const dbConnected = Boolean(dbHealth?.connected);

  return (
    <section className="settings-page">
      <header className="settings-hero">
        <div className="settings-hero-copy">
          <span className="settings-eyebrow">SYSTEM & WORKSPACE</span>
          <h1>Platform settings</h1>
          <p>
            Review API connectivity, database status, and active operator
            session details.
          </p>
        </div>
        <div className="settings-sun" aria-hidden="true" />
      </header>

      <div className="settings-toolbar">
        <div className="settings-status-pill">
          <Server size={13} />
          <span>Backend endpoint: {apiBase}</span>
        </div>

        <button
          type="button"
          className="settings-btn"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw size={14} />
          {loading ? "Checking status…" : "Refresh status"}
        </button>
      </div>

      <div className="settings-grid">
        <article className="settings-card">
          <div className="settings-card-header">
            <div>
              <span className="settings-section-eyebrow">CONNECTIVITY</span>
              <h3>Backend & database health</h3>
              <p>Live status of the SolarGrid API and MongoDB Atlas.</p>
            </div>
            <div className="settings-icon">
              <Database size={18} />
            </div>
          </div>

          <div className="settings-row">
            <span>API service</span>
            <span className={`settings-badge ${apiConnected ? "ok" : "warn"}`}>
              {apiConnected ? (
                <>
                  <CheckCircle2 size={13} />
                  Connected
                </>
              ) : (
                <>
                  <AlertCircle size={13} />
                  {loading ? "Checking…" : "Unavailable"}
                </>
              )}
            </span>
          </div>

          <div className="settings-row">
            <span>Database</span>
            <span className={`settings-badge ${dbConnected ? "ok" : "warn"}`}>
              {dbConnected ? (
                <>
                  <CheckCircle2 size={13} />
                  {dbHealth?.database || "MongoDB"} healthy
                </>
              ) : (
                <>
                  <AlertCircle size={13} />
                  {loading ? "Checking…" : "Unavailable"}
                </>
              )}
            </span>
          </div>

          <div className="settings-row">
            <span>Forecasting engine</span>
            <strong>
              {health?.model_loaded ? "Ready" : loading ? "Checking…" : "Unavailable"}
            </strong>
          </div>

          <div className="settings-row">
            <span>API base URL</span>
            <strong>{apiBase}</strong>
          </div>
        </article>

        <article className="settings-card">
          <div className="settings-card-header">
            <div>
              <span className="settings-section-eyebrow">OPERATOR SESSION</span>
              <h3>Account & data mode</h3>
              <p>Current signed-in operator and plant telemetry mode.</p>
            </div>
            <div className="settings-icon blue">
              <UserCheck size={18} />
            </div>
          </div>

          <div className="settings-row">
            <span>Signed-in operator</span>
            <strong>{user?.name || "Operator"}</strong>
          </div>

          <div className="settings-row">
            <span>Email</span>
            <strong>{user?.email || "—"}</strong>
          </div>

          <div className="settings-row">
            <span>Telemetry source</span>
            <strong>Historical CSV datasets</strong>
          </div>

          <div className="settings-row">
            <span>Live IoT sensors</span>
            <strong>Not connected</strong>
          </div>
        </article>
      </div>
    </section>
  );
}

export default SettingsView;
