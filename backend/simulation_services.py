"""Historical-date simulation and weather-informed generation forecasts."""
from datetime import date, datetime, time, timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from farm_data_service import load_validated_farm_data, get_farm_data_range


FEATURES = [
    "IRRADIATION",
    "AMBIENT_TEMPERATURE",
    "MODULE_TEMPERATURE",
    "TIME_SIN",
    "TIME_COS",
    "TEMP_DIFF",
    "IRR_TEMP_INTERACTION",
    "IRR_TEMP_DIFF",
]


def _add_features(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    minutes = result["DATE_TIME"].dt.hour * 60 + result["DATE_TIME"].dt.minute

    result["TEMP_DIFF"] = (
        result["MODULE_TEMPERATURE"] - result["AMBIENT_TEMPERATURE"]
    )
    result["TIME_SIN"] = np.sin(2 * np.pi * minutes / 1440)
    result["TIME_COS"] = np.cos(2 * np.pi * minutes / 1440)
    result["IRR_TEMP_INTERACTION"] = (
        result["IRRADIATION"] * result["MODULE_TEMPERATURE"]
    )
    result["IRR_TEMP_DIFF"] = result["IRRADIATION"] * result["TEMP_DIFF"]

    return result.replace([np.inf, -np.inf], np.nan).dropna(
        subset=FEATURES + ["AC_POWER"]
    )


def get_simulation_range(plant: int) -> dict:
    """Return the dataset-derived date bounds used by the simulation UI."""
    bounds = get_farm_data_range(plant)
    return {
        "plant": plant,
        "start": bounds["start"],
        "end": bounds["end"],
        "available_records": bounds["records"],
    }


def forecast_from_date(plant: int, as_of: date, days: int) -> dict:
    """Forecast after `as_of`, training only on data available through that date."""
    raw, _ = load_validated_farm_data(plant)
    data = _add_features(raw)

    if data.empty:
        raise ValueError(f"No usable training records for Plant {plant}.")

    dataset_start = data["DATE_TIME"].min()
    dataset_end = data["DATE_TIME"].max()
    cutoff = datetime.combine(as_of, time.max)

    if cutoff < dataset_start:
        raise ValueError(
            f"Selected date is before Plant {plant}'s data begins "
            f"({dataset_start.date().isoformat()})."
        )
    if cutoff >= dataset_end:
        raise ValueError(
            f"Selected date must be before the last recorded date "
            f"({dataset_end.date().isoformat()}) to forecast forward."
        )

    training = data[data["DATE_TIME"] <= cutoff].copy()
    future = data[
        (data["DATE_TIME"] > cutoff)
        & (data["DATE_TIME"] <= cutoff + timedelta(days=days))
    ].copy()

    if len(training) < 10:
        raise ValueError(
            f"Only {len(training)} training records exist through "
            f"{as_of.isoformat()}; at least 10 are required."
        )
    if future.empty:
        raise ValueError(
            "No later weather records exist in the dataset for this date."
        )

    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=None,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(training[FEATURES], training["AC_POWER"])

    # Do not pass future AC_POWER to the model.
    predictions = np.maximum(model.predict(future[FEATURES]), 0)

    records = []
    for (_, row), prediction in zip(future.iterrows(), predictions):
        records.append({
            "timestamp": row["DATE_TIME"].isoformat(),
            "predicted_ac_power": round(float(prediction), 3),
            "weather": {
                "irradiation": float(row["IRRADIATION"]),
                "ambient_temperature": float(row["AMBIENT_TEMPERATURE"]),
                "module_temperature": float(row["MODULE_TEMPERATURE"]),
            },
            # Used only to compare the forecast after it has been made.
            "actual_ac_power_for_evaluation": round(float(row["AC_POWER"]), 3),
        })

    return {
        "plant": plant,
        "mode": "historical_simulation",
        "as_of": as_of.isoformat(),
        "forecast_days": days,
        "dataset_range": {
            "start": dataset_start.isoformat(),
            "end": dataset_end.isoformat(),
        },
        "training_records": int(len(training)),
        "forecast_records": int(len(records)),
        "weather_source": "Historical weather observations from the dataset",
        "actuals_note": (
            "Actual generation is included only for after-the-forecast "
            "evaluation; it is not used as a forecast input."
        ),
        "records": records,
    }