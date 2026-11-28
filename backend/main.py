import math
import os
import json
from datetime import datetime, time
from pathlib import Path
from typing import Optional
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from database import check_database_connection
from auth_routes import router as auth_router
from installation_routes import router as installation_router
from telemetry_routes import router as telemetry_router
from dashboard_routes import router as dashboard_router
from farm_routes import router as farm_router
from farm_telemetry_routes import router as farm_telemetry_router
from farm_data_service import load_validated_farm_data
from datetime import date
from simulation_services import get_simulation_range, forecast_from_date

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"

try:
    model = joblib.load(MODELS_DIR / "model1_random_forest.joblib")
    with open(MODELS_DIR / "model1_features.json", "r") as f:
        FEATURE_NAMES: list[str] = json.load(f)
    MODEL_LOADED = True
    MODEL_ERROR: Optional[str] = None
    EXPECTED_N_FEATURES = len(FEATURE_NAMES)
except Exception as exc:
    model = None
    FEATURE_NAMES = []
    MODEL_LOADED = False
    MODEL_ERROR = str(exc)
    EXPECTED_N_FEATURES = 0

_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173,"
    "http://localhost:5174,http://localhost:4174"
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app = FastAPI(
    title="SolarGrid API",
    description="Solar Plant Monitoring & Performance Analytics API",
    version="1.0.0",
)
app.include_router(auth_router)
app.include_router(installation_router)
app.include_router(farm_router)
app.include_router(farm_telemetry_router)
app.include_router(dashboard_router)
app.include_router(telemetry_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/api/simulation/range")
def simulation_range(
    plant: int = Query(1, ge=1, le=2),
):
    """Return the recorded date range available for historical simulation."""
    try:
        return get_simulation_range(plant)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not read simulation date range: {exc}",
        ) from exc


@app.get("/api/simulation/forecast")
def simulation_forecast(
    plant: int = Query(1, ge=1, le=2),
    as_of: date = Query(..., description="Simulated operating date, YYYY-MM-DD"),
    days: int = Query(3, ge=1, le=30),
):
    """Forecast after the selected date using only earlier generation data."""
    try:
        return forecast_from_date(plant, as_of, days)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Historical simulation forecast failed: {exc}",
        ) from exc
def _safe_float(value) -> Optional[float]:
    """Return float or None for NaN/Inf values."""
    try:
        v = float(value)
        if math.isfinite(v):
            return v
        return None
    except (TypeError, ValueError):
        return None


def _get_irradiation_by_timestamp(plant: int) -> dict:
    """Return a timestamp -> IRRADIATION map from validated farm data."""
    try:
        validated_df, _ = load_validated_farm_data(plant)
        return dict(zip(validated_df["DATE_TIME"], validated_df["IRRADIATION"]))
    except (FileNotFoundError, ValueError):
        return {}

_test_results_cache: Optional[pd.DataFrame] = None
_plant1_weather_cache: Optional[pd.DataFrame] = None
_plant1_gen_cache: Optional[pd.DataFrame] = None
_plant2_data_cache: Optional[pd.DataFrame] = None

def _load_test_results() -> pd.DataFrame:
    """Load module1_test_results.csv with column validation (cached)."""
    global _test_results_cache
    if _test_results_cache is not None:
        return _test_results_cache
    path = DATA_DIR / "module1_test_results.csv"
    df = pd.read_csv(path)
    required = {"DATE_TIME", "AC_POWER", "EXPECTED_POWER"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"module1_test_results.csv missing columns: {missing}")
    df["DATE_TIME"] = pd.to_datetime(df["DATE_TIME"], format="mixed")
    df = df.dropna(subset=["DATE_TIME", "AC_POWER", "EXPECTED_POWER"])
    df = df.sort_values("DATE_TIME")
    _test_results_cache = df
    return _test_results_cache

def _load_plant1_weather() -> pd.DataFrame:
    """Plant 1 Weather Sensor Data (YYYY-MM-DD HH:MM:SS format, cached)."""
    global _plant1_weather_cache
    if _plant1_weather_cache is not None:
        return _plant1_weather_cache
    path = DATA_DIR / "Plant_1_Weather_Sensor_Data.csv"
    df = pd.read_csv(path)
    df["DATE_TIME"] = pd.to_datetime(df["DATE_TIME"], format="mixed")
    df = df.sort_values("DATE_TIME")
    _plant1_weather_cache = df
    return _plant1_weather_cache

