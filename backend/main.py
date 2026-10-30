"""
SolarHub AI - FastAPI Backend
Model 1: RandomForestRegressor for AC_POWER prediction (Plant 1)
"""
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

# ---------------------------------------------------------------------------
# Paths – always relative to this file, not the CWD
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"

# ---------------------------------------------------------------------------
# Model – loaded once at startup
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# CORS origins
# ---------------------------------------------------------------------------
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173"
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SolarGrid API",
    description="Solar Plant Monitoring & Performance Analytics API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# CSV loading helpers
# ---------------------------------------------------------------------------

def _safe_float(value) -> Optional[float]:
    """Return float or None for NaN/Inf values."""
    try:
        v = float(value)
        if math.isfinite(v):
            return v
        return None
    except (TypeError, ValueError):
        return None


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
    """
    Returns historical actual vs. predicted AC_POWER for charting.
    Plant 1: uses pre-computed module1_test_results.csv (evaluation set).
    Plant 2: runs Model 1 inference on Plant 2 data (cross-plant evaluation).
    """
    if plant == 1:
        try:
            df = _load_test_results()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to load test results: {exc}")

        # Take last `limit` daytime records (irradiation > 0 means daytime)
        df_day = df[df["AC_POWER"] > 0].tail(limit)
        if df_day.empty:
            df_day = df.tail(limit)

        records = []
        for _, row in df_day.iterrows():
            actual = _safe_float(row["AC_POWER"])
            predicted = _safe_float(row["EXPECTED_POWER"])
            if actual is None or predicted is None:
                continue
            records.append({
                "timestamp": row["DATE_TIME"].isoformat(),
                "actual_ac_power": round(actual, 4),
                "predicted_ac_power": round(predicted, 4),
                "residual": _safe_float(row.get("RESIDUAL")),
                "abs_error": _safe_float(row.get("ABS_ERROR")),
            })

        return {
            "plant": 1,
            "source": "module1_test_results.csv (evaluation set, not live)",
            "mode": "historical_demo",
            "count": len(records),
            "records": records,
        }

    else:  # plant == 2
        # Model 1 was trained on Plant 1's single inverter (0–1.4k kW scale), while Plant 2 total generation
        # represents 22 inverters aggregated (0–26k kW scale).
        # Direct plant-level overlay is withheld to prevent plotting incomparable values on a distorted scale.
        return {
            "plant": 2,
            "source": "Plant_2_Generation_Data.csv",
            "mode": "historical_demo",
            "comparable": False,
            "reason": (
                "Model 1 was trained specifically on Plant 1's single inverter (1BY6WEcLGh8j5v7, scale 0–1,400 kW). "
                "Plant 2 generation in this view represents multi-inverter aggregate (scale 0–26,000 kW). "
                "Direct model comparison is withheld to prevent plotting incomparable values on a distorted scale."
            ),
            "count": 0,
            "records": [],
        }

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
def dashboard(plant: int = Query(1, ge=1, le=2)):
    """
    Returns summary statistics and chart-ready data for the dashboard.
    """
    # --- Plant 1 test results metrics ---
    try:
        df_test = _load_test_results()
        # Only use rows where actual > 0 to avoid MAPE blow-up
        df_valid = df_test[df_test["AC_POWER"] > 0].copy()

        mae = float(np.mean(np.abs(df_valid["AC_POWER"] - df_valid["EXPECTED_POWER"])))
        rmse = float(np.sqrt(np.mean((df_valid["AC_POWER"] - df_valid["EXPECTED_POWER"]) ** 2)))

        model_metrics = {
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "n_eval_records": int(len(df_test)),
            "n_daytime_records": int(len(df_valid)),
            "source": "module1_test_results.csv",
            "note": "Metrics computed on Plant 1 evaluation set (daytime rows only for MAE/RMSE).",
        }
    except Exception as exc:
        model_metrics = {"error": str(exc)}

    # --- Recent weather (Plant 1) ---
    try:
        df_wea = _load_plant1_weather()
        latest_wea = df_wea.dropna(subset=["IRRADIATION", "AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE"])
        latest_wea = latest_wea[latest_wea["IRRADIATION"] > 0]
        if latest_wea.empty:
            latest_wea = df_wea.dropna(subset=["AMBIENT_TEMPERATURE"])
        last_row = latest_wea.iloc[-1]
        latest_weather = {
            "timestamp": last_row["DATE_TIME"].isoformat(),
            "irradiation": _safe_float(last_row["IRRADIATION"]),
            "ambient_temperature": _safe_float(last_row["AMBIENT_TEMPERATURE"]),
            "module_temperature": _safe_float(last_row["MODULE_TEMPERATURE"]),
        }
    except Exception as exc:
        latest_weather = {"error": str(exc)}

    # --- Recent generation (Plant 1) ---
    try:
        df_test = _load_test_results()
        df_recent = df_test[df_test["AC_POWER"] > 0].tail(48)
        df_gen = _load_plant1_generation()
        df_gen_agg = df_gen.groupby("DATE_TIME")["AC_POWER"].sum().reset_index()
        total_gen_kwh = _safe_float(df_gen_agg["AC_POWER"].sum())

        gen_chart = [
            {
                "timestamp": row["DATE_TIME"].isoformat(),
                "actual_ac_power": round(float(row["AC_POWER"]) * 22, 1),
                "predicted_ac_power": round(float(row["EXPECTED_POWER"]) * 22, 1),
                "ac_power": round(float(row["AC_POWER"]) * 22, 1),
                "inverter_actual": round(float(row["AC_POWER"]), 1),
                "inverter_predicted": round(float(row["EXPECTED_POWER"]), 1),
            }
            for _, row in df_recent.iterrows()
            if _safe_float(row["AC_POWER"]) is not None
        ]
    except Exception as exc:
        gen_chart = []
        total_gen_kwh = None

    # --- Plant 2 specific data for active plant view ---
    try:
        df2 = _load_plant2_data()
        latest_wea2 = df2[df2["IRRADIATION"] > 0]
        if latest_wea2.empty:
            latest_wea2 = df2
        last_r2 = latest_wea2.iloc[-1]
        p2_weather = {
            "timestamp": last_r2["DATE_TIME"].isoformat(),
            "irradiation": _safe_float(last_r2["IRRADIATION"]),
            "ambient_temperature": _safe_float(last_r2["AMBIENT_TEMPERATURE"]),
            "module_temperature": _safe_float(last_r2["MODULE_TEMPERATURE"]),
        }
        p2_recent = df2[df2["IRRADIATION"] > 0.05].tail(48).copy()
        p2_preds = model.predict(_build_feature_matrix(p2_recent)) * 22 if MODEL_LOADED else np.zeros(len(p2_recent))
        p2_gen_chart = [
            {
                "timestamp": row["DATE_TIME"].isoformat(),
                "actual_ac_power": round(float(row["AC_POWER"]), 1),
                "predicted_ac_power": round(float(pred), 1),
                "ac_power": round(float(row["AC_POWER"]), 1),
                "inverter_actual": round(float(row["AC_POWER"]) / 22, 1),
                "inverter_predicted": round(float(pred) / 22, 1),
            }
            for (_, row), pred in zip(p2_recent.iterrows(), p2_preds)
            if _safe_float(row["AC_POWER"]) is not None
        ]
        p2_total_gen = _safe_float(df2["AC_POWER"].sum())
    except Exception as exc:
        p2_weather = {"error": str(exc)}
        p2_gen_chart = []
        p2_total_gen = None

    # --- Plant 2 cross-plant evaluation (vectorized, cached after first call) ---
    plant2_metrics = None
    if MODEL_LOADED:
        try:
            plant2_metrics = _get_plant2_metrics_cached()
        except Exception as exc:
            plant2_metrics = {"error": str(exc)}

    if plant == 2:
        active_plant_metrics = {
            "status": "not_comparable",
            "comparable": False,
            "reason": (
                "Model 1 was trained on Plant 1's single inverter (1BY6WEcLGh8j5v7, scale 0–1,400 kW). "
                "Plant 2 generation in this primary view represents plant-wide aggregation across 22 inverters (scale 0–26,000 kW). "
                "Direct model overlay against plant aggregate is withheld to avoid false error metrics."
            ),
            "inverter_benchmark": plant2_metrics,
        }
    else:
        active_plant_metrics = {
            **model_metrics,
            "status": "evaluated",
            "comparable": True,
        }

    active_plant_data = {
        "plant_id": plant,
        "name": f"Solar Farm {'B' if plant == 2 else 'A'} (Plant {plant})",
        "latest_weather": p2_weather if plant == 2 else latest_weather,
        "generation_chart": p2_gen_chart if plant == 2 else gen_chart,
        "model_metrics": active_plant_metrics,
        "total_generation": p2_total_gen if plant == 2 else total_gen_kwh,
        "scale_note": (
            "Plant-wide aggregate across 22 inverters (up to ~26k kW)"
            if plant == 2
            else "Plant-wide aggregate across 22 inverters (up to ~29k kW)"
        ),
    }

    return {
        "mode": "historical_demo",
        "note": "No live telemetry connected. All data is from historical CSVs.",
        "selected_plant": plant,
        "active_plant": active_plant_data,
        "plant1": {
            "model_metrics": model_metrics,
            "latest_weather": latest_weather,
            "generation_chart": gen_chart,
            "total_generation_note": (
                f"Sum of all AC_POWER readings in Plant_1_Generation_Data.csv: "
                f"{total_gen_kwh:.2f} (units match training data)"
                if total_gen_kwh is not None else "N/A"
            ),
        },
        "plant2_cross_eval": plant2_metrics,
        "model2_anomaly_detection": {
            "status": "not_integrated",
            "reason": (
                "No Model 2 artifact (.joblib, .pkl, .h5, etc.) or interface definition "
                "was found in the repository. Provide the trained model file and its "
                "input/output contract to enable anomaly detection."
            ),
        },
    }
