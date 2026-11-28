import { useEffect, useState } from "react";
import "./FarmsView.css";
import {
  Sun,
  MapPin,
  ArrowRight,
  CloudSun,
  Clock3,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { fetchDashboard } from "../api/client";

const FARM_CONFIGS = [
  {
    id: 1,
    name: "Solar Farm 01",
    subtitle: "Plant 1",
    location: "Karnataka, India",
    accent: "green",
    stroke: "#16a36a",
    fillId: "farmSparkGreen",
  },
  {
    id: 2,
    name: "Solar Farm 02",
    subtitle: "Plant 2",
    location: "Karnataka, India",
    accent: "blue",
    stroke: "#4f7df3",
    fillId: "farmSparkBlue",
  },
];

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

function summarizePlant(dashboardData) {
  const active = dashboardData?.active_plant;
  if (!active) return null;

  const chart = Array.isArray(active.generation_chart)
    ? active.generation_chart
    : [];

  const series = chart
    .map((row) => ({
      timestamp: row.timestamp,
      power: Number(row.actual_ac_power ?? row.ac_power),
    }))
    .filter((row) => row.timestamp && Number.isFinite(row.power));

  const powers = series.map((item) => item.power);
  const peakPower = powers.length > 0 ? Math.max(...powers) : null;
  const avgPower =
    powers.length > 0
      ? powers.reduce((sum, val) => sum + val, 0) / powers.length
      : null;

  const weather = active.latest_weather || {};
  const hasWeather =
    weather.irradiation !== null &&
    weather.irradiation !== undefined &&
    Number.isFinite(Number(weather.irradiation));

  return {
    peakPower,
    avgPower,
    observationCount: active.observation_count ?? series.length,
    hasWeather,
    latestIrradiation: hasWeather ? Number(weather.irradiation) : null,
    sparkline: series.slice(-48),
  };
}

function FarmsView({ selectedPlant, onSelectPlant, onNavigateTab }) {
  const [plantSummaries, setPlantSummaries] = useState({});
  const [loadingSummaries, setLoadingSummaries] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPlants() {
      const [res1, res2] = await Promise.all([
        fetchDashboard(1),
        fetchDashboard(2),
      ]);
      if (cancelled) return;

      setPlantSummaries({
        1: res1.data ? summarizePlant(res1.data) : null,
        2: res2.data ? summarizePlant(res2.data) : null,
      });
      setLoadingSummaries(false);
    }

    loadPlants();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (plantId) => {
    onSelectPlant?.(plantId);
  };

  const handleCardKeyDown = (event, plantId) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect(plantId);
    }
  };

  const handleOpenDashboard = (event, plantId) => {
    event.stopPropagation();
    handleSelect(plantId);
    onNavigateTab?.("overview");
  };

  return (
    <section className="farms-page">
      <header className="farms-hero">
        <div className="farms-hero-copy">
          <span className="farms-eyebrow">SOLAR ASSETS</span>
          <h1>Your solar farms</h1>
          <p>
            Select a plant to explore generation history, weather conditions,
            and asset performance.
          </p>
          <div className="farms-status-pill">
            <Clock3 size={13} />
            <span>2 plants · Historical data</span>
          </div>
        </div>
        <div className="farms-sun" aria-hidden="true" />
      </header>

      <div className="farms-list">
        {FARM_CONFIGS.map((farm) => {
          const isSelected = Number(selectedPlant) === farm.id;
          const summary = plantSummaries[farm.id];
          const hasSparkline = (summary?.sparkline?.length ?? 0) > 1;

          return (
            <article
              key={farm.id}
              className={`farm-card ${farm.accent} ${
                isSelected ? "selected" : ""
              }`}
              onClick={() => handleSelect(farm.id)}
              onKeyDown={(event) => handleCardKeyDown(event, farm.id)}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`Select ${farm.name}`}
            >
              <div className="farm-card-header">
                <div className="farm-identity">
                  <div className="farm-icon">
                    <Sun size={22} />
                  </div>

                  <div>
                    <span className="farm-plant-label">{farm.subtitle}</span>
                    <h3>{farm.name}</h3>
                    <span className="farm-location">
                      <MapPin size={12} />
                      {farm.location}
                    </span>
                  </div>
                </div>

                <span
                  className={`farm-selection-badge ${
                    isSelected ? "selected-badge" : ""
                  }`}
                >
                  {isSelected ? (
                    <>
                      <CheckCircle2 size={13} />
                      Selected
                    </>
                  ) : (
                    "Select plant"
                  )}
                </span>
              </div>

              <div className="farm-metrics-row">
                <div className="farm-metric-cell">
                  <span>Peak AC power</span>
                  <strong>{formatNumber(summary?.peakPower, 0)}</strong>
                </div>

                <div className="farm-metric-cell">
                  <span>Avg. AC power</span>
                  <strong>{formatNumber(summary?.avgPower, 0)}</strong>
                </div>

                <div className="farm-metric-cell">
                  <span>Observations</span>
                  <strong>
                    {summary?.observationCount != null
                      ? formatNumber(summary.observationCount, 0)
                      : "—"}
                  </strong>
                </div>
              </div>

              <div className="farm-sparkline-box">
                <div className="farm-sparkline-header">
                  <span>
                    <Activity size={13} />
                    Generation history
                  </span>
                  <small>Recent recorded trend</small>
                </div>

                {hasSparkline ? (
                  <div className="farm-sparkline-chart">
                    <ResponsiveContainer width="100%" height={72}>
                      <AreaChart
                        data={summary.sparkline}
                        margin={{ top: 4, right: 2, left: 2, bottom: 2 }}
                      >
                        <defs>
                          <linearGradient
                            id={farm.fillId}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={farm.stroke}
                              stopOpacity={0.28}
                            />
                            <stop
                              offset="100%"
                              stopColor={farm.stroke}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="power"
                          stroke={farm.stroke}
                          strokeWidth={2}
                          fill={`url(#${farm.fillId})`}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="farm-sparkline-empty">
                    {loadingSummaries
                      ? "Loading generation trend…"
                      : "Open dashboard to view generation history"}
                  </div>
                )}
              </div>

              <div className="farm-availability-row">
                <span className="farm-availability-chip">
                  <CloudSun size={14} />
                  {summary?.hasWeather
                    ? `Weather data available · Irradiance ${formatNumber(
                        summary.latestIrradiation,
                        3
                      )}`
                    : "Weather data available"}
                </span>
              </div>

              <div className="farm-card-footer">
                <div className="farm-data-status">
                  <span className="farm-status-dot" />
                  Historical data
                </div>

                <button
                  type="button"
                  className="farm-open-button"
                  onClick={(event) => handleOpenDashboard(event, farm.id)}
                >
                  Open dashboard
                  <ArrowRight size={15} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default FarmsView;
