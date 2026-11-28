import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

df = pd.read_csv("models/farm_plant2_test_results.csv")

# Daylight rows, using the same threshold as the training evaluation.
daylight = df[df["IRRADIATION"] > 0.05].copy()

# Comparison subset: daylight rows where observed generation is non-zero.
nonzero_generation = daylight[daylight["AC_POWER"] > 0].copy()

def report(label, data):
    actual = data["AC_POWER"]
    predicted = data["EXPECTED_POWER"]

    print(f"\n{label}")
    print(f"Rows: {len(data)}")
    print(f"MAE:  {mean_absolute_error(actual, predicted):.2f}")
    print(f"RMSE: {mean_squared_error(actual, predicted) ** 0.5:.2f}")
    print(f"R²:   {r2_score(actual, predicted):.4f}")

report("Original daylight test set", daylight)
report("Daylight rows with non-zero actual generation", nonzero_generation)

print(
    "\nZero-generation daylight rows excluded from comparison:",
    len(daylight) - len(nonzero_generation),
)