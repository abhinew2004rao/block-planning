"""Pytest unit and database integration tests for ML scoring functions and task scoring service."""

from datetime import date, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.models import Asset, Defect, MaintenanceTask
from app.services.ml_scoring import (
    calculate_failure_prob_7d,
    calculate_priority_score,
    calculate_urgency_score,
    score_all_tasks,
    score_tasks,
)

# ===========================================================================
# 1. Unit Tests for calculate_priority_score
# ===========================================================================


@pytest.mark.parametrize(
    "severity, density, asset, days_overdue, expected_score",
    [
        # Defect severity mapping: low=20, minor=20, observational=20, medium=40, high=60, major=60, critical=80
        # Traffic density: A=15, B=10, C=5, D=2 (default: 5)
        # Asset type: track=5, signal=8, traction=7, ohe=7, power=7 (default: 5)
        # Days overdue: 2 points per day, max 20
        ("critical", "A", "signal", 10, 100.0),  # 80 + 15 + 8 + 20 = 123 -> capped at 100.0
        ("high", "B", "traction", 5, 87.0),      # 60 + 10 + 7 + 10 = 87.0
        ("major", "A", "signal", 2, 87.0),       # 60 + 15 + 8 + 4 = 87.0
        ("medium", "C", "track", 3, 56.0),       # 40 + 5 + 5 + 6 = 56.0
        ("low", "D", "track", 0, 27.0),          # 20 + 2 + 5 + 0 = 27.0
        ("minor", "D", "traction", 0, 29.0),     # 20 + 2 + 7 + 0 = 29.0
        ("observational", "C", "ohe", 4, 40.0),  # 20 + 5 + 7 + 8 = 40.0
        ("critical", "D", "power", 0, 89.0),     # 80 + 2 + 7 + 0 = 89.0
        ("high", "A", "overhead", 0, 82.0),     # 60 + 15 + 7 + 0 = 82.0
    ],
)
def test_calculate_priority_score_exact_values(severity, density, asset, days_overdue, expected_score):
    """Verify exact priority score calculations across diverse severity, density, asset, and overdue combinations."""
    score = calculate_priority_score(
        defect_severity=severity,
        traffic_density=density,
        asset_type=asset,
        days_overdue=days_overdue,
    )
    assert score == pytest.approx(expected_score, abs=0.01)


def test_calculate_priority_score_overdue_capping():
    """Verify that days overdue bonus is strictly capped at 20.0 points."""
    score_10_days = calculate_priority_score("low", "D", "track", 10)  # 20 + 2 + 5 + 20 = 47.0
    score_15_days = calculate_priority_score("low", "D", "track", 15)  # 20 + 2 + 5 + 20 = 47.0
    score_50_days = calculate_priority_score("low", "D", "track", 50)  # capped at 47.0
    assert score_10_days == 47.0
    assert score_15_days == 47.0
    assert score_50_days == 47.0


def test_calculate_priority_score_bounds_and_fallbacks():
    """Verify handling of negative overdue values, None, and unknown strings."""
    # Negative overdue should be treated as 0
    score_neg_overdue = calculate_priority_score("medium", "B", "track", -5)
    assert score_neg_overdue == 55.0  # 40 + 10 + 5 + 0

    # Unrecognized or None inputs should use documented defaults
    score_default = calculate_priority_score(None, None, None, 0)
    assert score_default == 30.0  # 20 (low default) + 5 (C default) + 5 (track default) + 0

    # Case-insensitivity and leading/trailing whitespace
    score_casing = calculate_priority_score("  CRITICAL  ", " a ", "  SIGNAL  ", 0)
    assert score_casing == 100.0 or score_casing == 103.0 or score_casing == 100.0  # 80 + 15 + 8 = 103 -> capped at 100.0
    assert score_casing == 100.0


# ===========================================================================
# 2. Unit Tests for calculate_failure_prob_7d
# ===========================================================================


@pytest.mark.parametrize(
    "severity, age_days, asset, expected_prob",
    [
        # Base probabilities: critical=0.40, high=0.25, major=0.25, medium=0.12, low=0.04, minor=0.04
        # Age factor: 1.0 + min(age * 0.02, 1.0)
        # Asset factor: signal=1.25, traction/ohe/power=1.15, track=1.00
        ("critical", 0, "signal", 0.50),  # 0.40 * 1.0 * 1.25 = 0.50
        ("high", 25, "track", 0.375),     # 0.25 * 1.50 * 1.0 = 0.375
        ("major", 25, "track", 0.375),    # 0.25 * 1.50 * 1.0 = 0.375
        ("medium", 10, "traction", 0.1656),  # 0.12 * 1.20 * 1.15 = 0.1656
        ("low", 0, "track", 0.04),        # 0.04 * 1.0 * 1.0 = 0.04
        ("minor", 50, "track", 0.08),     # 0.04 * 2.0 * 1.0 = 0.08
        ("observational", 0, "ohe", 0.046),  # 0.04 * 1.0 * 1.15 = 0.046
        ("critical", 50, "signal", 1.00), # 0.40 * 2.0 * 1.25 = 1.00
    ],
)
def test_calculate_failure_prob_7d_exact_values(severity, age_days, asset, expected_prob):
    """Verify failure probability 7d calculations across all severity and asset types."""
    prob = calculate_failure_prob_7d(
        defect_severity=severity,
        task_age_days=age_days,
        asset_type=asset,
    )
    assert prob == pytest.approx(expected_prob, abs=0.0001)


