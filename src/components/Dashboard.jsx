import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,ArrowUpRight,BarChart3,CloudSun,RefreshCw,Sun,Thermometer,Zap,Database,TrendingUp,AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,AreaChart,Area,Line,XAxis,YAxis,CartesianGrid,Tooltip,
} from "recharts";
import "./OwnerDashboard.css";

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
  });
}

function getNumber(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") {
      const number = Number(value);

      if (Number.isFinite(number)) return number;
    }
  }

  return null;
}

function getTimeMatchedIrradiance(records, now = new Date()) {
  if (!Array.isArray(records) || records.length === 0) return null;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const intervalMinutes = 15;

  let best = null;
  let bestCompletedMinutes = -Infinity;
  let bestTimestampMs = -Infinity;

  for (const record of records) {
    const date = new Date(record.timestamp);
    const timestampMs = date.getTime();
    const irradiation = Number(record.irradiation);

    if (
      Number.isNaN(timestampMs) ||
      record.irradiation === null ||
      record.irradiation === undefined ||
      !Number.isFinite(irradiation)
    ) {
      continue;
    }

    const readingMinutes = date.getHours() * 60 + date.getMinutes();
    const completedMinutes = readingMinutes + intervalMinutes;

    // A reading becomes eligible only after its 15-minute interval completes.
    if (completedMinutes > nowMinutes) continue;

    if (
      completedMinutes > bestCompletedMinutes ||
      (completedMinutes === bestCompletedMinutes && timestampMs > bestTimestampMs)
    ) {
      bestCompletedMinutes = completedMinutes;
      bestTimestampMs = timestampMs;
      best = {
        value: irradiation,
        timestamp: record.timestamp,
      };
    }
  }

  return best;
}

