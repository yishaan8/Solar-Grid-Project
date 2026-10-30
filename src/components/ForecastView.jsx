
import React, { useState } from "react";
import "./ForecastView.css";
import {
  TrendingUp,
  Cpu,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  Database,
  BrainCircuit,
  Clock3,
  Zap,
  Info,
  LoaderCircle,
} from "lucide-react";
import { fetchPrediction } from "../api/client";

const FEATURES = [
  {
    name: "IRRADIATION",
    description: "Recorded solar irradiance",
  },
  {
    name: "AMBIENT_TEMPERATURE",
    description: "Surrounding air temperature",
  },
  {
    name: "MODULE_TEMPERATURE",
    description: "Solar module temperature",
  },
  {
    name: "TIME_SIN",
    description: "Cyclic time encoding using sine",
  },
  {
    name: "TIME_COS",
    description: "Cyclic time encoding using cosine",
  },
  {
    name: "TEMP_DIFF",
    description: "Module temperature minus ambient temperature",
  },
  {
    name: "IRR_TEMP_INTERACTION",
    description: "Irradiance multiplied by module temperature",
  },
  {
    name: "IRR_TEMP_DIFF",
    description: "Irradiance multiplied by thermal difference",
  },
];

const INITIAL_INPUTS = {
  timestamp: "2020-06-11T12:00",
  irradiation: "0.75",
  ambientTemp: "30.0",
  moduleTemp: "42.0",
};

function formatValue(value, digits = 4) {
  const number = Number(value);

  if (value === null || value === undefined || !Number.isFinite(number)) {
    return "—";
  }

  return number.toFixed(digits);
}