def _load_plant1_generation() -> pd.DataFrame:
    """Plant 1 Generation Data (DD-MM-YYYY HH:MM format, cached)."""
    global _plant1_gen_cache
    if _plant1_gen_cache is not None:
        return _plant1_gen_cache
    path = DATA_DIR / "Plant_1_Generation_Data.csv"
    df = pd.read_csv(path)
    # Plant 1 uses DD-MM-YYYY HH:MM
    df["DATE_TIME"] = pd.to_datetime(df["DATE_TIME"], format="%d-%m-%Y %H:%M", dayfirst=True)
    df = df.sort_values("DATE_TIME")
    _plant1_gen_cache = df
    return _plant1_gen_cache

def _load_plant2_data() -> pd.DataFrame:
    """
    Merge Plant 2 generation + weather on matching timestamps (cached).
    Returns merged DataFrame with aggregated AC_POWER and averaged weather.
    """
    global _plant2_data_cache
    if _plant2_data_cache is not None:
        return _plant2_data_cache
    gen = pd.read_csv(DATA_DIR / "Plant_2_Generation_Data.csv")
    wea = pd.read_csv(DATA_DIR / "Plant_2_Weather_Sensor_Data.csv")
    gen["DATE_TIME"] = pd.to_datetime(gen["DATE_TIME"], format="mixed")
    wea["DATE_TIME"] = pd.to_datetime(wea["DATE_TIME"], format="mixed")
    gen_agg = gen.groupby("DATE_TIME")["AC_POWER"].sum().reset_index()
    wea_agg = wea.groupby("DATE_TIME")[
        ["AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE", "IRRADIATION"]
    ].mean().reset_index()
    merged = pd.merge(gen_agg, wea_agg, on="DATE_TIME", how="inner")
    merged = merged.sort_values("DATE_TIME")
    _plant2_data_cache = merged
    return _plant2_data_cache

def _get_record_closest_to_current_time(plant: int) -> dict:
    """
    Select a historical record closest to the current local time of day.
    Returns measured generation and weather from the same timestamp.
    """
    if plant == 1:
        generation = _load_plant1_generation().copy()
        weather = _load_plant1_weather().copy()
        # Aggregate inverter output for each timestamp.
        generation = (
            generation.groupby("DATE_TIME", as_index=False)["AC_POWER"]
            .sum()
        )

        # Weather records may have different timestamps, so merge on the
        # nearest timestamp rather than assuming exact equality.
        weather = weather[
            [
                "DATE_TIME",
                "IRRADIATION",
                "AMBIENT_TEMPERATURE",
                "MODULE_TEMPERATURE",
            ]
        ].dropna()

        merged = pd.merge_asof(
            generation.sort_values("DATE_TIME"),
            weather.sort_values("DATE_TIME"),
            on="DATE_TIME",
            direction="nearest",
            tolerance=pd.Timedelta("8min"),
        )

    else:
        merged = _load_plant2_data().copy()

    merged = merged.dropna(
        subset=[
            "DATE_TIME",
            "AC_POWER",
            "IRRADIATION",
            "AMBIENT_TEMPERATURE",
            "MODULE_TEMPERATURE",
        ]
    )

    if merged.empty:
        raise HTTPException(
            status_code=404,
            detail="No matching historical generation and weather readings found.",
        )

    now = datetime.now()
    merged["time_distance"] = (
        (merged["DATE_TIME"].dt.hour * 60 + merged["DATE_TIME"].dt.minute)
        - (now.hour * 60 + now.minute)
    ).abs()

    # Compare only time of day, then prefer the most recent date if tied.
    closest_distance = merged["time_distance"].min()
    candidates = merged[merged["time_distance"] == closest_distance]
    selected = candidates.sort_values("DATE_TIME").iloc[-1]

    return {
        "plant": plant,
        "mode": "historical_replay",
        "is_live": False,
        "timestamp": selected["DATE_TIME"].isoformat(),
        "actual_ac_power": _safe_float(selected["AC_POWER"]),
        "irradiation": _safe_float(selected["IRRADIATION"]),
        "ambient_temperature": _safe_float(
            selected["AMBIENT_TEMPERATURE"]
        ),
        "module_temperature": _safe_float(
            selected["MODULE_TEMPERATURE"]
        ),
    }
# ---------------------------------------------------------------------------
# Feature engineering – must match training notebook exactly
# ---------------------------------------------------------------------------

