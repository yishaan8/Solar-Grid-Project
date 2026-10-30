
import { MapPin } from "lucide-react";
import { useTimeTheme } from "../hooks/useTimeTheme";
import { useDashboard } from "../hooks/useDashboard";

function HeroSection({ selectedPlant = 1 }) {
  const { timeTheme, currentTime } = useTimeTheme();
  const { dashboard } = useDashboard(selectedPlant);

  const formattedTime = currentTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const formattedDate = currentTime.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const plantTitle =
    selectedPlant === 2 ? "Solar Farm B" : "Solar Farm A";

  // Read values from the selected plant's dashboard data.
  const activePlant =
    dashboard?.active_plant ?? dashboard?.plant1 ?? {};

  const weather = activePlant.latest_weather;
  const genChart = activePlant.generation_chart ?? [];

  // Find the maximum power in the available chart data.
  const validPowerReadings = genChart
    .map((item) => Number(item.ac_power))
    .filter((value) => Number.isFinite(value) && value >= 0);

  const peakPower =
    validPowerReadings.length > 0
      ? Math.max(...validPowerReadings)
      : null;

  // These values are only displayed when data is available.
  const formatPower = (power) => {
    if (power == null) return "—";
    return power >= 1000
      ? `${(power / 1000).toFixed(1)} MW`
      : `${Math.round(power)} kW`;
  };

  const irradiance =
    weather?.irradiation != null &&
    Number.isFinite(Number(weather.irradiation))
      ? `${(Number(weather.irradiation) * 1000).toFixed(0)} W/m²`
      : "—";

  const panelTemp =
    weather?.module_temperature != null &&
    Number.isFinite(Number(weather.module_temperature))
      ? `${Number(weather.module_temperature).toFixed(1)}°C`
      : "—";

  return (
    <section className={`hero hero-${timeTheme}`}>
      <div className="hero-top">
        <div>
          <p className="greeting">
            {timeTheme === "night"
              ? "Good evening"
              : timeTheme === "dawn" ||
                  timeTheme === "morning"
                ? "Good morning"
                : timeTheme === "afternoon"
                  ? "Good afternoon"
                  : "Good evening"}
          </p>

          <h1>Solar farm overview</h1>

          <p className="hero-tagline">
            Understand your generation at a glance.
          </p>
        </div>
      </div>

      <div className="hero-bottom">
        <div className="plant-card">
          <div className="plant-header">
            <div className="plant-icon">☀</div>

            <div>
              <h3>{plantTitle}</h3>
              <p>
                <MapPin size={12} />
                Karnataka, India
              </p>
            </div>
          </div>

          <div className="status">
            Historical data · Demo mode
          </div>

          <div className="plant-stats">
            <div>
              <span>⚡</span>
              <strong>{formatPower(peakPower)}</strong>
              <small>Peak in available data</small>
            </div>

            <div>
              <span>☀</span>
              <strong>{irradiance}</strong>
              <small>Solar irradiance</small>
            </div>

            <div>
              <span>🌡</span>
              <strong>{panelTemp}</strong>
              <small>Module temperature</small>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-meta">
        <span>{formattedDate}</span>
        <span>{formattedTime}</span>
      </div>
    </section>
  );
}

export default HeroSection;
