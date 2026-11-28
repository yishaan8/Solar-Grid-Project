import json
import shutil
from pathlib import Path

import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

metrics_path = Path("models/farm_metrics.json")
results_path = Path("models/farm_plant2_test_results.csv")

# Keep a backup before changing the metrics file.
shutil.copy2(metrics_path, metrics_path.with_suffix(".json.bak"))

df = pd.read_csv(results_path)
daylight = df[df["IRRADIATION"] > 0.05]
nonzero = daylight[daylight["AC_POWER"] > 0]

actual = nonzero["AC_POWER"]
predicted = nonzero["EXPECTED_POWER"]

diagnostic = {
    "mae": float(mean_absolute_error(actual, predicted)),
    "rmse": float(mean_squared_error(actual, predicted) ** 0.5),
    "r2": float(r2_score(actual, predicted)),
    "records": int(len(nonzero)),
    "note": "Diagnostic subset only: daylight rows with non-zero actual generation. Not the official daylight metric.",
}

with metrics_path.open("r", encoding="utf-8") as file:
    metrics = json.load(file)

metrics["plant2"]["daylight_nonzero_actual"] = diagnostic

with metrics_path.open("w", encoding="utf-8") as file:
    json.dump(metrics, file, indent=2)

print(json.dumps(diagnostic, indent=2))
print(f"\nUpdated: {metrics_path}")
print(f"Backup:  {metrics_path.with_suffix('.json.bak')}")