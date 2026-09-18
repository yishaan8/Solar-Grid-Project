import { MapPin, ChevronDown, CheckCircle2 } from "lucide-react";
import { useTimeTheme } from "../hooks/useTimeTheme";
import { useEffect, useState } from "react";
const themeContent = {
  dawn: {
    greeting: "GOOD MORNING.",
    tagline: (
      <>
        THE SUN RISES.
        <br />
        AND SO DOES A CLEANER TOMORROW.
      </>
    ),
    quote: (
      <>
        Every sunrise
        <br />
        is potential energy.
      </>
    )
  },

  morning: {
    greeting: "GOOD MORNING.",
    tagline: (
      <>
        THE SUN RISES.
        <br />
        AND SO DOES A CLEANER TOMORROW.
      </>
    ),
    quote: (
      <>
        More sunlight.
        <br />
        More possibilities.
      </>
    )
  },

  afternoon: {
    greeting: "GOOD AFTERNOON.",
    tagline: (
      <>
        THE SUN IS WORKING.
        <br />
        SO IS YOUR GRID.
      </>
    ),
    quote: (
      <>
        Every ray
        <br />
        becomes energy.
      </>
    )
  },

  evening: {
    greeting: "GOOD EVENING.",
    tagline: (
      <>
        A CLEANER TOMORROW
        <br />
        IS ALWAYS WITHIN REACH.
      </>
    ),
    quote: (
      <>
        Every sunset
        <br />
        marks another day powered.
      </>
    )
  },

  dusk: {
    greeting: "GOOD EVENING.",
    tagline: (
      <>
        THE SUN SETS.
        <br />
        THE GRID KEEPS GOING.
      </>
    ),
    quote: (
      <>
        Different skies.
        <br />
        Same purpose.
      </>
    )
  },

  night: {
    greeting: "GOOD NIGHT.",
    tagline: (
      <>
        THE SUN RESTS.
        <br />
        THE GRID DOESN'T.
      </>
    ),
    quote: (
      <>
        Every sunrise
        <br />
        is potential energy.
      </>
    )
  }
};
function HeroSection() {
  const { timeTheme, currentTime } = useTimeTheme();
 
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
          <p className="greeting">{themeContent[timeTheme].greeting}</p>

          <h1>PARIJA<span>_</span></h1>

          <p className="hero-tagline">
            {themeContent[timeTheme].tagline}
          </p>
        </div>

        <div className="quote-card">
          <span>"</span>
          {themeContent[timeTheme].quote}
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