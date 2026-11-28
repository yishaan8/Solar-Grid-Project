from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query
from auth_routes import get_current_user
from database import get_database
from farm_telemetry_service import build_farm_replay

router = APIRouter(
    prefix="/api/farm-telemetry",
    tags=["Farm Telemetry Replay"]
)

db = get_database()

@router.post("/replay")
def start_farm_replay(
    plant: int = Query(1, ge=1, le=2),
    limit: int = Query(200, ge=1, le=1000),
    user: dict = Depends(get_current_user)
):
    try:
        records = build_farm_replay(plant=plant, limit=limit)

        if not records:
            raise HTTPException(
                status_code=404,
                detail="No historical records available for replay."
            )

        replay_id = str(uuid4())
        user_id = str(user["_id"])
        created_at = datetime.now(timezone.utc)

        documents = []

        for record in records:
            documents.append({
                **record,
                "replay_id": replay_id,
                "user_id": user_id,
                "created_at": created_at
            })

        db.farm_replay_records.insert_many(documents)

        actual_values = [
            record["actual_ac_power"] for record in records
        ]
        predicted_values = [
            record["predicted_ac_power"] for record in records
        ]
        errors = [
            abs(actual - predicted)
            for actual, predicted in zip(actual_values, predicted_values)
        ]

        summary = {
            "replay_id": replay_id,
            "user_id": user_id,
            "plant": plant,
            "source": f"historical_csv_replay_plant{plant}",
            "model": "Farm-level Random Forest",
            "records": len(records),
            "mae": round(sum(errors) / len(errors), 3),
            "created_at": created_at
        }

        db.farm_replays.insert_one(summary)

        return {
            "message": "Historical farm replay completed.",
            "replay_id": replay_id,
            "plant": plant,
            "source": summary["source"],
            "model": summary["model"],
            "records_processed": len(records),
            "mae": summary["mae"],
            "created_at": created_at.isoformat(),
            "results_endpoint": f"/api/farm-telemetry/replay/{replay_id}"
        }

    except HTTPException:
        raise
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Farm replay failed: {exc}"
        )


@router.get("/replay/{replay_id}")
def get_farm_replay(
    replay_id: str,
    user: dict = Depends(get_current_user)
):
    user_id = str(user["_id"])

    summary = db.farm_replays.find_one({
        "replay_id": replay_id,
        "user_id": user_id
    })

    if not summary:
        raise HTTPException(
            status_code=404,
            detail="Replay not found."
        )

    cursor = db.farm_replay_records.find({
        "replay_id": replay_id,
        "user_id": user_id
    }).sort("timestamp", 1)

    records = []

    for item in cursor:
        records.append({
            "timestamp": item["timestamp"].isoformat(),
            "actual_ac_power": item["actual_ac_power"],
            "predicted_ac_power": item["predicted_ac_power"],
            "irradiation": item["irradiation"],
            "ambient_temperature": item["ambient_temperature"],
            "module_temperature": item["module_temperature"],
            "absolute_error": item["absolute_error"]
        })

    return {
        "replay_id": replay_id,
        "plant": summary["plant"],
        "source": summary["source"],
        "model": summary["model"],
        "count": len(records),
        "mae": summary["mae"],
        "records": records
    }
