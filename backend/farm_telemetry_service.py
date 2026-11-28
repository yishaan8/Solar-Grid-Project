from pathlib import Path

import pandas as pd

base_dir = Path(__file__).resolve().parent
model_dir = base_dir / "models"


def build_farm_replay(plant=1, limit=200):
    if plant not in (1, 2):
        raise ValueError("Plant must be 1 or 2.")

    path = model_dir / f"farm_plant{plant}_test_results.csv"
    if not path.exists():
        raise FileNotFoundError(
            f"Plant {plant} test results not found. Train the plant models first."
        )

    df = pd.read_csv(path)
    required = [
        "DATE_TIME",
        "AC_POWER",
        "EXPECTED_POWER",
        "IRRADIATION",
        "AMBIENT_TEMPERATURE",
        "MODULE_TEMPERATURE",
    ]
    missing = set(required) - set(df.columns)
    if missing:
        raise ValueError(
            f"Missing columns in Plant {plant} test results: {sorted(missing)}"
        )

    df["DATE_TIME"] = pd.to_datetime(df["DATE_TIME"], errors="coerce")
    for column in required[1:]:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df = (
        df.dropna(subset=required)
        .sort_values("DATE_TIME")
        .tail(limit)
    )

    records = []
    for _, row in df.iterrows():
        timestamp = row["DATE_TIME"].to_pydatetime()
        actual = float(row["AC_POWER"])
        predicted = float(row["EXPECTED_POWER"])

        records.append({
            "timestamp": timestamp,
            "actual_ac_power": round(actual, 3),
            "predicted_ac_power": round(predicted, 3),
            "irradiation": round(float(row["IRRADIATION"]), 5),
            "ambient_temperature": round(float(row["AMBIENT_TEMPERATURE"]), 3),
            "module_temperature": round(float(row["MODULE_TEMPERATURE"]), 3),
            "absolute_error": round(abs(actual - predicted), 3),
            "source": f"historical_csv_model_evaluation_plant{plant}",
            "plant": plant,
        })

    return records