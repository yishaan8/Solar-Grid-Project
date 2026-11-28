import { useEffect, useMemo, useState } from "react";
import "./ReportsView.css";
import {
  Download,
  Calendar,
  Zap,
  Activity,
  AlertTriangle,
  RefreshCw,
  Printer,
  Clock3,
  Sun,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { fetchDashboard, fetchFarmAnomalies } from "../api/client";

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getAnomalyRecommendation(record) {
  const irr = Number(record.irradiation);
  const power = Number(record.actual_ac_power);
  const score = Number(record.anomaly_score);
  const isHighPriority = Number.isFinite(score) && score < -0.05;

  if (Number.isFinite(irr) && irr > 0.2 && (!Number.isFinite(power) || power <= 100)) {
    return {
      priority: "High priority",
      tone: "high",
      title: "Possible generation drop during daylight",
      action:
        "Inspect inverter trip logs, DC disconnects, and array shading during this irradiance window.",
    };
  }

  if (Number.isFinite(irr) && irr > 0.5) {
    return {
      priority: isHighPriority ? "High priority" : "Review",
      tone: isHighPriority ? "high" : "review",
      title: "Peak-irradiance output deviation",
      action:
        "Check inverter thermal derating, module temperature, and grid export/curtailment records.",
    };
  }

  if (Number.isFinite(irr) && irr <= 0.05) {
    return {
      priority: "Low priority",
      tone: "low",
      title: "Low-light or off-hours reading",
      action:
        "Verify inverter standby behavior and weather-sensor clock alignment.",
    };
  }

  return {
    priority: isHighPriority ? "High priority" : "Review",
    tone: isHighPriority ? "high" : "review",
    title: "Transition-period output variance",
    action:
      "Review cloud-cover transients and morning/evening inverter startup timing.",
  };
}

function ReportsView({ selectedPlant = 1 }) {
  const plant = Number(selectedPlant) === 2 ? 2 : 1;
  const plantLabel = plant === 2 ? "Solar Farm 02" : "Solar Farm 01";

  const [dashboard, setDashboard] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchReport() {
      const [dashRes, anomRes] = await Promise.all([
        fetchDashboard(plant),
        fetchFarmAnomalies(plant, 100),
      ]);

      if (cancelled) return;

      if (dashRes.error) {
        setError(dashRes.error);
        setDashboard(null);
        setAnomalies(null);
        setLoading(false);
        return;
      }

      setError(null);
      setDashboard(dashRes.data);
      setAnomalies(anomRes.error ? null : anomRes.data);
      setLoading(false);
    }

    fetchReport();
    return () => {
      cancelled = true;
    };
  }, [plant, refreshTick]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshTick((tick) => tick + 1);
  };

  const activePlant = dashboard?.active_plant || null;
  const weather = activePlant?.latest_weather || {};

  const chartStats = useMemo(() => {
    const rows = Array.isArray(activePlant?.generation_chart)
      ? activePlant.generation_chart
      : [];
    const actuals = rows
      .map((r) => Number(r.actual_ac_power ?? r.ac_power))
      .filter((v) => Number.isFinite(v));
    const expected = rows
      .map((r) => Number(r.predicted_ac_power))
      .filter((v) => Number.isFinite(v));

    return {
      rows,
      peak: actuals.length ? Math.max(...actuals) : null,
      average: actuals.length
        ? actuals.reduce((sum, v) => sum + v, 0) / actuals.length
        : null,
      expectedAverage: expected.length
        ? expected.reduce((sum, v) => sum + v, 0) / expected.length
        : null,
    };
  }, [activePlant]);

  const recommendations = useMemo(() => {
    const records = anomalies?.records || [];
    return records.map((record) => ({
      ...record,
      recommendation: getAnomalyRecommendation(record),
    }));
  }, [anomalies]);

  const handleExportCsv = () => {
    if (!chartStats.rows.length) return;

    const header = "timestamp,actual_ac_power,predicted_ac_power,irradiation";
    const lines = chartStats.rows.map((row) =>
      [
        row.timestamp ?? "",
        row.actual_ac_power ?? row.ac_power ?? "",
        row.predicted_ac_power ?? "",
        row.irradiation ?? "",
      ].join(",")
    );

    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `solargrid_plant${plant}_operations_report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="reports-page">
      <header className="reports-hero">
        <div className="reports-hero-copy">
          <span className="reports-eyebrow">OPERATIONS REPORTING</span>
          <h1>{plantLabel} — Operations Report</h1>
          <p>
            Generation summary, weather context, and recommended inspection
            actions for Plant {plant}.
          </p>
        </div>
        <div className="reports-sun" aria-hidden="true" />
      </header>

      <div className="reports-toolbar">
        <div className="reports-status-pill">
          <Clock3 size={13} />
          <span>Plant {plant} · Historical data</span>
        </div>

        <div className="reports-actions">
          <button
            type="button"
            className="reports-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={14} />
            Refresh
          </button>

          <button
            type="button"
            className="reports-btn"
            onClick={() => window.print()}
            disabled={loading || !activePlant}
          >
            <Printer size={14} />
            Print
          </button>

          <button
            type="button"
            className="reports-btn primary"
            onClick={handleExportCsv}
            disabled={loading || !chartStats.rows.length}
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="reports-state">Loading operations report…</div>
      ) : error ? (
        <div className="reports-state">
          Unable to load report data: {error}
        </div>
      ) : (
        <>
          <div className="reports-kpi-grid">
            <article className="reports-kpi-card">
              <div className="reports-kpi-top">
                <span>Reporting period</span>
                <div className="reports-kpi-icon blue">
                  <Calendar size={16} />
                </div>
              </div>
              <strong>
                {formatNumber(
                  activePlant?.observation_count ?? chartStats.rows.length,
                  0
                )}{" "}
                readings
              </strong>
              <small>
                {formatDateTime(activePlant?.period_start)} –{" "}
                {formatDateTime(activePlant?.period_end)}
              </small>
            </article>

            <article className="reports-kpi-card featured">
              <div className="reports-kpi-top">
                <span>Peak generation</span>
                <div className="reports-kpi-icon green">
                  <Zap size={16} />
                </div>
              </div>
              <strong>{formatNumber(chartStats.peak, 1)}</strong>
              <small>Highest recorded AC power</small>
            </article>

            <article className="reports-kpi-card">
              <div className="reports-kpi-top">
                <span>Average generation</span>
                <div className="reports-kpi-icon purple">
                  <Activity size={16} />
                </div>
              </div>
              <strong>{formatNumber(chartStats.average, 1)}</strong>
              <small>Mean AC power over period</small>
            </article>

            <article className="reports-kpi-card">
              <div className="reports-kpi-top">
                <span>Items for review</span>
                <div className="reports-kpi-icon orange">
                  <AlertTriangle size={16} />
                </div>
              </div>
              <strong>
                {anomalies ? formatNumber(anomalies.count, 0) : "—"}
              </strong>
              <small>Flagged anomaly events</small>
            </article>
          </div>

          <div className="reports-grid">
            <article className="reports-card">
              <div className="reports-card-header">
                <div>
                  <span className="reports-section-eyebrow">SITE SUMMARY</span>
                  <h3>Generation & weather snapshot</h3>
                  <p>
                    Latest recorded site conditions and expected output
                    baseline.
                  </p>
                </div>
                <div className="reports-kpi-icon green">
                  <Sun size={17} />
                </div>
              </div>

              <div className="reports-row">
                <span>Facility</span>
                <strong>{plantLabel} · Karnataka, India</strong>
              </div>
              <div className="reports-row">
                <span>Expected avg. AC power</span>
                <strong>{formatNumber(chartStats.expectedAverage, 1)}</strong>
              </div>
              <div className="reports-row">
                <span>Latest irradiance</span>
                <strong>
                  {weather.irradiation != null &&
                  Number.isFinite(Number(weather.irradiation))
                    ? `${(Number(weather.irradiation) * 1000).toFixed(0)} W/m²`
                    : "—"}
                </strong>
              </div>
              <div className="reports-row">
                <span>Ambient temperature</span>
                <strong>
                  {weather.ambient_temperature != null
                    ? `${formatNumber(weather.ambient_temperature, 1)} °C`
                    : "—"}
                </strong>
              </div>
              <div className="reports-row">
                <span>Module temperature</span>
                <strong>
                  {weather.module_temperature != null
                    ? `${formatNumber(weather.module_temperature, 1)} °C`
                    : "—"}
                </strong>
              </div>
            </article>

            <article className="reports-card">
              <div className="reports-card-header">
                <div>
                  <span className="reports-section-eyebrow">
                    RECOMMENDED ACTIONS
                  </span>
                  <h3>Anomaly-based inspection checklist</h3>
                  <p>
                    Suggested checks derived from flagged generation and
                    irradiance patterns.
                  </p>
                </div>
                <div className="reports-kpi-icon orange">
                  <ClipboardList size={17} />
                </div>
              </div>

              {recommendations.length > 0 ? (
                <div className="reports-rec-list">
                  {recommendations.map((item) => (
                    <div key={item.timestamp} className="reports-rec-item">
                      <div className="reports-rec-top">
                        <strong>{item.recommendation.title}</strong>
                        <span
                          className={`reports-badge ${item.recommendation.tone}`}
                        >
                          {item.recommendation.priority}
                        </span>
                      </div>
                      <p>{item.recommendation.action}</p>
                      <small>
                        {formatDateTime(item.timestamp)} · AC power{" "}
                        {formatNumber(item.actual_ac_power, 1)} · Irradiance{" "}
                        {formatNumber(item.irradiation, 3)}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="reports-empty-rec">
                  <CheckCircle2 size={18} />
                  <span>
                    No anomalous events flagged in the current review window.
                  </span>
                </div>
              )}
            </article>
          </div>
        </>
      )}
    </section>
  );
}

export default ReportsView;
