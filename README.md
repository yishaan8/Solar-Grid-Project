# SolarGrid — Solar Plant Monitoring & Performance Analytics

A modern solar energy monitoring and performance analysis platform. SolarGrid provides solar plant operators and energy analysts with clear visibility into photovoltaic generation trends, environmental conditions, model-based power forecasting, and historical plant performance.

---

## 1. Platform Architecture

The platform is designed with a clear separation of concerns between operational data visualization and statistical power forecasting:

```
SolarGrid Architecture
├── Frontend (React 19 + Vite)
│   ├── Operational Monitoring (Overview)
│   ├── Solar Generation Assets (Plant Profiles)
│   ├── Hardware & Sensor Telemetry (Equipment)
│   ├── Performance & Accuracy Analysis (Validation Curves)
│   └── Forecast & Analysis (Model Architecture & Testing Sandbox)
└── Backend (FastAPI + Python)
    ├── Endpoints: /, /api/health, /api/model-info, /api/predict, /api/history, /api/dashboard
    ├── Feature Pipeline: Diurnal Cyclic Encoding, Thermal Deltas, Interactions
    ├── Model Inference: RandomForestRegressor (scikit-learn 1.6.1)
    └── Data Sources: Plant 1 & 2 Generation & Meteorological Datasets
```

---

## 2. Platform Capabilities

- **Operational Generation Monitoring:** Primary daytime generation history curves with peak power tracking and hourly trends.
- **Meteorological Context:** Collocated pyranometer solar irradiance, module surface temperature, and ambient temperature readings.
- **Multi-Plant Asset Profiles:** Support for Plant 1 (Solar Farm A) and Plant 2 (Solar Farm B) with clear granularity disclosures.
- **Power Forecasting & Model Validation:** Random Forest regression calibrated to predict AC power output from environmental features.
- **Prediction Test Sandbox:** Developer/analyst tool to run manual simulation predictions via `POST /api/predict` with full 8-dimensional feature breakdown.
- **Transparent Scale Management:** Scientifically sound handling of single-inverter model output vs. multi-inverter plant-level aggregate generation.

---

## 3. Machine Learning Forecasting Component

- **Model Type:** `RandomForestRegressor` (scikit-learn 1.6.1)
- **Target Variable:** `AC_POWER` (Kilowatts, single-inverter scale: 0–1,400 kW)
- **Training Plant:** Plant 1, Inverter `1BY6WEcLGh8j5v7`
- **Input Features (8 Dimensions):**
  1. `IRRADIATION`: Solar irradiance from on-site pyranometer (0.0 to 1.2+ range)
  2. `AMBIENT_TEMPERATURE`: Ambient air temperature (°C)
  3. `MODULE_TEMPERATURE`: Panel surface temperature (°C)
  4. `TIME_SIN`: Cyclic time-of-day encoding: $\sin(2\pi \cdot \text{minutes} / 1440)$
  5. `TIME_COS`: Cyclic time-of-day encoding: $\cos(2\pi \cdot \text{minutes} / 1440)$
  6. `TEMP_DIFF`: Module Temperature minus Ambient Temperature
  7. `IRR_TEMP_INTERACTION`: $\text{Irradiation} \times \text{Module Temperature}$
  8. `IRR_TEMP_DIFF`: $\text{Irradiation} \times \text{Thermal Delta}$
- **Validation Accuracy (Plant 1 Daytime Test Set):**
  - **MAE:** 32.15 kW
  - **RMSE:** 71.90 kW
  - **Daytime Records Evaluated:** 325

### Cross-Plant Generalization Note (Plant 2):
Model 1 outputs power on a single-inverter scale. In Plant 2, primary telemetry represents a 22-inverter array aggregate (up to ~26,000 kW). Comparing single-inverter output against plant aggregate directly is withheld to prevent false distortion. Normalized against Plant 2's per-inverter average, the model demonstrates genuine cross-plant generalization with an MAE of **108.08 kW** (RMSE **189.72 kW**).

---

## 4. Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### Terminal 1: Backend Server (FastAPI)
```powershell
cd C:\Solar-Grid-Project\backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
* Interactive API Documentation (Swagger): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* Health Check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### Terminal 2: Frontend Client (React + Vite)
```powershell
cd C:\Solar-Grid-Project
npm run dev
```
* Platform Dashboard: [http://localhost:5173](http://localhost:5173)

---

## 5. Production Build
```powershell
npm run build
```
Generates production assets in `dist/` with optimized chunking and CSS minification.
