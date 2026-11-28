import json
import math
from pathlib import Path
from datetime import datetime
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from farm_data_service import load_validated_farm_data
from farm_model_service import predict_farm_power

router = APIRouter(prefix="/api/farm", tags=["Solar Farm"])
base_dir = Path(__file__).resolve().parent
model_dir = base_dir / "models"
data_dir = base_dir / "data"


class FarmPredictionRequest(BaseModel):
    plant: int = Field(default=1, ge=1, le=2)
    timestamp: datetime
    irradiation: float = Field(ge=0, le=1.5)
    ambient_temperature: float
    module_temperature: float


def load_generation_data(plant: int):
    path = data_dir / f"Plant_{plant}_Generation_Data.csv"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Generation dataset for Plant {plant} was not found.")
    df = pd.read_csv(path)
    required = {"DATE_TIME", "SOURCE_KEY", "AC_POWER", "DC_POWER", "DAILY_YIELD", "TOTAL_YIELD"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(status_code=500, detail=f"Dataset is missing columns: {sorted(missing)}")
    if plant == 1:
        df["DATE_TIME"] = pd.to_datetime(df["DATE_TIME"], format="%d-%m-%Y %H:%M", errors="coerce")
    else:
        df["DATE_TIME"] = pd.to_datetime(df["DATE_TIME"], format="mixed", errors="coerce")
    for column in ("AC_POWER", "DC_POWER", "DAILY_YIELD", "TOTAL_YIELD"):
        df[column] = pd.to_numeric(df[column], errors="coerce")
    return df.dropna(subset=["DATE_TIME", "SOURCE_KEY", "AC_POWER"])


@router.get("/metrics")
def get_farm_metrics():
    path = model_dir / "farm_metrics.json"
    if not path.exists():
        raise HTTPException(status_code=503, detail="Farm model has not been trained yet.")
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


@router.get("/inverters")
def get_farm_inverters(plant: int = Query(1, ge=1, le=2)):
    df = load_generation_data(plant)
    if df.empty:
        raise HTTPException(status_code=404, detail="No inverter generation records were found.")

    coverage = df.groupby("DATE_TIME")["SOURCE_KEY"].nunique()
    complete_timestamps = coverage[coverage == 22].index
    if len(complete_timestamps) == 0:
        raise HTTPException(status_code=404, detail="No complete 22-inverter timestamp is available.")
    comparison_timestamp = max(complete_timestamps)
    comparison_rows = df[df["DATE_TIME"] == comparison_timestamp].copy()
    peer_median = float(comparison_rows["AC_POWER"].median())
    peer_by_inverter = comparison_rows.set_index("SOURCE_KEY")["AC_POWER"].to_dict()

    inverters = []
    for source_key, group in df.groupby("SOURCE_KEY"):
        group = group.sort_values("DATE_TIME")
        latest = group.iloc[-1]
        is_aligned = latest["DATE_TIME"] == comparison_timestamp and source_key in peer_by_inverter
        latest_power = float(latest["AC_POWER"])
        if not is_aligned:
            peer_status = "Not comparable: timestamp mismatch"
        elif latest_power < peer_median:
            peer_status = "Below peer median"
        elif latest_power > peer_median:
            peer_status = "Above peer median"
        else:
            peer_status = "At peer median"
        inverters.append({
            "inverter_id": str(source_key),
            "latest_timestamp": latest["DATE_TIME"].isoformat(),
            "latest_ac_power": round(latest_power, 3),
            "peak_ac_power": round(float(group["AC_POWER"].max()), 3),
            "latest_dc_power": round(float(latest["DC_POWER"]), 3) if pd.notna(latest["DC_POWER"]) else None,
            "daily_yield": round(float(latest["DAILY_YIELD"]), 3) if pd.notna(latest["DAILY_YIELD"]) else None,
            "total_yield": round(float(latest["TOTAL_YIELD"]), 3) if pd.notna(latest["TOTAL_YIELD"]) else None,
            "peer_status": peer_status,
            "records": int(len(group)),
        })
    inverters.sort(key=lambda item: item["latest_ac_power"], reverse=True)
    return {
        "plant": plant,
        "source": "historical_csv",
        "comparison_timestamp": comparison_timestamp.isoformat(),
        "inverter_count": int(df["SOURCE_KEY"].nunique()),
        "complete_inverter_count": int(len(comparison_rows)),
        "peer_median_ac_power": round(peer_median, 3),
        "unit": "AC_POWER dataset units",
        "inverters": inverters,
    }


@router.get("/history")
def get_farm_history(plant: int = Query(1, ge=1, le=2), limit: int = Query(200, ge=1, le=1000)):
    filename = f"farm_plant{plant}_test_results.csv"
    path = model_dir / filename
    if not path.exists():
        raise HTTPException(status_code=503, detail="Farm evaluation results not found. Train the model first.")
    try:
        df = pd.read_csv(path)
        required = {"DATE_TIME", "AC_POWER", "EXPECTED_POWER", "RESIDUAL"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"Evaluation file is missing columns: {sorted(missing)}")
        df["DATE_TIME"] = pd.to_datetime(df["DATE_TIME"], errors="coerce")
        df = df.dropna(subset=["DATE_TIME", "AC_POWER", "EXPECTED_POWER"]).sort_values("DATE_TIME").tail(limit)
        try:
            validated_df, _ = load_validated_farm_data(plant)
            irradiation_by_ts = dict(zip(validated_df["DATE_TIME"], validated_df["IRRADIATION"]))
        except (FileNotFoundError, ValueError):
            irradiation_by_ts = {}

        records = []
        for _, row in df.iterrows():
            raw_irradiation = irradiation_by_ts.get(row["DATE_TIME"])
            irradiation = (
                round(float(raw_irradiation), 6)
                if raw_irradiation is not None and pd.notna(raw_irradiation) and math.isfinite(float(raw_irradiation))
                else None
            )
            records.append({
                "timestamp": row["DATE_TIME"].isoformat(),
                "actual_ac_power": round(float(row["AC_POWER"]), 3),
                "predicted_ac_power": round(float(row["EXPECTED_POWER"]), 3),
                "residual": round(float(row["RESIDUAL"]), 3),
                "irradiation": irradiation,
            })
        return {
            "plant": plant,
            "source": filename,
            "mode": "historical_model_evaluation",
            "comparable": True,
            "unit": "AC_POWER dataset units",
            "count": len(records),
            "period_start": records[0]["timestamp"] if records else None,
            "period_end": records[-1]["timestamp"] if records else None,
            "note": f"Plant {plant} held-out evaluation using its own plant-specific model and complete 22-inverter timestamps. Historical results are not a guarantee of future performance.",
            "records": records,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load farm history: {exc}") from exc


@router.post("/predict")
def predict_farm(payload: FarmPredictionRequest):
    try:
        prediction = predict_farm_power(
            plant=payload.plant,
            timestamp=payload.timestamp,
            irradiation=payload.irradiation,
            ambient_temperature=payload.ambient_temperature,
            module_temperature=payload.module_temperature,
        )
        return {
            "plant": payload.plant,
            "predicted_ac_power": round(prediction, 3),
            "timestamp": payload.timestamp.isoformat(),
            "unit": "AC_POWER dataset units",
            "model": "Farm-level Random Forest",
            "scope": f"Plant {payload.plant}-specific model trained on complete 22-inverter timestamps",
            "prediction_type": "weather_conditioned_estimate",
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Farm prediction failed: {exc}")