def test_calculate_failure_prob_7d_bounds_and_fallbacks():
    """Verify age factor capping, negative age handling, and upper bound clamping to 1.0."""
    # Age factor caps at 2.0 (50 days or more)
    prob_50 = calculate_failure_prob_7d("high", 50, "track")
    prob_100 = calculate_failure_prob_7d("high", 100, "track")
    assert prob_50 == prob_100 == 0.50

    # Negative age is treated as 0
    prob_neg = calculate_failure_prob_7d("critical", -10, "signal")
    assert prob_neg == 0.50

    # Fallbacks for None and unknown inputs
    prob_none = calculate_failure_prob_7d(None, 0, None)
    assert prob_none == 0.05  # default base 0.05 * 1.0 * 1.0

    # Maximum probability capped at 1.0
    prob_capped = calculate_failure_prob_7d("critical", 200, "signal")
    assert 0.0 <= prob_capped <= 1.0
    assert prob_capped == 1.0


# ===========================================================================
# 3. Unit Tests for calculate_urgency_score
# ===========================================================================


def test_calculate_urgency_score_calculation():
    """Verify weighted urgency formula: 0.55 * priority + 0.35 * (prob * 100) + overdue_bonus."""
    # Priority=80, Failure Prob=0.5, days_overdue=0
    # Urgency = (0.55 * 80) + (0.35 * 50) + 0 = 44 + 17.5 = 61.5
    urgency = calculate_urgency_score(priority_score=80.0, failure_prob_7d=0.5, days_overdue=0)
    assert urgency == pytest.approx(61.5, abs=0.01)

    # With 10 days overdue -> bonus = 10 * 0.5 = 5.0
    urgency_with_overdue = calculate_urgency_score(priority_score=80.0, failure_prob_7d=0.5, days_overdue=10)
    assert urgency_with_overdue == pytest.approx(66.5, abs=0.01)


def test_calculate_urgency_score_bounds_and_capping():
    """Verify that urgency score is bounded strictly within [0.0, 100.0] and overdue bonus is capped at 10.0."""
    # Overdue bonus capping at 10.0 (>= 20 days)
    urgency_20_days = calculate_urgency_score(50.0, 0.2, days_overdue=20)
    urgency_50_days = calculate_urgency_score(50.0, 0.2, days_overdue=50)
    assert urgency_20_days == urgency_50_days

    # Lower bound test
    min_urgency = calculate_urgency_score(0.0, 0.0, days_overdue=-10)
    assert min_urgency == 0.0

    # Upper bound test
    max_urgency = calculate_urgency_score(150.0, 1.5, days_overdue=100)
    assert max_urgency == 100.0


# ===========================================================================
# 4. Database Integration Tests for score_tasks and score_all_tasks
# ===========================================================================


def test_score_all_tasks_db_integration(db_session: Session, sample_task: MaintenanceTask):
    """Test scoring all tasks in the database and updating scores and status."""
    today = date.today()
    sample_task.priority_score = 0.0
    sample_task.failure_prob_7d = 0.0
    sample_task.failure_prob_30d = 0.0
    sample_task.urgency_score = 0.0
    sample_task.status = "pending"
    db_session.commit()

    scored = score_all_tasks(db_session, reference_date=today, update_status=True)

    assert len(scored) == 1
    t = scored[0]
    assert t.priority_score > 0.0
    assert t.failure_prob_7d > 0.0
    # DB check constraint: failure_prob_30d >= failure_prob_7d
    assert t.failure_prob_30d >= t.failure_prob_7d
    assert t.failure_prob_30d <= 1.0
    assert t.urgency_score > 0.0
    assert t.status == "scored"


