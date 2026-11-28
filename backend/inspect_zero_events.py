from pathlib import Path
import pandas as pd
data_dir = Path("data")
generation = pd.read_csv(data_dir / "Plant_2_Generation_Data.csv")
weather = pd.read_csv(data_dir / "Plant_2_Weather_Sensor_Data.csv")

generation["DATE_TIME"] = pd.to_datetime(generation["DATE_TIME"])
weather["DATE_TIME"] = pd.to_datetime(weather["DATE_TIME"])

plant = (
    generation.groupby("DATE_TIME")
    .agg(
        inverter_count=("SOURCE_KEY", "nunique"),
        AC_SUM=("AC_POWER", "sum"),
        DC_SUM=("DC_POWER", "sum"),
    )
    .reset_index()
)

plant = plant[plant["inverter_count"] == 22]
plant = plant.merge(
    weather[["DATE_TIME", "IRRADIATION"]],
    on="DATE_TIME",
    how="left",
)

event_times = pd.to_datetime([
    "2020-06-02 12:30:00",
    "2020-06-02 16:15:00",
    "2020-06-02 16:30:00",
    "2020-06-06 14:30:00",
    "2020-06-10 11:15:00",
    "2020-06-10 11:30:00",
    "2020-06-11 12:00:00",
    "2020-06-13 10:45:00",
    "2020-06-16 14:30:00",
])

for event_time in event_times:
    nearby = plant[
        plant["DATE_TIME"].between(
            event_time - pd.Timedelta(minutes=30),
            event_time + pd.Timedelta(minutes=30),
        )
    ].sort_values("DATE_TIME")

    print(f"\n--- Event: {event_time} ---")
    print(nearby.to_string(index=False))