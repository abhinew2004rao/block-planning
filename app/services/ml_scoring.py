from datetime import date, datetime, timedelta
from typing import Sequence

from sqlalchemy.orm import Session, joinedload

from app.models import MaintenanceTask

# Lookup tables for priority_score components
DEFECT_SEVERITY_SCORES: dict[str, float] = {
    "low": 20.0,
    "minor": 20.0,
    "observational": 20.0,
    "medium": 40.0,
    "high": 60.0,
    "major": 60.0,
    "critical": 80.0,
}

TRAFFIC_DENSITY_SCORES: dict[str, float] = {
    "A": 15.0,
    "B": 10.0,
    "C": 5.0,
    "D": 2.0,
}

ASSET_TYPE_SCORES: dict[str, float] = {
    "track": 5.0,
    "signal": 8.0,
    "traction": 7.0,
    "ohe": 7.0,
    "overhead": 7.0,
    "power": 7.0,
}

# Lookup tables for failure_prob_7d components
SEVERITY_BASE_PROB: dict[str, float] = {
    "critical": 0.40,
    "high": 0.25,
    "major": 0.25,
    "medium": 0.12,
    "low": 0.04,
    "minor": 0.04,
    "observational": 0.04,
}

ASSET_TYPE_FACTORS: dict[str, float] = {
    "signal": 1.25,
    "traction": 1.15,
    "ohe": 1.15,
    "power": 1.15,
    "track": 1.00,
}


def calculate_priority_score(
    defect_severity: str | None,
    traffic_density: str | None,
    asset_type: str | None,
    days_overdue: int | float = 0,
) -> float:
    """Calculate priority_score (0-100) based on defect_severity, traffic_density, asset_type, and days_overdue.

    Rules:
    - defect_severity: low=20, medium=40, high=60, critical=80
    - traffic_density: A=15, B=10, C=5, D=2
    - asset_type: track=5, signal=8, traction=7
    - days_overdue: 2 points per day, max 20
    """
    sev_key = (defect_severity or "").strip().lower()
    sev_score = DEFECT_SEVERITY_SCORES.get(sev_key, 20.0)

    density_key = (traffic_density or "").strip().upper()
    density_score = TRAFFIC_DENSITY_SCORES.get(density_key, 5.0)

    asset_key = (asset_type or "").strip().lower()
    asset_score = ASSET_TYPE_SCORES.get(asset_key, 5.0)

    overdue_score = min(max(float(days_overdue), 0.0) * 2.0, 20.0)

    total_score = sev_score + density_score + asset_score + overdue_score
    return float(min(100.0, max(0.0, round(total_score, 2))))


def calculate_failure_prob_7d(
    defect_severity: str | None,
    task_age_days: int | float = 0,
    asset_type: str | None = None,
) -> float:
    """Calculate failure_prob_7d (0-1) based on severity base probability, task age factor, and asset type factor.

    Rules:
    - severity base probability: critical=0.40, high=0.25, medium=0.12, low=0.04
    - task age factor: 1.0 + min(0.02 * task_age_days, 1.0)
    - asset type factor: signal=1.25, traction=1.15, track=1.00
    """
    sev_key = (defect_severity or "").strip().lower()
    base_prob = SEVERITY_BASE_PROB.get(sev_key, 0.05)

    age_days = max(float(task_age_days), 0.0)
    age_factor = 1.0 + min(age_days * 0.02, 1.0)

    asset_key = (asset_type or "").strip().lower()
    asset_factor = ASSET_TYPE_FACTORS.get(asset_key, 1.00)

    prob = base_prob * age_factor * asset_factor
    return float(min(1.0, max(0.0, round(prob, 4))))


def calculate_urgency_score(
    priority_score: float,
    failure_prob_7d: float,
    days_overdue: int | float = 0,
) -> float:
    """Calculate urgency_score (0-100) as a weighted combination of priority_score, 7-day failure probability, and overdue status."""
    p_score = min(100.0, max(0.0, float(priority_score)))
    f_prob = min(1.0, max(0.0, float(failure_prob_7d)))
    overdue_factor = min(max(float(days_overdue), 0.0) * 0.5, 10.0)

    # Weighted combination formula
    urgency = (0.55 * p_score) + (0.35 * (f_prob * 100.0)) + overdue_factor
    return float(min(100.0, max(0.0, round(urgency, 2))))


def score_tasks(
    db: Session,
    task_ids: Sequence[int] | None = None,
    reference_date: date | datetime | None = None,
    update_status: bool = False,
) -> list[MaintenanceTask]:
    """Score specified or all tasks in the database and update priority_score, failure_prob_7d, failure_prob_30d, and urgency_score."""
    if reference_date is None:
        ref_date = date.today()
    elif isinstance(reference_date, datetime):
        ref_date = reference_date.date()
    else:
        ref_date = reference_date

    query = db.query(MaintenanceTask).options(
        joinedload(MaintenanceTask.asset),
        joinedload(MaintenanceTask.linked_defect),
    )

    if task_ids is not None:
        query = query.filter(MaintenanceTask.task_id.in_(task_ids))

    tasks = query.all()

    for task in tasks:
        asset = task.asset
        defect = task.linked_defect

        defect_severity = defect.defect_severity if defect else None
        traffic_density = asset.traffic_density_class if asset else None
        asset_type = asset.asset_type if asset else None

        # Determine days overdue and task age
        days_overdue = 0
        if task.latest_end_date and ref_date > task.latest_end_date:
            days_overdue = (ref_date - task.latest_end_date).days
        elif defect and defect.detected_date and defect.max_allowed_delay_days:
            due_date = defect.detected_date + timedelta(days=defect.max_allowed_delay_days)
            if ref_date > due_date:
                days_overdue = (ref_date - due_date).days

        task_age_days = 0
        if defect and defect.detected_date:
            task_age_days = max(0, (ref_date - defect.detected_date).days)
        elif task.earliest_start_date:
            task_age_days = max(0, (ref_date - task.earliest_start_date).days)

        # Compute ML scores
        priority_score = calculate_priority_score(
            defect_severity=defect_severity,
            traffic_density=traffic_density,
            asset_type=asset_type,
            days_overdue=days_overdue,
        )

        failure_prob_7d = calculate_failure_prob_7d(
            defect_severity=defect_severity,
            task_age_days=task_age_days,
            asset_type=asset_type,
        )

        # failure_prob_30d must satisfy DB constraint failure_prob_30d >= failure_prob_7d
        failure_prob_30d = float(min(1.0, max(failure_prob_7d, round(failure_prob_7d * 1.35 + 0.05, 4))))

        urgency_score = calculate_urgency_score(
            priority_score=priority_score,
            failure_prob_7d=failure_prob_7d,
            days_overdue=days_overdue,
        )

        # Assign updated scores to task model
        task.priority_score = priority_score
        task.failure_prob_7d = failure_prob_7d
        task.failure_prob_30d = failure_prob_30d
        task.urgency_score = urgency_score

        if update_status and task.status == "pending":
            task.status = "scored"

    db.commit()
    return tasks


def score_all_tasks(
    db: Session,
    reference_date: date | datetime | None = None,
    update_status: bool = False,
) -> list[MaintenanceTask]:
    """Score all tasks in database and update them."""
    return score_tasks(db=db, task_ids=None, reference_date=reference_date, update_status=update_status)