function ForecastView() {
  const [inputs, setInputs] = useState(INITIAL_INPUTS);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updateInput = (field, value) => {
    setInputs((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handlePredict = async (event) => {
    event.preventDefault();

    setError("");
    setResult(null);

    const irradiation = Number(inputs.irradiation);
    const ambient = Number(inputs.ambientTemp);
    const module = Number(inputs.moduleTemp);

    if (
      !inputs.timestamp ||
      !Number.isFinite(irradiation) ||
      !Number.isFinite(ambient) ||
      !Number.isFinite(module)
    ) {
      setError("Please enter valid values for all input fields.");
      return;
    }

    if (irradiation < 0 || irradiation > 2) {
      setError("Irradiance must be between 0 and 2.");
      return;
    }

    if (ambient < -50 || ambient > 100 || module < -50 || module > 150) {
      setError("Please enter realistic temperature values.");
      return;
    }

    const selectedDate = new Date(inputs.timestamp);

    if (Number.isNaN(selectedDate.getTime())) {
      setError("Please select a valid timestamp.");
      return;
    }

    const payload = {
      timestamp: selectedDate.toISOString(),
      irradiation,
      ambient_temperature: ambient,
      module_temperature: module,
    };

    try {
      setLoading(true);

      const response = await fetchPrediction(payload);

      if (!response || response.error) {
        throw new Error(response?.error || "Prediction request failed.");
      }

      setResult(response.data);
    } catch (err) {
      setError(
        err.message || "Unable to connect to the prediction service."
      );
    } finally {
      setLoading(false);
    }
  };

  const predictedPower =
    result?.predicted_ac_power ??
    result?.prediction ??
    result?.predicted_value;

  const evaluatedFeatures =
    result?.input_features ??
    result?.features ??
    null;

  return (
    <section className="forecast-page">
      {/* PAGE HEADER */}
      <div className="forecast-page-header">
        <div>
          <span className="forecast-eyebrow">
            SOLARGRID / MODEL ANALYTICS
          </span>

          <h2>Forecast &amp; Analysis</h2>

          <p>
            Explore the generation prediction model, feature
            engineering and model inference.
          </p>
        </div>

        <span className="forecast-mode-pill">
          <SlidersHorizontal size={15} />
          Model testing environment
        </span>
      </div>

      {/* MODEL ARCHITECTURE */}
      <article className="forecast-card model-architecture-card">
        <div className="forecast-card-heading">
          <div className="forecast-heading-icon green-icon">
            <BrainCircuit size={20} />
          </div>

          <div>
            <h3>Forecasting Model Architecture</h3>
            <p>Model 1 · Supervised generation prediction</p>
          </div>

          <span className="model-ready-badge">
            <CheckCircle2 size={14} />
            Model endpoint configured
          </span>
        </div>

        <div className="model-spec-grid">
          <div className="model-spec">
            <span>ALGORITHM</span>
            <strong>Random Forest</strong>
            <small>Regression model</small>
          </div>

          <div className="model-spec">
            <span>TARGET VARIABLE</span>
            <strong>AC_POWER</strong>
            <small>Generation power prediction</small>
          </div>

          <div className="model-spec">
            <span>PRIMARY PREDICTOR</span>
            <strong>Solar Irradiance</strong>
            <small>Combined with temperature and time</small>
          </div>

          <div className="model-spec">
            <span>INPUT VECTOR</span>
            <strong>8 Features</strong>
            <small>Raw readings + engineered features</small>
          </div>
        </div>

        <div className="model-scope-note">
          <Info size={16} />
          <span>
            The current Random Forest model is trained using Plant 1
            historical data. Its predictions are statistical estimates,
            not live sensor measurements.
          </span>
        </div>
      </article>

      {/* FEATURE ENGINEERING */}
      <article className="forecast-card feature-engineering-card">
        <div className="forecast-card-heading">
          <div className="forecast-heading-icon blue-icon">
            <Database size={20} />
          </div>

          <div>
            <h3>Derived Feature Transformations</h3>
            <p>
              Eight-dimensional input vector constructed by the backend
              before model inference.
            </p>
          </div>
        </div>

        <div className="feature-list">
          {FEATURES.map((feature, index) => (
            <div className="feature-row" key={feature.name}>
              <span className="feature-number">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div>
                <strong>{feature.name}</strong>
                <p>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </article>

      {/* PREDICTION SANDBOX */}
      <article className="forecast-card prediction-sandbox">
        <div className="forecast-card-heading sandbox-heading">
          <div className="forecast-heading-icon purple-icon">
            <SlidersHorizontal size={20} />
          </div>

          <div>
            <h3>Prediction Test Sandbox</h3>
            <p>
              Test model inference using custom environmental readings.
            </p>
          </div>

          <span className="endpoint-badge">
            POST /api/predict
          </span>
        </div>

        <div className="sandbox-notice">
          <Info size={16} />
          <span>
            Enter historical or hypothetical sensor values. The result
            is a model estimate and does not represent actual plant
            telemetry.
          </span>
        </div>

        <form onSubmit={handlePredict}>
          <div className="forecast-form-grid">
            <div className="forecast-input-group">
              <label htmlFor="forecast-timestamp">
                <Clock3 size={14} />
                Timestamp
              </label>

              <input
                id="forecast-timestamp"
                type="datetime-local"
                value={inputs.timestamp}
                onChange={(event) =>
                  updateInput("timestamp", event.target.value)
                }
                required
              />
            </div>

            <div className="forecast-input-group">
              <label htmlFor="forecast-irradiation">
                <Zap size={14} />
                Solar Irradiance
              </label>

              <input
                id="forecast-irradiation"
                type="number"
                step="0.01"
                min="0"
                max="2"
                value={inputs.irradiation}
                onChange={(event) =>
                  updateInput("irradiation", event.target.value)
                }
                required
              />

              <small>Dataset scale · W/m² normalization as supplied</small>
            </div>

            <div className="forecast-input-group">
              <label htmlFor="forecast-ambient">
                Ambient Temperature
              </label>

              <div className="input-with-unit">
                <input
                  id="forecast-ambient"
                  type="number"
                  step="0.1"
                  value={inputs.ambientTemp}
                  onChange={(event) =>
                    updateInput("ambientTemp", event.target.value)
                  }
                  required
                />
                <span>°C</span>
              </div>
            </div>

            <div className="forecast-input-group">
              <label htmlFor="forecast-module">
                Module Temperature
              </label>

              <div className="input-with-unit">
                <input
                  id="forecast-module"
                  type="number"
                  step="0.1"
                  value={inputs.moduleTemp}
                  onChange={(event) =>
                    updateInput("moduleTemp", event.target.value)
                  }
                  required
                />
                <span>°C</span>
              </div>
            </div>
          </div>

          <div className="sandbox-submit-row">
            <button
              type="submit"
              className="forecast-submit-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle size={17} className="forecast-spin" />
                  Running prediction...
                </>
              ) : (
                <>
                  Execute Prediction
                  <TrendingUp size={17} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* ERROR */}
        {error && (
          <div className="forecast-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* PREDICTION RESULT */}
        {result && (
          <div className="forecast-result">
            <div className="result-heading">
              <div>
                <span className="result-eyebrow">
                  MODEL INFERENCE COMPLETE
                </span>
                <h4>Prediction Result</h4>
              </div>

              <span className="result-success">
                <CheckCircle2 size={14} />
                Successful
              </span>
            </div>

            <div className="result-power-card">
              <div className="result-power-icon">
                <Zap size={22} />
              </div>

              <div>
                <span>Predicted AC Power</span>
                <strong>
                  {formatValue(predictedPower, 3)}
                </strong>
                <small>
                  In the model's output units
                </small>
              </div>
            </div>

            {result.note && (
              <p className="result-note">{result.note}</p>
            )}

            {evaluatedFeatures &&
              Object.keys(evaluatedFeatures).length > 0 && (
                <div className="evaluated-features">
                  <h4>Evaluated Feature Vector</h4>

                  <div className="evaluated-features-grid">
                    {Object.entries(evaluatedFeatures).map(
                      ([key, value]) => (
                        <div
                          className="evaluated-feature"
                          key={key}
                        >
                          <span>{key}</span>
                          <strong>
                            {typeof value === "number"
                              ? formatValue(value)
                              : String(value)}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
          </div>
        )}
      </article>

      {/* MODEL 2 STATUS */}
      <article className="forecast-card anomaly-status-card">
        <div className="forecast-card-heading">
          <div className="forecast-heading-icon orange-icon">
            <Cpu size={20} />
          </div>

          <div>
            <h3>Anomaly &amp; Fault Detection</h3>
            <p>Model 2 · Unsupervised anomaly detection</p>
          </div>

          <span className="integration-pending-badge">
            Integration pending
          </span>
        </div>

        <div className="anomaly-status-content">
          <div className="anomaly-status-icon">
            <Info size={21} />
          </div>

          <div>
            <strong>Isolation Forest integration pending</strong>

            <p>
              The anomaly detection model is not yet connected to the
              FastAPI backend. Once its model artifact, feature
              preprocessing and detection threshold are integrated,
              this section can display anomaly scores and fault
              classifications.
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}

export default ForecastView;