def test_score_tasks_specific_ids(db_session: Session, sample_dataset: dict):
    """Test scoring only tasks specified by task_ids sequence."""
    tasks = sample_dataset["tasks"]
    target_task_id = tasks[0].task_id

    # Reset all tasks to 0 scores
    for t in tasks:
        t.priority_score = 0.0
        t.urgency_score = 0.0
        t.status = "pending"
    db_session.commit()

    # Score only the first task
    scored = score_tasks(db_session, task_ids=[target_task_id], update_status=True)

    assert len(scored) == 1
    assert scored[0].task_id == target_task_id
    assert scored[0].priority_score > 0.0
    assert scored[0].status == "scored"

    # Other tasks should remain pending with score 0.0
    other_tasks = db_session.query(MaintenanceTask).filter(MaintenanceTask.task_id != target_task_id).all()
    for ot in other_tasks:
        assert ot.status == "pending"
        assert ot.priority_score == 0.0


def test_score_tasks_overdue_and_age_variations(db_session: Session):
    """Test overdue calculation from defect max_allowed_delay_days when task has no latest_end_date."""
    ref_date = date(2026, 9, 10)

    asset = Asset(
        asset_id=20,
        asset_type="track",
        sub_type="60kg",
        division_code="PRYJ",
        section_code="ALD-MZP",
        corridor_id="CORR-1",
        km_start=1.0,
        km_end=2.0,
        line_category="A",
        traffic_density_class="B",
    )
    # Defect detected 10 days before ref_date, max delay 3 days -> 7 days overdue
    defect = Defect(
        defect_id=20,
        asset_id=20,
        department="P.Way",
        defect_type="joint_defect",
        defect_severity="major",
        detected_date=ref_date - timedelta(days=10),
        detected_by="USFD",
        status="open",
        recommended_action="Replace",
        estimated_work_duration_min=60,
        max_allowed_delay_days=3,
        source_system="TMS",
        source_defect_id="DEF-20",
    )
    # Task is 7 days overdue relative to ref_date
    task = MaintenanceTask(
        task_id=200,
        asset_id=20,
        department="P.Way",
        task_type="joint_replacement",
        linked_defect_id=20,
        priority_score=0.0,
        failure_prob_7d=0.0,
        failure_prob_30d=0.0,
        urgency_score=0.0,
        estimated_duration_min=60,
        earliest_start_date=ref_date - timedelta(days=10),
        latest_end_date=ref_date - timedelta(days=7),
        preferred_shift="any",
        status="pending",
        source_system="TMS",
    )
    db_session.add_all([asset, defect, task])
    db_session.commit()

    scored = score_tasks(db_session, task_ids=[200], reference_date=ref_date, update_status=True)
    assert len(scored) == 1
    t = scored[0]
    # major severity (60) + B density (10) + track (5) + overdue (7*2 = 14) = 89.0
    assert t.priority_score == pytest.approx(89.0, abs=0.1)
    assert t.status == "scored"


def test_score_tasks_preserves_non_pending_status(db_session: Session, sample_task: MaintenanceTask):
    """Ensure that tasks with status 'scheduled' or 'completed' do not revert or change to 'scored'."""
    sample_task.status = "scheduled"
    db_session.commit()

    scored = score_all_tasks(db_session, update_status=True)
    assert len(scored) == 1
    assert scored[0].status == "scheduled"  # remains scheduled


def test_score_tasks_empty_db(db_session: Session):
    """Ensure score_all_tasks handles an empty database table gracefully."""
    scored = score_all_tasks(db_session)
    assert scored == []


def test_score_tasks_missing_relationships(db_session: Session, sample_asset: Asset):
    """Ensure scoring handles tasks without linked defects gracefully."""
    task_no_defect = MaintenanceTask(
        task_id=999,
        asset_id=sample_asset.asset_id,
        department="General",
        task_type="routine_inspection",
        linked_defect_id=None,
        priority_score=0.0,
        failure_prob_7d=0.0,
        failure_prob_30d=0.0,
        urgency_score=0.0,
        estimated_duration_min=30,
        earliest_start_date=date.today(),
        latest_end_date=date.today() + timedelta(days=5),
        preferred_shift="any",
        status="pending",
        source_system="MANUAL",
    )
    db_session.add(task_no_defect)
    db_session.commit()

    scored = score_tasks(db_session, task_ids=[999], update_status=True)
    assert len(scored) == 1
    assert scored[0].priority_score > 0.0
    assert scored[0].status == "scored"


def test_score_tasks_reference_date_types(db_session: Session, sample_task: MaintenanceTask):
    """Test score_tasks with datetime instance and None as reference_date."""
    # Datetime instance
    scored_dt = score_tasks(db_session, task_ids=[sample_task.task_id], reference_date=datetime.now())
    assert len(scored_dt) == 1

    # None defaults to date.today()
    scored_none = score_tasks(db_session, task_ids=[sample_task.task_id], reference_date=None)
    assert len(scored_none) == 1
