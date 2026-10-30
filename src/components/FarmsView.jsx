
import React from "react";
import "./FarmsView.css";
import {
  Sun,
  MapPin,
  ArrowRight,
  Database,
  BrainCircuit,
  ChartNoAxesCombined,
  Clock3,
  CheckCircle2,
  Info,
} from "lucide-react";

function FarmsView({
  selectedPlant,
  onSelectPlant,
  onNavigateTab,
}) {
  const farms = [
    {
      id: 1,
      name: "Solar Farm 01",
      subtitle: "Plant 1",
      location: "Karnataka, India",
      dataset: "Plant 1 Generation & Weather Data",
      description:
        "Historical solar generation and weather observations used for generation analysis and Random Forest model evaluation.",
      modelStatus: "Model comparison available",
      modelDescription:
        "Random Forest prediction results are available for this dataset.",
      modelAvailable: true,
      color: "green",
      features: [
        "Generation records",
        "Weather observations",
        "Actual vs predicted analysis",
      ],
    },
    {
      id: 2,
      name: "Solar Farm 02",
      subtitle: "Plant 2",
      location: "Karnataka, India",
      dataset: "Plant 2 Generation & Weather Data",
      description:
        "A second historical solar dataset for exploring generation patterns and weather conditions.",
      modelStatus: "Prediction comparison unavailable",
      modelDescription:
        "The current Random Forest model was trained on Plant 1 data. Plant 2 aggregate readings are not directly comparable.",
      modelAvailable: false,
      color: "blue",
      features: [
        "Generation records",
        "Weather observations",
        "Historical pattern analysis",
      ],
    },
  ];

  const handleSelect = (plantId) => {
    onSelectPlant?.(plantId);
  };

  const handleOpenOverview = (event, plantId) => {
    event.stopPropagation();
    handleSelect(plantId);
    onNavigateTab?.("overview");
  };

  return (
    <section className="farms-page">
      {/* PAGE HEADER */}
      <div className="farms-page-header">
        <div>
          <span className="farms-eyebrow">
            SOLARGRID / DATASETS
          </span>

          <h2>Your Solar Farms</h2>

          <p>
            Explore historical generation and weather data across
            your solar plants.
          </p>
        </div>

        <div className="farms-count">
          <Database size={17} />
          <span>2 datasets available</span>
        </div>
      </div>

      {/* HISTORICAL DATA NOTICE */}
      <div className="farms-notice">
        <Clock3 size={18} />

        <div>
          <strong>Historical demo environment</strong>
          <span>
            These plants use recorded CSV datasets. No live sensor
            telemetry is connected.
          </span>
        </div>
      </div>

      {/* FARM CARDS */}
      <div className="farms-list">
        {farms.map((farm) => {
          const isSelected = selectedPlant === farm.id;

          return (
            <article
              key={farm.id}
              className={`farm-card ${farm.color} ${
                isSelected ? "selected" : ""
              }`}
              onClick={() => handleSelect(farm.id)}
              aria-label={`Select ${farm.name}`}
            >
              {/* CARD HEADER */}
              <div className="farm-card-header">
                <div className="farm-identity">
                  <div className="farm-icon">
                    <Sun size={23} />
                  </div>

                  <div>
                    <span className="farm-plant-label">
                      {farm.subtitle}
                    </span>

                    <h3>{farm.name}</h3>

                    <span className="farm-location">
                      <MapPin size={13} />
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

              {/* DESCRIPTION */}
              <p className="farm-description">
                {farm.description}
              </p>

              {/* DATASET */}
              <div className="farm-dataset-box">
                <div className="farm-dataset-icon">
                  <Database size={18} />
                </div>

                <div>
                  <span>Dataset source</span>
                  <strong>{farm.dataset}</strong>
                </div>
              </div>

              {/* FEATURES */}
              <div className="farm-features">
                {farm.features.map((feature) => (
                  <span key={feature}>
                    <CheckCircle2 size={13} />
                    {feature}
                  </span>
                ))}
              </div>

              {/* MODEL STATUS */}
              <div
                className={`farm-model-status ${
                  farm.modelAvailable
                    ? "model-available"
                    : "model-limited"
                }`}
              >
                <div className="farm-model-icon">
                  {farm.modelAvailable ? (
                    <BrainCircuit size={19} />
                  ) : (
                    <Info size={19} />
                  )}
                </div>

                <div>
                  <strong>{farm.modelStatus}</strong>
                  <p>{farm.modelDescription}</p>
                </div>
              </div>

              {/* FOOTER */}
              <div className="farm-card-footer">
                <div className="farm-data-status">
                  <span className="farm-status-dot" />
                  Historical dataset
                </div>

                <button
                  className="farm-open-button"
                  onClick={(event) =>
                    handleOpenOverview(event, farm.id)
                  }
                >
                  Open in Overview
                  <ArrowRight size={15} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* DATASET INFORMATION */}
      <div className="farms-info-card">
        <div className="farms-info-icon">
          <ChartNoAxesCombined size={20} />
        </div>

        <div>
          <h3>About your datasets</h3>
          <p>
            SolarGrid uses historical generation and weather
            observations to explore solar power patterns. Plant 1
            currently supports the available Random Forest model
            comparison. Plant 2 is available for historical data
            exploration while model compatibility is addressed.
          </p>
        </div>
      </div>
    </section>
  );
}

export default FarmsView;
