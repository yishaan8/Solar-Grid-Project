import math
import random
from datetime import datetime, timedelta, timezone


def generate_telemetry(capacity_kw):
    now = datetime.now().astimezone()
    hour = now.hour + now.minute / 60
    sunrise = 6
    sunset = 18

    if sunrise <= hour <= sunset:
        daylight = math.sin(
            math.pi * (hour - sunrise) / (sunset - sunrise)
        )
    else:
        daylight = 0

    irradiance = max(
        0,
        850 * daylight * random.uniform(0.97, 1.03)
    )

    ambient_temperature = random.uniform(24, 36)
    module_temperature = ambient_temperature + irradiance * 0.025
    performance_ratio = random.uniform(0.78, 0.92)
    power_kw = capacity_kw * (irradiance / 1000) * performance_ratio

    return {
        "timestamp": datetime.now(timezone.utc),
        "power_kw": round(power_kw, 3),
        "energy_kwh": round(power_kw * 0.25, 3),
        "irradiance": round(irradiance, 2),
        "ambient_temperature": round(ambient_temperature, 2),
        "module_temperature": round(module_temperature, 2),
        "source": "simulated"
    }


def generate_day_telemetry(capacity_kw, installation_id, user_id, date=None):
    if date is None:
        date = datetime.now().date()

    readings = []

    for interval in range(96):
        timestamp = datetime.combine(
            date,
            datetime.min.time()
        ) + timedelta(minutes=15 * interval)

        hour = timestamp.hour + timestamp.minute / 60
        sunrise = 6
        sunset = 18

        if sunrise <= hour <= sunset:
            daylight = math.sin(
                math.pi * (hour - sunrise) / (sunset - sunrise)
            )
        else:
            daylight = 0

        irradiance = max(
            0,
            850 * daylight * random.uniform(0.97, 1.03)
        )

        ambient_temperature = random.uniform(24, 36)
        module_temperature = ambient_temperature + irradiance * 0.025
        performance_ratio = random.uniform(0.78, 0.92)
        power_kw = capacity_kw * (irradiance / 1000) * performance_ratio

        readings.append({
            "installation_id": installation_id,
            "user_id": user_id,
            "timestamp": timestamp.replace(tzinfo=timezone.utc),
            "power_kw": round(power_kw, 3),
            "energy_kwh": round(power_kw * 0.25, 3),
            "irradiance": round(irradiance, 2),
            "ambient_temperature": round(ambient_temperature, 2),
            "module_temperature": round(module_temperature, 2),
            "source": "simulated"
        })

    return readings