
import React, { useEffect, useMemo, useState } from "react";
import "./DashboardSection.css";
import {
  Activity,
  BarChart3,
  CloudSun,
  RefreshCw,
  Sun,
  Thermometer,
  Zap,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const getNumber = (...values) => {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  }
  return null;
};

const formatNumber = (value, digits = 2) =>
  value === null || value === undefined
    ? "—"
    : Number(value).toLocaleString(undefined, {
        maximumFractionDigits: digits,
      });

const formatTime = (timestamp) => {
  if (!timestamp) return "—";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return String(timestamp).slice(11, 16);
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
};

function DashboardSection() {
  const [plant, setPlant] = useState(1);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchDashboard = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError("");

      const response = await fetch(`${API_URL}/api/dashboard`);

      if (!response.ok) {
        throw new Error(`Dashboard request failed (${response.status})`);
      }

      const data = await response.json();
      setDashboard(data);
    } catch (err) {
      setError(err.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const activePlant = useMemo(() => {
    if (!dashboard) return null;

    return (
      dashboard[`plant${plant}`] ||
      (Number(dashboard.selected_plant) === plant
        ? dashboard.active_plant
        : null) ||
      (plant === 1 ? dashboard.active_plant : null)
    );
  }, [dashboard, plant]);

  const weather = activePlant?.latest_weather || {};

  const records = useMemo(() => {
    const source = activePlant?.generation_chart;

    if (!Array.isArray(source)) return [];

    return source
      .map((item) => ({
        timestamp: item.timestamp ?? item.date_time ?? item.DATE_TIME,
        actual: getNumber(
          item.actual_ac_power,
          item.ac_power,
          item.inverter_actual
        ),
        predicted: getNumber(
          item.predicted_ac_power,
          item.inverter_predicted
        ),
      }))
      .filter(
        (item) =>
          item.timestamp &&
          item.actual !== null &&
          item.predicted !== null
      )
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() -
          new Date(b.timestamp).getTime()
      );
  }, [activePlant]);

  const chart = useMemo(() => {
    if (records.length < 2) return null;

    const width = 1000;
    const height = 390;

    const padding = {
      top: 30,
      right: 28,
      bottom: 55,
      left: 72,
    };

    const values = records.flatMap((item) => [
      item.actual,
      item.predicted,
    ]);

    const minValue = Math.min(0, ...values);
    const maxValue = Math.max(...values, 1);
    const range = maxValue - minValue || 1;

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const x = (index) =>
      padding.left +
      (index / (records.length - 1)) * plotWidth;

    const y = (value) =>
      padding.top +
      ((maxValue - value) / range) * plotHeight;

    const createPath = (key) =>
      records
        .map(
          (item, index) =>
            `${index === 0 ? "M" : "L"} ${x(index)} ${y(item[key])}`
        )
        .join(" ");

    const actualPath = createPath("actual");
    const predictedPath = createPath("predicted");

    const actualArea = [
      actualPath,
      `L ${x(records.length - 1)} ${y(minValue)}`,
      `L ${x(0)} ${y(minValue)}`,
      "Z",
    ].join(" ");

    const tickCount = 5;

    const yTicks = Array.from(
      { length: tickCount },
      (_, index) => {
        const value =
          maxValue - (index / (tickCount - 1)) * range;

        return {
          value,
          y: y(value),
        };
      }
    );

    const xTickIndexes = Array.from(
      new Set(
        Array.from({ length: Math.min(6, records.length) }, (_, i) =>
          Math.round(
            (i * (records.length - 1)) /
              (Math.min(6, records.length) - 1)
          )
        )
      )
    );

    return {
      width,
      height,
      padding,
      x,
      y,
      actualPath,
      predictedPath,
      actualArea,
      yTicks,
      xTickIndexes,
    };
  }, [records]);

  const peakActual =
    records.length > 0
      ? Math.max(...records.map((item) => item.actual))
      : null;

  const averageActual =
    records.length > 0
      ? records.reduce((sum, item) => sum + item.actual, 0) /
        records.length
      : null;

  const averagePredicted =
    records.length > 0
      ? records.reduce((sum, item) => sum + item.predicted, 0) /
        records.length
      : null;

  const irradiation = getNumber(
    weather.irradiation,
    weather.IRRADIATION
  );

  const ambientTemperature = getNumber(
    weather.ambient_temperature,
    weather.AMBIENT_TEMPERATURE
  );

  const moduleTemperature = getNumber(
    weather.module_temperature,
    weather.MODULE_TEMPERATURE
  );

  const hasComparableData =
    plant === 1 &&
    records.length >= 2 &&
    activePlant?.scale_note !== "not_comparable";

  if (loading) {
    return (
      <section className="dashboard-section">
        <div className="dashboard-loading">
          <RefreshCw className="spin" size={22} />
          <span>Loading SolarGrid dashboard...</span>
        </div>
      </section>
    );
  }

  if (error && !dashboard) {
    return (
      <section className="dashboard-section">
        <div className="dashboard-error">
          <Activity size={24} />
          <h3>Unable to load dashboard</h3>
          <p>{error}</p>
          <button onClick={() => fetchDashboard()}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-section">
      {/* HEADER */}
      <div className="dashboard-heading">
        <div>
          <span className="dashboard-eyebrow">
            SOLAR FARM ANALYTICS
          </span>
          <h2>Generation Overview</h2>
          <p>
            Monitor historical solar generation and model predictions.
          </p>
        </div>

        <div className="dashboard-actions">
          <div className="plant-switch">
            <button
              className={plant === 1 ? "active" : ""}
              onClick={() => setPlant(1)}
            >
              Plant 1
            </button>
            <button
              className={plant === 2 ? "active" : ""}
              onClick={() => setPlant(2)}
            >
              Plant 2
            </button>
          </div>

          <button
            className="refresh-button"
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            aria-label="Refresh dashboard"
          >
            <RefreshCw
              size={15}
              className={refreshing ? "spin" : ""}
            />
          </button>
        </div>
      </div>

      {/* MODE NOTICE */}
      <div className="historical-notice">
        <span className="notice-dot" />
        <div>
          <strong>Historical dataset · Demo mode</strong>
          <span>
            Showing recorded observations, not live sensor telemetry.
          </span>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="dashboard-kpi-grid">
        <article className="dashboard-kpi-card">
          <div className="kpi-icon green">
            <Zap size={19} />
          </div>
          <span>Peak recorded power</span>
          <strong>{formatNumber(peakActual)}</strong>
          <small>Across displayed records</small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="kpi-icon blue">
            <Activity size={19} />
          </div>
          <span>Average actual power</span>
          <strong>{formatNumber(averageActual)}</strong>
          <small>Across displayed records</small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="kpi-icon purple">
            <BarChart3 size={19} />
          </div>
          <span>Average predicted power</span>
          <strong>
            {hasComparableData ? formatNumber(averagePredicted) : "—"}
          </strong>
          <small>
            {hasComparableData ? "Model output" : "Comparison unavailable"}
          </small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="kpi-icon orange">
            <Sun size={19} />
          </div>
          <span>Solar irradiance</span>
          <strong>
            {irradiation !== null
              ? `${formatNumber(irradiation, 3)}`
              : "—"}
          </strong>
          <small>Latest available weather record</small>
        </article>
      </div>

      {/* GENERATION GRAPH */}
      <article className="dashboard-card generation-card">
        <div className="chart-card-header">
          <div>
            <div className="chart-title">
              <BarChart3 size={19} />
              <h3>Power Output Over Time</h3>
            </div>
            <p>
              Actual generation compared with model predictions at each
              recorded timestamp.
            </p>
          </div>

          <span className="chart-record-count">
            {records.length} records
          </span>
        </div>

        {hasComparableData && chart ? (
          <>
            <div className="chart-legend">
              <span>
                <i className="legend-swatch actual-swatch" />
                Actual power
              </span>
              <span>
                <i className="legend-swatch predicted-swatch" />
                Predicted power
              </span>
            </div>

            <div className="power-chart-wrapper">
              <svg
                className="power-chart"
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                role="img"
                aria-label="Actual and predicted power at each historical timestamp"
              >
                <defs>
                  <linearGradient
                    id="actualPowerGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#16a36a"
                      stopOpacity=".22"
                    />
                    <stop
                      offset="100%"
                      stopColor="#16a36a"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>

                {/* Y-axis grid */}
                {chart.yTicks.map((tick, index) => (
                  <g key={index}>
                    <line
                      x1={chart.padding.left}
                      y1={tick.y}
                      x2={chart.width - chart.padding.right}
                      y2={tick.y}
                      className="chart-grid-line"
                    />
                    <text
                      x={chart.padding.left - 14}
                      y={tick.y + 4}
                      textAnchor="end"
                      className="chart-axis-text"
                    >
                      {formatNumber(tick.value, 1)}
                    </text>
                  </g>
                ))}

                {/* Actual area */}
                <path
                  d={chart.actualArea}
                  fill="url(#actualPowerGradient)"
                />

                {/* Actual line */}
                <path
                  d={chart.actualPath}
                  className="actual-power-line"
                />

                {/* Predicted line */}
                <path
                  d={chart.predictedPath}
                  className="predicted-power-line"
                />

                {/* Every timestamp is plotted */}
                {records.map((item, index) => (
                  <g key={`${item.timestamp}-${index}`}>
                    <circle
                      cx={chart.x(index)}
                      cy={chart.y(item.actual)}
                      r="3"
                      className="actual-data-point"
                    >
                      <title>
                        {formatTime(item.timestamp)}
                        {"\n"}Actual: {formatNumber(item.actual)}
                      </title>
                    </circle>

                    <circle
                      cx={chart.x(index)}
                      cy={chart.y(item.predicted)}
                      r="3"
                      className="predicted-data-point"
                    >
                      <title>
                        {formatTime(item.timestamp)}
                        {"\n"}Predicted: {formatNumber(item.predicted)}
                      </title>
                    </circle>
                  </g>
                ))}

                {/* X-axis timestamps */}
                {chart.xTickIndexes.map((index) => (
                  <text
                    key={index}
                    x={chart.x(index)}
                    y={chart.height - 17}
                    textAnchor="middle"
                    className="chart-axis-text"
                  >
                    {formatTime(records[index].timestamp)}
                  </text>
                ))}
              </svg>
            </div>

            <div className="chart-footer">
              <div>
                <span>Actual average</span>
                <strong>{formatNumber(averageActual)}</strong>
              </div>
              <div>
                <span>Predicted average</span>
                <strong>{formatNumber(averagePredicted)}</strong>
              </div>
              <div>
                <span>Peak actual</span>
                <strong>{formatNumber(peakActual)}</strong>
              </div>
            </div>

            <p className="chart-footnote">
              Power values are displayed in the units returned by the
              backend. All available chart timestamps are plotted.
            </p>
          </>
        ) : (
          <div className="chart-empty">
            <BarChart3 size={30} />
            <strong>
              {plant === 2
                ? "Comparable predictions are not available for Plant 2."
                : "Not enough comparable generation records."}
            </strong>
            <span>
              {plant === 2
                ? "The current model was trained on Plant 1 data. A separate compatible model is needed for Plant 2."
                : "Check that the backend returns actual_ac_power and predicted_ac_power for at least two timestamps."}
            </span>
          </div>
        )}
      </article>

      {/* WEATHER */}
      <div className="dashboard-bottom-grid">
        <article className="dashboard-card weather-card">
          <div className="section-card-heading">
            <div className="section-icon">
              <CloudSun size={19} />
            </div>
            <div>
              <h3>Historical Weather Conditions</h3>
              <p>Latest available weather observation</p>
            </div>
          </div>

          <div className="weather-reading-grid">
            <div className="weather-reading">
              <Sun size={17} />
              <span>Irradiance</span>
              <strong>
                {irradiation !== null
                  ? `${formatNumber(irradiation, 3)}`
                  : "—"}
              </strong>
            </div>

            <div className="weather-reading">
              <Thermometer size={17} />
              <span>Ambient temperature</span>
              <strong>
                {ambientTemperature !== null
                  ? `${formatNumber(ambientTemperature)} °C`
                  : "—"}
              </strong>
            </div>

            <div className="weather-reading">
              <Thermometer size={17} />
              <span>Module temperature</span>
              <strong>
                {moduleTemperature !== null
                  ? `${formatNumber(moduleTemperature)} °C`
                  : "—"}
              </strong>
            </div>
          </div>
        </article>

        <article className="dashboard-card dataset-card">
          <div className="section-card-heading">
            <div className="section-icon">
              <Activity size={19} />
            </div>
            <div>
              <h3>Dataset Information</h3>
              <p>Source and model context</p>
            </div>
          </div>

          <div className="dataset-info-row">
            <span>Selected plant</span>
            <strong>Plant {plant}</strong>
          </div>

          <div className="dataset-info-row">
            <span>Data mode</span>
            <strong>Historical replay</strong>
          </div>

          <div className="dataset-info-row">
            <span>Records plotted</span>
            <strong>{records.length}</strong>
          </div>

          <div className="dataset-info-row">
            <span>Telemetry</span>
            <strong className="not-live">Not connected</strong>
          </div>
        </article>
      </div>
    </section>
  );
}

export default DashboardSection;
