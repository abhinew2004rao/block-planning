from datetime import datetime, timezone

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sqlalchemy.orm import Session, joinedload

from app.models import Asset, Defect, MaintenanceTask

SEVERITY_WEIGHT = {"critical": 1.0, "high": 0.75, "medium": 0.5, "low": 0.25}
CRITICALITY_WEIGHT = {"safety": 1.0, "high": 0.8, "medium": 0.5, "low": 0.25}
DENSITY_WEIGHT = {"very_high": 1.0, "high": 0.75, "medium": 0.5, "low": 0.25}
BLOCK_TYPE_WEIGHT = {"absolute": 1.0, "caution": 0.55, "power": 0.7}


def _age_days(reported_at: datetime | None) -> float:
    if reported_at is None:
        return 0.0
    if reported_at.tzinfo is None:
        reported_at = reported_at.replace(tzinfo=timezone.utc)
    return max((datetime.now(timezone.utc) - reported_at).total_seconds() / 86400.0, 0.0)


def task_feature_vector(task: MaintenanceTask, asset: Asset, defect: Defect | None) -> np.ndarray:
    severity = SEVERITY_WEIGHT.get((defect.severity if defect else "medium").lower(), 0.5)
    criticality = CRITICALITY_WEIGHT.get(asset.criticality.lower(), 0.5)
    density = DENSITY_WEIGHT.get(asset.traffic_density.lower(), 0.5)
    block_w = BLOCK_TYPE_WEIGHT.get(task.required_block_type.lower(), 0.5)
    age = min(_age_days(defect.reported_at if defect else None) / 90.0, 1.0)
    duration_norm = min(task.estimated_duration_min / 240.0, 1.0)
    return np.array([severity, criticality, density, block_w, age, duration_norm], dtype=float)


def heuristic_score(features: np.ndarray) -> float:
    weights = np.array([0.32, 0.22, 0.16, 0.12, 0.12, 0.06])
    return float(np.clip(100.0 * np.dot(features, weights), 0.0, 100.0))


def train_default_model(n_samples: int = 400) -> GradientBoostingRegressor:
    rng = np.random.default_rng(42)
    x = rng.random((n_samples, 6))
    y = np.array([heuristic_score(row) + rng.normal(0, 2.0) for row in x])
    model = GradientBoostingRegressor(random_state=42, max_depth=3, n_estimators=80)
    model.fit(x, y)
    return model


_MODEL: GradientBoostingRegressor | None = None


def get_model() -> GradientBoostingRegressor:
    global _MODEL
    if _MODEL is None:
        _MODEL = train_default_model()
    return _MODEL


def score_tasks(db: Session, task_ids: list[int] | None = None) -> list[MaintenanceTask]:
    query = db.query(MaintenanceTask).options(
        joinedload(MaintenanceTask.asset),
        joinedload(MaintenanceTask.defect),
    )
    if task_ids:
        query = query.filter(MaintenanceTask.id.in_(task_ids))
    tasks = query.all()
    model = get_model()
    for task in tasks:
        features = task_feature_vector(task, task.asset, task.defect)
        task.priority_score = round(float(np.clip(model.predict([features])[0], 0, 100)), 2)
    db.commit()
    return tasks