def _build_feature_row(
    irradiation: float,
    ambient_temperature: float,
    module_temperature: float,
    timestamp: datetime,
) -> pd.DataFrame:
    """
    Constructs the 8-feature vector expected by Model 1.
    Feature order follows FEATURE_NAMES from model1_features.json.

    Engineering:
      TIME_SIN / TIME_COS: encode minutes-since-midnight cyclically over 1440 min
      TEMP_DIFF            = MODULE_TEMPERATURE - AMBIENT_TEMPERATURE
      IRR_TEMP_INTERACTION = IRRADIATION * MODULE_TEMPERATURE
      IRR_TEMP_DIFF        = IRRADIATION * TEMP_DIFF
    """
    minutes = timestamp.hour * 60 + timestamp.minute
    temp_diff = module_temperature - ambient_temperature

    values = {
        "IRRADIATION": irradiation,
        "AMBIENT_TEMPERATURE": ambient_temperature,
        "MODULE_TEMPERATURE": module_temperature,
        "TIME_SIN": math.sin(2 * math.pi * minutes / 1440),
        "TIME_COS": math.cos(2 * math.pi * minutes / 1440),
        "TEMP_DIFF": temp_diff,
        "IRR_TEMP_INTERACTION": irradiation * module_temperature,
        "IRR_TEMP_DIFF": irradiation * temp_diff,
    }

    # Verify feature count matches what the model expects
    if len(FEATURE_NAMES) != EXPECTED_N_FEATURES:
        raise RuntimeError(
            f"Feature list length mismatch: "
            f"got {len(FEATURE_NAMES)}, model expects {EXPECTED_N_FEATURES}"
        )

    row = [[values[name] for name in FEATURE_NAMES]]
    return pd.DataFrame(row, columns=FEATURE_NAMES)


# ---------------------------------------------------------------------------
# Vectorized feature engineering for batch prediction
# ---------------------------------------------------------------------------

