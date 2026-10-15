
import "./AboutSection.css";
import {
  Activity,
  ScanSearch,
  TrendingUp,
  CloudSun,
  ArrowRight,
} from "lucide-react";

import solarFarm from "../assets/backgrounds/solar_farm.jpg";
import solarPanels from "../assets/backgrounds/solar_panel.jpg";
import solarHome from "../assets/backgrounds/solar_home.jpg";

const features = [
  {
    number: "01",
    label: "MONITOR",
    title: "Every watt tells a story.",
    description:
      "Understand solar plant performance through generation metrics, daily yield, and interactive monitoring graphs.",
    icon: Activity,
  },
  {
    number: "02",
    label: "DETECT",
    title: "Spot the unexpected.",
    description:
      "Compare expected and actual generation to identify unusual patterns and potential performance issues.",
    icon: ScanSearch,
  },
  {
    number: "03",
    label: "PREDICT",
    title: "Look ahead. Think smarter.",
    description:
      "Use historical generation data and predictive models to estimate future solar energy production.",
    icon: TrendingUp,
  },
  {
    number: "04",
    label: "WEATHER INTELLIGENCE",
    title: "Read the sky. Understand the grid.",
    description:
      "Bring weather context into solar analysis to better understand changes in energy generation.",
    icon: CloudSun,
  },
];

function AboutSection({ onEnter }) {
  return (
    <section className="about-story" id="about">
      <div className="story-intro">
        <span className="story-eyebrow">
          INTRODUCING SOLARGRID INTELLIGENCE
        </span>

        <h2>
          The sun provides the power.
          <br />
          <span>We provide the intelligence.</span>
        </h2>

        <p>
          Solar energy is the future. Understanding it better is
          how we move forward. SolarGrid brings generation data,
          performance analytics, anomaly detection, and forecasting
          together in one intelligent platform.
        </p>

        <a className="story-scroll" href="#monitor">
          DISCOVER WHAT'S POSSIBLE <ArrowRight size={16} />
        </a>
      </div>

      <section className="story-feature" id="monitor">
        <img
          className="story-image"
          src={solarFarm}
          alt="Solar panels across a solar energy farm"
          loading="lazy"
        />

        <div className="story-copy">
          <span className="story-eyebrow">01 / VISIBILITY</span>
          <h3>Every watt tells a story.</h3>
          <p>
            Turn raw generation data into a clear picture of plant
            performance. Explore power output, daily yield, and
            changing generation patterns in one place.
          </p>
        </div>
      </section>

      <section className="story-feature story-feature-reverse">
        <img
          className="story-image"
          src={solarPanels}
          alt="Photovoltaic solar panels"
          loading="lazy"
        />

        <div className="story-copy">
          <span className="story-eyebrow">02 / FAULT DETECTION</span>
          <h3>Spot the unexpected.</h3>
          <p>
            Compare expected and actual energy output to flag
            anomalies and potential underperformance before they
            go unnoticed.
          </p>
        </div>
      </section>

      <section className="story-feature">
        <img
          className="story-image"
          src={solarHome}
          alt="A modern home powered by rooftop solar panels"
          loading="lazy"
        />

        <div className="story-copy">
          <span className="story-eyebrow">03 / PREDICTIVE INSIGHTS</span>
          <h3>Don't just track energy. Anticipate it.</h3>
          <p>
            Use historical generation data and forecasting models
            to explore what future solar production could look like.
          </p>
        </div>
      </section>

      <div className="story-capabilities">
        <span className="story-eyebrow">ONE PLATFORM. MORE CLARITY.</span>

        <h3>Everything connected. Every insight in reach.</h3>

        <div className="capability-grid">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article className="capability" key={feature.number}>
                <Icon size={25} strokeWidth={1.6} />
                <span>{feature.number} / {feature.label}</span>
                <h4>{feature.title}</h4>
                <p>{feature.description}</p>
              </article>
            );
          })}
        </div>
      </div>

      <div className="story-ending">
        <span className="story-eyebrow">THE NEXT GENERATION OF SOLAR</span>
        <h2>Make every ray count.</h2>
        <p>
          Explore the data. Understand performance. Make smarter
          solar decisions.
        </p>

        <button className="story-cta" onClick={onEnter}>
          Explore SolarGrid <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}
export default AboutSection;
