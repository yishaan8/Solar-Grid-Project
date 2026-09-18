import { MapPin, ChevronDown, CheckCircle2 } from "lucide-react";
import { useTimeTheme } from "../hooks/useTimeTheme";

function HeroSection() {
  const { timeTheme, currentTime } = useTimeTheme();

  const hour = currentTime.getHours();

  let greeting = "GOOD MORNING.";
  let headline = "THE SUN RISES.";
  let subHeadline = "AND SO DOES CLEAN ENERGY.";

  if (hour >= 11 && hour < 15) {
    greeting = "GOOD AFTERNOON.";
    headline = "PEAK SUNLIGHT.";
    subHeadline = "PEAK GENERATION.";
  } else if (hour >= 15 && hour < 20) {
    greeting = "GOOD EVENING.";
    headline = "THE DAY FADES.";
    subHeadline = "CLEAN ENERGY LIVES ON.";
  } else if (hour >= 20 || hour < 5) {
    greeting = "GOOD NIGHT.";
    headline = "THE SUN RESTS.";
    subHeadline = "THE GRID DOESN'T.";
  }

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

  return (
    <section className={`hero hero-${timeTheme}`}>

      <div className="hero-top">

        <div>
          <p className="greeting">{greeting}</p>

          <h1>PARIJA<span>_</span></h1>

          <p className="hero-tagline">
            {headline}
            <br />
            {subHeadline}
          </p>
        </div>

        <div className="quote-card">
          <span>"</span>
          Every sunrise
          <br />
          is potential energy.
        </div>

      </div>

      <div className="hero-bottom">

        <div className="plant-card">

          <div className="plant-header">

            <div className="plant-icon">
              ☀
            </div>

            <div>
              <h3>Solar Farm A</h3>

              <p>
                <MapPin size={11} />
                Bengaluru, KA
              </p>
            </div>

            <ChevronDown size={16} />

          </div>

          <div className="status">
            <CheckCircle2 size={14} />
            All Systems Normal
          </div>

          <div className="plant-stats">

            <div>
              <span>⚡</span>
              <strong>12.4 MW</strong>
              <small>Current Generation</small>
              <em>↑ 5.2%</em>
            </div>

            <div>
              <span>🌿</span>
              <strong>92%</strong>
              <small>Efficiency</small>
              <em>↑ 1.4%</em>
            </div>

            <div>
              <span>🌡</span>
              <strong>28°C</strong>
              <small>Panel Temperature</small>
              <em>Stable</em>
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