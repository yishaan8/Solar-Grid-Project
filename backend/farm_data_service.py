"""Shared, validated farm-level data preparation for training and API routes."""
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
EXPECTED_INVERTERS = 22

def _read_timestamp_column(frame: pd.DataFrame, plant: int) -> pd.Series:
    if plant == 1:
        return pd.to_datetime(
            frame["DATE_TIME"],
            format="%d-%m-%Y %H:%M",
            errors="coerce",
        )
    return pd.to_datetime(frame["DATE_TIME"], format="mixed", errors="coerce")

def load_validated_farm_data(plant: int) -> tuple[pd.DataFrame, dict]:
    """Return one row per timestamp, only when all 22 inverters are present
    and a matching weather observation exists.

    AC_POWER is summed across the 22 distinct inverter SOURCE_KEY values.
    Weather measurements are averaged if duplicate sensor rows exist.
    """
    if plant not in (1, 2):
        raise ValueError("Plant must be 1 or 2.")

    generation_path = DATA_DIR / f"Plant_{plant}_Generation_Data.csv"
    weather_path = DATA_DIR / f"Plant_{plant}_Weather_Sensor_Data.csv"
    if not generation_path.exists() or not weather_path.exists():
        raise FileNotFoundError(f"Generation or weather CSV missing for Plant {plant}.")

    generation = pd.read_csv(generation_path)
    weather = pd.read_csv(weather_path)

    generation_required = {"DATE_TIME", "SOURCE_KEY", "AC_POWER"}
    weather_required = {
        "DATE_TIME", "IRRADIATION", "AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE"
    }
    if generation_required - set(generation.columns):
        raise ValueError(f"Plant {plant} generation CSV is missing columns: {sorted(generation_required - set(generation.columns))}")
    if weather_required - set(weather.columns):
        raise ValueError(f"Plant {plant} weather CSV is missing columns: {sorted(weather_required - set(weather.columns))}")

    generation["DATE_TIME"] = _read_timestamp_column(generation, plant)
    weather["DATE_TIME"] = pd.to_datetime(
        weather["DATE_TIME"], format="mixed", errors="coerce"
    )
    generation["AC_POWER"] = pd.to_numeric(generation["AC_POWER"], errors="coerce")
    for column in ("IRRADIATION", "AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE"):
        weather[column] = pd.to_numeric(weather[column], errors="coerce")

    generation = generation.dropna(
    subset=["DATE_TIME", "SOURCE_KEY", "AC_POWER"]
    )

    # Keep one row per inverter per timestamp so duplicate rows
    # cannot inflate the plant-wide AC_POWER sum.
    duplicate_rows = generation.duplicated(
        subset=["DATE_TIME", "SOURCE_KEY"],
        keep="last",
    ).sum()

    generation = generation.drop_duplicates(
        subset=["DATE_TIME", "SOURCE_KEY"],
        keep="last",
    )
    weather = weather.dropna(subset=["DATE_TIME", "IRRADIATION", "AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE"])

    coverage = generation.groupby("DATE_TIME").agg(
        inverter_count=("SOURCE_KEY", "nunique"),
        source_rows=("SOURCE_KEY", "size"),
        AC_POWER=("AC_POWER", "sum"),
    ).reset_index()

    complete = coverage[coverage["inverter_count"] == EXPECTED_INVERTERS].copy()
    weather_aggregated = weather.groupby("DATE_TIME", as_index=False).agg(
        IRRADIATION=("IRRADIATION", "mean"),
        AMBIENT_TEMPERATURE=("AMBIENT_TEMPERATURE", "mean"),
        MODULE_TEMPERATURE=("MODULE_TEMPERATURE", "mean"),
    )

    merged = complete.merge(weather_aggregated, on="DATE_TIME", how="inner")
    merged = merged.replace([float("inf"), float("-inf")], pd.NA).dropna()
    merged = merged.sort_values("DATE_TIME").reset_index(drop=True)

    metadata = {
        "plant": plant,
        "expected_inverters": EXPECTED_INVERTERS,
        "distinct_inverters": int(generation["SOURCE_KEY"].nunique()),
        "raw_generation_rows": int(len(generation)),
        "raw_timestamp_count": int(coverage.shape[0]),
        "complete_generation_timestamps": int(len(complete)),
        "incomplete_generation_timestamps_excluded": int((coverage["inverter_count"] < EXPECTED_INVERTERS).sum()),
        "complete_timestamps_with_weather": int(len(merged)),
        "timestamps_without_matching_weather_excluded": int(len(complete) - len(merged)),
        "aggregation": "sum AC_POWER across 22 distinct SOURCE_KEY values per timestamp",
        "completeness_rule": "exactly 22 distinct inverters and matching weather observation",
        "duplicate_inverter_rows_removed": int(duplicate_rows),
    }
    return merged, metadata

def get_farm_data_range(plant: int) -> dict:
    """Return the available date range from validated farm-level records."""
    frame, metadata = load_validated_farm_data(plant)

    if frame.empty:
        raise ValueError(f"No validated records available for Plant {plant}.")

    return {
        "plant": plant,
        "start": frame["DATE_TIME"].min().isoformat(),
        "end": frame["DATE_TIME"].max().isoformat(),
        "records": int(len(frame)),
        "metadata": metadata,
    }