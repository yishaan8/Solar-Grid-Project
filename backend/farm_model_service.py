import json
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"


@lru_cache(maxsize=2)
def load_plant_model(plant: int):
    if plant not in (1, 2):
        raise ValueError("plant must be 1 or 2")

    model_path = MODEL_DIR / f"farm_plant{plant}_random_forest.joblib"
    features_path = MODEL_DIR / "farm_features.json"

    if not model_path.exists():
        raise FileNotFoundError(
            f"Model for Plant {plant} not found. Run train_farm_model.py first."
        )

    if not features_path.exists():
        raise FileNotFoundError("farm_features.json not found.")

    model = joblib.load(model_path)

    with open(features_path, "r", encoding="utf-8") as file:
        feature_names = json.load(file)

    return model, feature_names


def build_features(
    timestamp,
    irradiation,
    ambient_temperature,
    module_temperature,
    feature_names,
):
    if isinstance(timestamp, str):
        timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

    minutes = timestamp.hour * 60 + timestamp.minute
    temp_diff = module_temperature - ambient_temperature

    values = {
        "IRRADIATION": irradiation,
        "AMBIENT_TEMPERATURE": ambient_temperature,
        "MODULE_TEMPERATURE": module_temperature,
        "TIME_SIN": np.sin(2 * np.pi * minutes / 1440),
        "TIME_COS": np.cos(2 * np.pi * minutes / 1440),
        "TEMP_DIFF": temp_diff,
        "IRR_TEMP_INTERACTION": irradiation * module_temperature,
        "IRR_TEMP_DIFF": irradiation * temp_diff,
    }

    return pd.DataFrame(
        [[values[name] for name in feature_names]],
        columns=feature_names,
    )


def predict_farm_power(
    plant,
    timestamp,
    irradiation,
    ambient_temperature,
    module_temperature,
):
    if plant not in (1, 2):
        raise ValueError("plant must be 1 or 2")

    if irradiation < 0 or irradiation > 1.5:
        raise ValueError(
            "Irradiation must be in the training data scale (0 to 1.5)."
        )

    model, feature_names = load_plant_model(plant)

    input_data = build_features(
        timestamp=timestamp,
        irradiation=irradiation,
        ambient_temperature=ambient_temperature,
        module_temperature=module_temperature,
        feature_names=feature_names,
    )

    prediction = float(model.predict(input_data)[0])
    return max(0.0, prediction)