def _build_feature_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build the full feature matrix from a DataFrame containing:
    IRRADIATION, AMBIENT_TEMPERATURE, MODULE_TEMPERATURE, DATE_TIME
    Returns a DataFrame with columns in FEATURE_NAMES order.
    """
    minutes = df["DATE_TIME"].dt.hour * 60 + df["DATE_TIME"].dt.minute
    temp_diff = df["MODULE_TEMPERATURE"] - df["AMBIENT_TEMPERATURE"]
    feat = pd.DataFrame({
        "IRRADIATION": df["IRRADIATION"].values,
        "AMBIENT_TEMPERATURE": df["AMBIENT_TEMPERATURE"].values,
        "MODULE_TEMPERATURE": df["MODULE_TEMPERATURE"].values,
        "TIME_SIN": np.sin(2 * np.pi * minutes.values / 1440),
        "TIME_COS": np.cos(2 * np.pi * minutes.values / 1440),
        "TEMP_DIFF": temp_diff.values,
        "IRR_TEMP_INTERACTION": (df["IRRADIATION"] * df["MODULE_TEMPERATURE"]).values,
        "IRR_TEMP_DIFF": (df["IRRADIATION"] * temp_diff).values,
    })
    return feat[FEATURE_NAMES]


# Simple in-process cache for Plant 2 evaluation metrics
_plant2_metrics_cache: Optional[dict] = None


def _get_plant2_metrics_cached() -> dict:
    """Compute Plant 2 cross-evaluation metrics once; return cached result on subsequent calls."""
    global _plant2_metrics_cache
    if _plant2_metrics_cache is not None:
        return _plant2_metrics_cache

    # Build per-inverter mean data to align scale with single-inverter model (0-1.4k kW)
    df2g = pd.read_csv(DATA_DIR / "Plant_2_Generation_Data.csv")
    df2g["DATE_TIME"] = pd.to_datetime(df2g["DATE_TIME"], format="mixed")
    agg2_mean = df2g.groupby("DATE_TIME")["AC_POWER"].mean().reset_index()

    wea = pd.read_csv(DATA_DIR / "Plant_2_Weather_Sensor_Data.csv")
    wea["DATE_TIME"] = pd.to_datetime(wea["DATE_TIME"], format="mixed")
    wea_agg = wea.groupby("DATE_TIME")[
        ["AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE", "IRRADIATION"]
    ].mean().reset_index()

    merged_mean = pd.merge(agg2_mean, wea_agg, on="DATE_TIME", how="inner")
    df2_day = merged_mean[merged_mean["IRRADIATION"] > 0].dropna().copy()

    feat_matrix = _build_feature_matrix(df2_day)
    predictions = model.predict(feat_matrix)
    actuals = df2_day["AC_POWER"].values

    # Filter finite pairs
    mask = np.isfinite(predictions) & np.isfinite(actuals)
    predictions = predictions[mask]
    actuals = actuals[mask]

    if len(predictions) == 0:
        _plant2_metrics_cache = {"error": "No valid predictions for Plant 2"}
        return _plant2_metrics_cache

    mae2 = float(np.mean(np.abs(actuals - predictions)))
    rmse2 = float(np.sqrt(np.mean((actuals - predictions) ** 2)))

    _plant2_metrics_cache = {
        "mae": round(mae2, 4),
        "rmse": round(rmse2, 4),
        "n_daytime_records": int(len(predictions)),
        "scope": "Like-for-Like Inverter Benchmark",
        "methodology": (
            "Model 1 was trained on a single inverter. Comparing against Plant 2 per-inverter average "
            "aligns scale (0–1,200 kW) for an honest cross-plant generalization test."
        ),
    }
    return _plant2_metrics_cache


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class PredictionRequest(BaseModel):
    timestamp: datetime
    irradiation: float = Field(..., ge=0.0, description="Solar irradiation (0–~1.3 range as in training data)")
    ambient_temperature: float = Field(..., description="Ambient temperature in °C")
    module_temperature: float = Field(..., description="Module/panel temperature in °C")


class PredictionResponse(BaseModel):
    predicted_ac_power: float
    timestamp: str
    input_features: dict
    note: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/db-health")
def database_health():
    connected = check_database_connection()

    return {
        "database": "MongoDB Atlas",
        "connected": connected,
        "status": "healthy" if connected else "unavailable"
    }

@app.get("/")
def root():
    return {
        "platform": "SolarGrid",
        "description": "Solar Plant Monitoring & Performance Analytics",
        "version": "1.0.0",
        "model": "RandomForestRegressor (Model 1)",
        "endpoints": ["/api/health", "/api/model-info", "/api/predict", "/api/history", "/api/dashboard"],
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "ok" if MODEL_LOADED else "degraded",
        "model_loaded": MODEL_LOADED,
        "model_type": type(model).__name__ if MODEL_LOADED else None,
        "model_error": MODEL_ERROR,
        "feature_count": EXPECTED_N_FEATURES,
        "allowed_origins": ALLOWED_ORIGINS,
    }


@app.get("/api/model-info")
def model_info():
    if not MODEL_LOADED:
        raise HTTPException(status_code=503, detail=f"Model not loaded: {MODEL_ERROR}")
    return {
        "model_type": type(model).__name__,
        "features": FEATURE_NAMES,
        "n_features": EXPECTED_N_FEATURES,
        "target": "AC_POWER (plant-level aggregate, units matching training data)",
        "training_plant": "Plant 1",
        "sklearn_version_trained": "1.6.1",
        "feature_engineering": {
            "TIME_SIN": "sin(2π * minutes_since_midnight / 1440)",
            "TIME_COS": "cos(2π * minutes_since_midnight / 1440)",
            "TEMP_DIFF": "MODULE_TEMPERATURE - AMBIENT_TEMPERATURE",
            "IRR_TEMP_INTERACTION": "IRRADIATION * MODULE_TEMPERATURE",
            "IRR_TEMP_DIFF": "IRRADIATION * TEMP_DIFF",
        },
    }


@app.post("/api/predict", response_model=PredictionResponse)
def predict(payload: PredictionRequest):
    if not MODEL_LOADED:
        raise HTTPException(status_code=503, detail=f"Model not loaded: {MODEL_ERROR}")

    try:
        input_df = _build_feature_row(
            irradiation=payload.irradiation,
            ambient_temperature=payload.ambient_temperature,
            module_temperature=payload.module_temperature,
            timestamp=payload.timestamp,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Feature engineering failed: {exc}")

    try:
        prediction = float(model.predict(input_df)[0])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}")

    if not math.isfinite(prediction):
        raise HTTPException(status_code=500, detail="Model returned non-finite prediction")

    # Build input feature summary for response
    row = input_df.iloc[0].to_dict()
    input_features = {k: round(v, 6) if isinstance(v, float) else v for k, v in row.items()}

    return PredictionResponse(
        predicted_ac_power=round(prediction, 4),
        timestamp=payload.timestamp.isoformat(),
        input_features=input_features,
        note="AC_POWER in same units as Plant 1 training data (plant-level aggregate of all inverters).",
    )


@app.get("/api/history")
def history(
    plant: int = Query(1, ge=1, le=2, description="Plant number (1 or 2)"),
    limit: int = Query(200, ge=1, le=1000, description="Maximum number of records"),
):
    """Return the same farm-level evaluation records used by /api/farm/history."""
    filename = "farm_test_results.csv" if plant == 1 else "farm_plant2_results.csv"
    path = MODELS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=503, detail="Farm evaluation results not found. Train the farm model first.")

    try:
        frame = pd.read_csv(path)
        required = {"DATE_TIME", "AC_POWER", "EXPECTED_POWER", "RESIDUAL"}
        missing = required - set(frame.columns)
        if missing:
            raise ValueError(f"Evaluation file is missing columns: {sorted(missing)}")
        frame["DATE_TIME"] = pd.to_datetime(frame["DATE_TIME"], errors="coerce")
        frame = frame.dropna(subset=["DATE_TIME", "AC_POWER", "EXPECTED_POWER"])
        frame = frame.sort_values("DATE_TIME").tail(limit)
        irradiation_by_ts = _get_irradiation_by_timestamp(plant)
        records = []
        for _, row in frame.iterrows():
            raw_irr = irradiation_by_ts.get(row["DATE_TIME"])
            records.append({
                "timestamp": row["DATE_TIME"].isoformat(),
                "actual_ac_power": round(float(row["AC_POWER"]), 3),
                "predicted_ac_power": round(float(row["EXPECTED_POWER"]), 3),
                "residual": round(float(row["RESIDUAL"]), 3),
                "irradiation": _safe_float(raw_irr),
            })
        return {
            "plant": plant,
            "source": filename,
            "mode": "historical_model_evaluation" if plant == 1 else "cross_plant_evaluation",
            "comparable": plant == 1,
            "unit": "AC_POWER dataset units",
            "count": len(records),
            "period_start": records[0]["timestamp"] if records else None,
            "period_end": records[-1]["timestamp"] if records else None,
            "records": records,
            "note": "Plant 2 results are cross-plant evaluation using the Plant 1 model; they are not independent validation." if plant == 2 else "Plant 1 held-out evaluation records using complete 22-inverter timestamps.",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load farm history: {exc}") from exc

@app.get("/api/replay/current")
def replay_current(
    plant: int = Query(
        default=1,
        ge=1,
        le=2,
        description="Plant ID: 1 or 2",
    ),
):
    """
    Return the historical reading closest to the current time of day.
    This is historical replay, not live sensor telemetry.
    """
    try:
        reading = _get_record_closest_to_current_time(plant)

        if not reading:
            raise HTTPException(
                status_code=404,
                detail=f"No historical readings available for Plant {plant}.",
            )

        return {
            **reading,
            "mode": "historical_replay",
            "is_live": False,
            "message": "Displaying historical data matched to the current time of day.",
        }

    except HTTPException:
        raise

    except (ValueError, KeyError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Unable to process historical data for Plant {plant}: {exc}",
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while retrieving historical data.",
        ) from exc

@app.get("/api/dashboard")
def dashboard(plant: int = Query(1, ge=1, le=2), limit: int = Query(200, ge=1, le=1000)):
    """Owner dashboard backed by the exact farm-level evaluation records used by Forecast."""
    filename = "farm_test_results.csv" if plant == 1 else "farm_plant2_results.csv"
    results_path = MODELS_DIR / filename
    metrics_path = MODELS_DIR / "farm_metrics.json"
    if not results_path.exists():
        raise HTTPException(status_code=503, detail="Farm evaluation results not found. Train the farm model first.")

    try:
        frame = pd.read_csv(results_path)
        required = {"DATE_TIME", "AC_POWER", "EXPECTED_POWER", "IRRADIATION", "AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE"}
        missing = required - set(frame.columns)
        if missing:
            raise ValueError(f"Evaluation file is missing columns: {sorted(missing)}")
        frame["DATE_TIME"] = pd.to_datetime(frame["DATE_TIME"], errors="coerce")
        frame = frame.dropna(subset=list(required)).sort_values("DATE_TIME")
        frame = frame.tail(limit).copy()
        if frame.empty:
            raise ValueError("No valid farm evaluation records are available.")

        irradiation_by_ts = _get_irradiation_by_timestamp(plant)
        generation_chart = []
        for _, row in frame.iterrows():
            raw_irr = irradiation_by_ts.get(row["DATE_TIME"])
            if raw_irr is None and "IRRADIATION" in frame.columns:
                raw_irr = row["IRRADIATION"]
            generation_chart.append({
                "timestamp": row["DATE_TIME"].isoformat(),
                "actual_ac_power": round(float(row["AC_POWER"]), 3),
                "predicted_ac_power": round(float(row["EXPECTED_POWER"]), 3),
                "ac_power": round(float(row["AC_POWER"]), 3),
                "irradiation": _safe_float(raw_irr),
            })

        latest = frame.iloc[-1]
        latest_weather = {
            "timestamp": latest["DATE_TIME"].isoformat(),
            "irradiation": _safe_float(latest["IRRADIATION"]),
            "ambient_temperature": _safe_float(latest["AMBIENT_TEMPERATURE"]),
            "module_temperature": _safe_float(latest["MODULE_TEMPERATURE"]),
        }

        model_metrics = {}
        if metrics_path.exists():
            with open(metrics_path, "r", encoding="utf-8") as file:
                all_metrics = json.load(file)
            model_metrics = all_metrics.get("overall", {}) if plant == 1 else (all_metrics.get("plant2_cross_evaluation") or {})
        model_metrics.update({
            "status": "evaluated" if plant == 1 else "cross_plant_evaluation",
            "comparable": plant == 1,
            "training_plant": 1,
        })

        coverage = None
        if metrics_path.exists():
            coverage_key = "plant1_data_coverage" if plant == 1 else "plant2_data_coverage"
            coverage = all_metrics.get(coverage_key)

        active_plant_data = {
            "plant_id": plant,
            "name": f"Solar Farm {'A' if plant == 1 else 'B'} (Plant {plant})",
            "latest_weather": latest_weather,
            "generation_chart": generation_chart,
            "model_metrics": model_metrics,
            "total_generation": None,
            "scale_note": "Farm-level AC_POWER summed across 22 distinct inverters at complete timestamps.",
            "source": filename,
            "observation_count": len(generation_chart),
            "period_start": generation_chart[0]["timestamp"],
            "period_end": generation_chart[-1]["timestamp"],
            "data_coverage": coverage,
            "is_live": False,
            "comparison_note": "Plant 2 is cross-plant evaluation using the Plant 1 model; not independently validated." if plant == 2 else "Plant 1 held-out evaluation using the farm-level model.",
        }
        return {
            "mode": "historical_model_evaluation" if plant == 1 else "cross_plant_evaluation",
            "is_live": False,
            "note": "All values come from historical CSV evaluation records. No live IoT telemetry is connected.",
            "selected_plant": plant,
            "active_plant": active_plant_data,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to build farm dashboard: {exc}") from exc

@app.get("/api/farm/anomalies")
def farm_anomalies(
    plant: int = Query(1, ge=1, le=2),
    limit: int = Query(100, ge=1, le=1000),
):
    """Return historical holdout anomaly candidates for the selected plant."""
    path = MODELS_DIR / f"farm_plant{plant}_anomaly_results.csv"

    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Anomaly results for Plant {plant} not found. Train the anomaly model first.",
        )

    try:
        frame = pd.read_csv(path)
        required = {
            "DATE_TIME", "AC_POWER", "IRRADIATION",
            "ANOMALY", "ANOMALY_SCORE", "STATUS",
        }
        missing = required - set(frame.columns)
        if missing:
            raise ValueError(f"Anomaly results missing columns: {sorted(missing)}")

        frame["DATE_TIME"] = pd.to_datetime(frame["DATE_TIME"], errors="coerce")
        frame = frame.dropna(subset=["DATE_TIME"]).sort_values("DATE_TIME")
        frame = frame[frame["ANOMALY"].astype(str).str.lower().isin(["true", "1"])]

        records = []
        for _, row in frame.tail(limit).iterrows():
            records.append({
                "timestamp": row["DATE_TIME"].isoformat(),
                "actual_ac_power": _safe_float(row["AC_POWER"]),
                "irradiation": _safe_float(row["IRRADIATION"]),
                "anomaly_score": _safe_float(row["ANOMALY_SCORE"]),
                "status": "anomaly_candidate",
            })

        return {
            "plant": plant,
            "source": path.name,
            "mode": "historical_holdout",
            "is_live": False,
            "count": len(records),
            "records": records,
            "note": "Unsupervised anomaly candidates from historical holdout data; not confirmed faults.",
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load anomaly results: {exc}",
        ) from exc