function formatTime(timestamp) {
  if (!timestamp) return "—";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return String(timestamp).slice(11, 16);
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DashboardSection({
  selectedPlant = 1,
  dashboard,
  anomalies,
  loading,
  error,
  onRefresh,
  onNavigateTab,
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timeoutId;
    let intervalId;

    const tick = () => setNow(new Date());

    // Align updates to minute boundaries so 15-minute interval completions update promptly.
    const current = new Date();
    const msUntilNextMinute =
      (60 - current.getSeconds()) * 1000 - current.getMilliseconds();

    timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 60_000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);

  const plant = Number(selectedPlant);

  const activePlant = useMemo(() => {
    if (!dashboard) return null;

    if (Number(dashboard.selected_plant) !== plant) {
      return null;
    }

    return dashboard.active_plant || null;
  }, [dashboard, plant]);

  const weather = activePlant?.latest_weather || {};

  const records = useMemo(() => {
    const source = activePlant?.generation_chart;

    if (!Array.isArray(source)) return [];

    return source
      .map((item) => ({
        timestamp:
          item.timestamp ??
          item.date_time ??
          item.DATE_TIME,

        irradiation: getNumber(
          item.irradiation,
          item.IRRADIATION,
          item.weather?.irradiation,
          item.weather?.IRRADIATION
        ),

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
          item.actual !== null
      )
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() -
          new Date(b.timestamp).getTime()
      );
  }, [activePlant]);

  const latestRecord = records.at(-1);

  const peakPower =
    records.length > 0
      ? Math.max(...records.map((item) => item.actual))
      : null;

  const averagePower =
    records.length > 0
      ? records.reduce(
          (sum, item) => sum + item.actual,
          0
        ) / records.length
      : null;

  const averagePredicted = useMemo(() => {
    const comparable = records.filter(
      (item) => item.predicted !== null
    );

    if (!comparable.length) return null;

    return (
      comparable.reduce(
        (sum, item) => sum + item.predicted,
        0
      ) / comparable.length
    );
  }, [records]);

  const matchedIrradiance = getTimeMatchedIrradiance(records, now);
  const weatherIrradiation = getNumber(
    weather.irradiation,
    weather.IRRADIATION
  );
  const irradiation = matchedIrradiance?.value ?? weatherIrradiation;

  const ambientTemperature = getNumber(
    weather.ambient_temperature,
    weather.AMBIENT_TEMPERATURE
  );

  const moduleTemperature = getNumber(
    weather.module_temperature,
    weather.MODULE_TEMPERATURE
  );

  const chartRecords = records.slice(-70);
  const chartHasPrediction =
    chartRecords.length > 1 &&
    chartRecords.some(
      (item) => item.predicted !== null
    );

  if (loading) {
    return (
      <section className="owner-dashboard">
        <div className="owner-loading">
          <RefreshCw className="owner-spin" size={22} />
          Loading your solar farm...
        </div>
      </section>
    );
  }

  if (error && !dashboard) {
    return (
      <section className="owner-dashboard">
        <div className="owner-error">
          <Activity size={24} />
          <h3>Unable to load your plant data</h3>
          <p>{error}</p>
          <button onClick={onRefresh}>Try again</button>
        </div>
      </section>
    );
  }

  const plantName =
    activePlant?.name ||
    (plant === 1 ? "Solar Farm A" : "Solar Farm B");

  return (
    <section className="owner-dashboard">
      <div className="owner-section-heading">
        <div>
          <span>YOUR PLANT AT A GLANCE</span>
          <h3><Sun size={20} className="owner-kpii-icon"/>Generation summary</h3>
        </div>
        <div>
        <span className="owner-record-label">
          {records.length} recorded observations
        </span>
        <button
          className="owner-refresh-button"
          onClick={onRefresh}
          aria-label="Refresh plant data"
        >
          <RefreshCw size={16} />
          Refresh data
        </button>
        </div>
      </div>

      <div className="owner-kpi-grid">
        <article className="owner-kpi-card">
          <div className="owner-kpi-icon green">
            <Zap size={19} />
          </div>

          <span>Peak recorded power</span>

          <strong>
            {Number(peakPower).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </strong>
          <small>Highest observed AC power</small>
        </article>

        <article className="owner-kpi-card">
          <div className="owner-kpi-icon blue">
            <Activity size={19} />
          </div>

          <span>Average recorded power</span>

          <strong>{formatNumber(averagePower)}</strong>

          <small>Across displayed observations</small>
        </article>

        <article className="owner-kpi-card">
          <div className="owner-kpi-icon purple">
            <TrendingUp size={19} />
          </div>

          <span>Average expected power</span>

          <strong>
            {formatNumber(averagePredicted)}
          </strong>

          <small>
            {averagePredicted === null
              ? "Comparable model output unavailable"
              : "Model estimate"}
          </small>
        </article>

        <article className="owner-kpi-card">
          <div className="owner-kpi-icon orange">
            <Sun size={19} />
          </div>

          <span>Time-matched irradiation</span>

          <strong>
            {formatNumber(irradiation, 3)}
          </strong>

          <small>Dataset measurement scale</small>
        </article>
      </div>

      <article className="owner-card owner-generation-card">
        <div className="owner-card-heading">
          <div>
            <span className="owner-card-eyebrow">
              GENERATION ANALYTICS
            </span>

            <h3>Power generation over time</h3>

            <p>
              Recorded plant generation across the selected
              historical period.
            </p>
          </div>

          <button
            className="owner-text-button"
            onClick={() => onNavigateTab?.("performance")}
          >
            View performance
            <ArrowUpRight size={15} />
          </button>
        </div>

        {chartRecords.length > 1 ? (
          <>
            <div className="owner-chart-legend">
              <span>
                <i className="owner-legend-dot actual" />
                Actual generation
              </span>

              {chartHasPrediction && (
                <span>
                  <i className="owner-legend-dot predicted" />
                  Expected generation
                </span>
              )}

              <span>
                <i
                  className="owner-legend-dot"
                  style={{ backgroundColor: "#f59e0b" }}
                />
                Irradiation
              </span>
            </div>

            <div className="owner-chart">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={chartRecords}
                  margin={{
                    top: 10,
                    right: 12,
                    left: 0,
                    bottom: 5,
                  }}
                >
                  <defs>
                    <linearGradient
                      id="ownerPowerFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#16a36a" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#16a36a" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="4 5"
                    vertical={false}
                    stroke="var(--owner-grid)"
                  />

                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTime}
                    minTickGap={35}
                    tick={{
                      fontSize: 11,
                      fill: "var(--owner-muted)",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  {/* Left axis: power */}
                  <YAxis
                    yAxisId="power"
                    width={65}
                    tick={{
                      fontSize: 11,
                      fill: "var(--owner-muted)",
                    }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) =>
                      Number(value).toLocaleString("en-IN", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      })
                    }
                  />

                  {/* Right axis: irradiation */}
                  <YAxis
                    yAxisId="irradiation"
                    orientation="right"
                    width={65}
                    tick={{
                      fontSize: 11,
                      fill: "var(--owner-muted)",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleString("en-IN")}
                    formatter={(value, name) => [
                      formatNumber(value, name === "irradiation" ? 3 : 2),
                      name === "actual"
                        ? "Actual power"
                        : name === "predicted"
                          ? "Expected power"
                          : "Irradiation",
                    ]}
                    contentStyle={{
                      background: "var(--owner-tooltip)",
                      border: "1px solid var(--owner-border)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />

                  <Area
                    yAxisId="power"
                    type="monotone"
                    dataKey="actual"
                    name="actual"
                    stroke="#16a36a"
                    strokeWidth={2.5}
                    fill="url(#ownerPowerFill)"
                    connectNulls
                  />

                  {chartHasPrediction && (
                    <Line
                      yAxisId="power"
                      type="monotone"
                      dataKey="predicted"
                      name="predicted"
                      stroke="#6389ee"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  )}

                  <Line
                    yAxisId="irradiation"
                    type="monotone"
                    dataKey="irradiation"
                    name="irradiation"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="owner-chart-footer">
              <span>
                Latest observation:{" "}
                <strong>{formatTime(latestRecord?.timestamp)}</strong>
              </span>

              <span>Power and irradiation shown in their dataset units</span>
            </div>
          </>
        ) : (
          <div className="owner-empty-state">
            <BarChart3 size={30} />
            <strong>Generation history is unavailable</strong>
            <span>
              More recorded observations are needed to display the generation trend.
            </span>
          </div>
        )}
      </article>

      <div className="owner-bottom-grid">
        <article className="owner-card">
          <div className="owner-card-heading">
            <div>
              <span className="owner-card-eyebrow">
                ENVIRONMENT
              </span>
              <h3>Latest weather conditions</h3>
              <p>Latest available weather observation</p>
            </div>

            <div className="owner-kpi-icon green">
              <CloudSun size={19} />
            </div>
          </div>

          <div className="owner-weather-grid">
            <div>
              <Sun size={17} />
              <span>Irradiation</span>
              <strong>{formatNumber(weatherIrradiation ?? irradiation, 3)}</strong>
            </div>

            <div>
              <Thermometer size={17} />
              <span>Ambient temperature</span>
              <strong>
                {ambientTemperature === null
                  ? "—"
                  : `${formatNumber(ambientTemperature)} °C`}
              </strong>
            </div>

            <div>
              <Thermometer size={17} />
              <span>Module temperature</span>
              <strong>
                {moduleTemperature === null
                  ? "—"
                  : `${formatNumber(moduleTemperature)} °C`}
              </strong>
            </div>
          </div>
        </article>

        <article className="owner-card">
          <div className="owner-card-heading">
            <div>
              <span className="owner-card-eyebrow">
                PLANT INFORMATION
              </span>
              <h3>Data and connectivity</h3>
              <p>Current prototype data status</p>
            </div>

            <div className="owner-kpi-icon blue">
              <Database size={19} />
            </div>
          </div>

          <div className="owner-info-row">
            <span>Selected plant</span>
            <strong>Plant {plant}</strong>
          </div>

          <div className="owner-info-row">
            <span>Data source</span>
            <strong>Historical dataset</strong>
          </div>

          <div className="owner-info-row">
            <span>Recorded observations</span>
            <strong>{records.length}</strong>
          </div>

          <div className="owner-info-row">
            <span>Live IoT connection</span>
            <strong className="owner-pending">
              Not connected
            </strong>
          </div>
        </article>
      </div>

      {anomalies && Number(anomalies.plant) === plant && (
        <article className="owner-card">
          <div className="owner-card-heading">
            <div>
              <span className="owner-card-eyebrow">
                HISTORICAL ANOMALY REVIEW
              </span>
              <h3>Flagged holdout observations</h3>
              <p>
                {anomalies.note ||
                  "Unsupervised anomaly candidates from historical holdout data; not confirmed faults."}
              </p>
            </div>

            <div className="owner-kpi-icon orange">
              <AlertTriangle size={19} />
            </div>
          </div>

          <div className="owner-info-row">
            <span>Flagged candidates</span>
            <strong>{formatNumber(anomalies.count, 0)}</strong>
          </div>

          <div className="owner-info-row">
            <span>Latest flagged observation</span>
            <strong>
              {anomalies.records?.length
                ? new Date(anomalies.records.at(-1).timestamp).toLocaleString("en-IN")
                : "None"}
            </strong>
          </div>

          <div className="owner-info-row">
            <span>Analysis mode</span>
            <strong>Historical holdout (not live)</strong>
          </div>
        </article>
      )}

      <article className="owner-insight-card">
        <div className="owner-insight-icon">
          <Activity size={20} />
        </div>

        <div>
          <strong>Operational intelligence</strong>
          <p>
            Generation monitoring is available from historical
            plant records. Automated equipment fault alerts and
            live monitoring will be added after their data
            integrations are completed.
          </p>
        </div>

        <button
          onClick={() => onNavigateTab?.("forecast")}
        >
          Explore forecast
          <ArrowUpRight size={15} />
        </button>
      </article>
    </section>
  );
}

export default DashboardSection;