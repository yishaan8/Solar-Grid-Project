import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from farm_data_service import load_validated_farm_data


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(exist_ok=True)

FEATURES = [
    "IRRADIATION",
    "AC_POWER",
    "AMBIENT_TEMPERATURE",
    "MODULE_TEMPERATURE",
    "TEMP_DIFF",
    "TIME_SIN",
    "TIME_COS",
    "POWER_PER_IRRADIANCE",
]

# Initial demo threshold: the model will label roughly 2% of training
# records as outliers. Review the flagged records before treating them as faults.
CONTAMINATION = 0.02


def build_features(data: pd.DataFrame) -> pd.DataFrame:
    df = data.copy()
    df["DATE_TIME"] = pd.to_datetime(df["DATE_TIME"], errors="coerce")

    minutes = df["DATE_TIME"].dt.hour * 60 + df["DATE_TIME"].dt.minute
    df["TEMP_DIFF"] = (
        df["MODULE_TEMPERATURE"] - df["AMBIENT_TEMPERATURE"]
    )
    df["TIME_SIN"] = np.sin(2 * np.pi * minutes / 1440)
    df["TIME_COS"] = np.cos(2 * np.pi * minutes / 1440)

    # Avoid division by zero and extreme ratios near zero irradiance.
    denominator = df["IRRADIATION"].clip(lower=0.05)
    df["POWER_PER_IRRADIANCE"] = df["AC_POWER"] / denominator

    df = df.replace([np.inf, -np.inf], np.nan)
    return df.dropna(subset=["DATE_TIME"] + FEATURES).sort_values("DATE_TIME")


def train_one_plant(plant_id: int, raw_data: pd.DataFrame) -> dict:
    data = build_features(raw_data)

    if len(data) < 20:
        raise RuntimeError(
            f"Not enough complete records for Plant {plant_id}: {len(data)}"
        )

    # Chronological split: train on earlier data, score later holdout data.
    split_index = int(len(data) * 0.8)
    train_data = data.iloc[:split_index].copy()
    test_data = data.iloc[split_index:].copy()

    model = IsolationForest(
        n_estimators=300,
        contamination=CONTAMINATION,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(train_data[FEATURES])

    # IsolationForest: -1 = outlier, +1 = inlier.
    test_predictions = model.predict(test_data[FEATURES])
    test_scores = model.decision_function(test_data[FEATURES])

    results = test_data[
        [
            "DATE_TIME",
            "AC_POWER",
            "IRRADIATION",
            "AMBIENT_TEMPERATURE",
            "MODULE_TEMPERATURE",
        ]
    ].copy()

    results["ANOMALY"] = test_predictions == -1
    results["ANOMALY_SCORE"] = test_scores
    results["STATUS"] = np.where(results["ANOMALY"], "anomaly", "normal")

    model_path = MODEL_DIR / f"farm_plant{plant_id}_isolation_forest.joblib"
    results_path = MODEL_DIR / f"farm_plant{plant_id}_anomaly_results.csv"

    joblib.dump(model, model_path)
    results.to_csv(results_path, index=False)

    summary = {
        "plant": plant_id,
        "training_records": int(len(train_data)),
        "test_records": int(len(test_data)),
        "flagged_test_records": int((test_predictions == -1).sum()),
        "flagged_test_percent": round(
            float((test_predictions == -1).mean() * 100), 2
        ),
        "contamination_setting": CONTAMINATION,
        "model_file": model_path.name,
        "results_file": results_path.name,
        "note": (
            "Unsupervised anomaly flags, not confirmed faults. "
            "Review flagged records against operational context."
        ),
    }

    print(f"\nPLANT {plant_id} ANOMALY SUMMARY")
    print(json.dumps(summary, indent=2))
    print("Flagged examples:")
    print(
        results[results["ANOMALY"]]
        .sort_values("ANOMALY_SCORE")
        .head(10)
        .to_string(index=False)
    )

    return summary


plant1_data, _ = load_validated_farm_data(1)
plant2_data, _ = load_validated_farm_data(2)

summaries = {
    "model": "Farm-level Isolation Forest",
    "features": FEATURES,
    "plant1": train_one_plant(1, plant1_data),
    "plant2": train_one_plant(2, plant2_data),
}

summary_path = MODEL_DIR / "farm_anomaly_metrics.json"
with open(summary_path, "w", encoding="utf-8") as file:
    json.dump(summaries, file, indent=2)

with open(MODEL_DIR / "farm_anomaly_features.json", "w", encoding="utf-8") as file:
    json.dump(FEATURES, file, indent=2)

print(f"\nSaved anomaly models, results, and summaries to: {MODEL_DIR}")