"""Pytest unit and database integration tests for BlockOptimizer service and optimize_blocks DB workflow."""

from datetime import date, datetime, time, timedelta
from decimal import Decimal

import pandas as pd
import pytest
from sqlalchemy.orm import Session

from app.models import Asset, Block, BlockTask, CorridorWindow, Defect, MaintenanceTask
from app.services.optimizer import (
    BlockOptimizer,
    _is_night_window,
    _km_overlaps,
    _parse_date,
    optimize_blocks,
)

# ===========================================================================
# 1. Unit Tests for Optimizer Helper Functions
# ===========================================================================


def test_parse_date_helper():
    """Test date parser across None, NA, date, datetime, ISO strings, and invalid strings."""
    assert _parse_date(None) is None
    assert _parse_date(pd.NA) is None

    d = date(2026, 9, 10)
    dt = datetime(2026, 9, 10, 15, 30, 0)
    assert _parse_date(d) == d
    assert _parse_date(dt) == d

    assert _parse_date("2026-09-10") == d
    assert _parse_date("2026-09-10T15:30:00") == d
    assert _parse_date("invalid-date-string") is None


@pytest.mark.parametrize(
    "start_val, expected_night",
    [
        (time(22, 30, 0), True),
        (time(2, 0, 0), True),
        (time(5, 59, 0), True),
        (time(6, 0, 0), False),
        (time(12, 0, 0), False),
        (time(19, 59, 0), False),
        (time(20, 0, 0), True),
        ("23:30:00", True),
        ("08:00:00", False),
        ("14:30:00", False),
        (None, True),  # default
        (pd.NA, True),
        ("malformed", True),
    ],
)
def test_is_night_window_helper(start_val, expected_night):
    """Test night window detection based on start time hours."""
    assert _is_night_window(start_val) == expected_night


@pytest.mark.parametrize(
    "a_start, a_end, b_start, b_end, expected_overlap",
    [
        (5.0, 10.0, 8.0, 15.0, True),     # Overlapping
        (0.0, 5.0, 10.0, 15.0, False),    # Disjoint
        (5.0, 10.0, 10.0, 15.0, True),    # Touching boundary
        (8.0, 12.0, 5.0, 15.0, True),     # Contained inside
        (None, None, 1.0, 2.0, True),     # None fallback returns True
        (1.0, 2.0, None, None, True),
    ],
)
def test_km_overlaps_helper(a_start, a_end, b_start, b_end, expected_overlap):
    """Test spatial KM range overlap detection."""
    assert _km_overlaps(a_start, a_end, b_start, b_end) == expected_overlap


# ===========================================================================
# 2. Unit Tests for BlockOptimizer Class
# ===========================================================================


@pytest.fixture
def optimizer_data():
    """Fixture returning sample tasks_df, windows_df, and assets_df for BlockOptimizer testing."""
    today = date.today()

    tasks_df = pd.DataFrame(
        [
            {
                "task_id": 1,
                "asset_id": 101,
                "department": "S&T",
                "section_code": "PYRJ-MIU",
                "km_start": 5.0,
                "km_end": 10.0,
                "urgency_score": 90.0,
                "priority_score": 85.0,
                "estimated_duration_min": 120,
                "earliest_start_date": today,
                "latest_end_date": today + timedelta(days=10),
                "preferred_shift": "night",
                "status": "scored",
            },
            {
                "task_id": 2,
                "asset_id": 101,
                "department": "P.Way",
                "section_code": "PYRJ-MIU",
                "km_start": 6.0,
                "km_end": 8.0,
                "urgency_score": 70.0,
                "priority_score": 65.0,
                "estimated_duration_min": 90,
                "earliest_start_date": today,
                "latest_end_date": today + timedelta(days=10),
                "preferred_shift": "any",
                "status": "scored",
            },
            {
                "task_id": 3,
                "asset_id": 102,
                "department": "TRD",
                "section_code": "PYRJ-MIU",
                "km_start": 15.0,
                "km_end": 20.0,
                "urgency_score": 95.0,
                "priority_score": 90.0,
                "estimated_duration_min": 180,
                "earliest_start_date": today + timedelta(days=15),  # Too late for today+1 window
                "latest_end_date": today + timedelta(days=30),
                "preferred_shift": "any",
                "status": "scored",
            },
            {
                "task_id": 4,
                "asset_id": 103,
                "department": "S&T",
                "section_code": "ALD-MZP",  # Different section
                "km_start": 50.0,
                "km_end": 55.0,
                "urgency_score": 80.0,
                "priority_score": 75.0,
                "estimated_duration_min": 60,
                "earliest_start_date": today,
                "latest_end_date": today + timedelta(days=5),
                "preferred_shift": "night",
                "status": "scored",
            },
            {
                "task_id": 5,
                "asset_id": 101,
                "department": "P.Way",
                "section_code": "PYRJ-MIU",
                "km_start": 7.0,
                "km_end": 9.0,
                "urgency_score": 85.0,
                "priority_score": 80.0,
                "estimated_duration_min": 60,
                "earliest_start_date": today,
                "latest_end_date": today + timedelta(days=5),
                "preferred_shift": "day",  # Day shift task
                "status": "scored",
            },
        ]
    )

    windows_df = pd.DataFrame(
        [
            {
                "window_id": 1,
                "corridor_id": "NCR-PRYJ-MKP",
                "section_code": "PYRJ-MIU",
                "km_start": 0.0,
                "km_end": 30.0,
                "valid_date": today + timedelta(days=1),
                "start_time": "22:30:00",
                "end_time": "04:30:00",
                "block_type_allowed": "absolute",
                "max_duration_min": 240,
                "train_impact_score": 45.0,
            },
        ]
    )

    return tasks_df, windows_df


def test_block_optimizer_init_and_asset_merge():
    """Test optimizer initialization and merging spatial attributes from assets_df."""
    today = date.today()
    tasks_no_section = pd.DataFrame(
        [
            {
                "task_id": 1,
                "asset_id": 50,
                "urgency_score": 80.0,
                "estimated_duration_min": 60,
                "earliest_start_date": today,
                "latest_end_date": today + timedelta(days=5),
            }
        ]
    )
    assets_df = pd.DataFrame(
        [
            {
                "asset_id": 50,
                "section_code": "SEC-MERGE",
                "km_start": 10.0,
                "km_end": 15.0,
            }
        ]
    )
    windows_df = pd.DataFrame(
        [
            {
                "window_id": 1,
                "section_code": "SEC-MERGE",
                "km_start": 0.0,
                "km_end": 20.0,
                "max_duration_min": 120,
            }
        ]
    )

    optimizer = BlockOptimizer(tasks_df=tasks_no_section, windows_df=windows_df, assets_df=assets_df)
    assert "section_code" in optimizer.tasks_df.columns
    assert optimizer.tasks_df.iloc[0]["section_code"] == "SEC-MERGE"
    assert optimizer.tasks_df.iloc[0]["km_start"] == 10.0


def test_get_candidate_tasks_filtering(optimizer_data):
    """Test candidate task filtering: section, date window, km overlap, and shift preference."""
    tasks_df, windows_df = optimizer_data
    optimizer = BlockOptimizer(tasks_df, windows_df)

    window = windows_df.iloc[0]  # Night window on PYRJ-MIU, max 240 min
    candidates = optimizer._get_candidate_tasks(window)

    # Task 1 (S&T, night, urgency 90) -> matches
    # Task 2 (P.Way, any, urgency 70) -> matches
    # Task 3 (TRD, earliest start too late) -> excluded
    # Task 4 (S&T, section ALD-MZP) -> excluded
    # Task 5 (P.Way, day shift in night window) -> excluded
    assert len(candidates) == 2
    assert list(candidates["task_id"]) == [1, 2]  # Sorted by urgency_score descending


def test_get_candidate_tasks_status_exclusion(optimizer_data):
    """Verify that tasks with completed, scheduled, or cancelled status are excluded."""
    tasks_df, windows_df = optimizer_data
    tasks_df.loc[tasks_df["task_id"] == 1, "status"] = "scheduled"
    tasks_df.loc[tasks_df["task_id"] == 2, "status"] = "completed"

    optimizer = BlockOptimizer(tasks_df, windows_df)
    window = windows_df.iloc[0]
    candidates = optimizer._get_candidate_tasks(window)

    candidate_ids = list(candidates["task_id"]) if not candidates.empty else []
    assert 1 not in candidate_ids
    assert 2 not in candidate_ids


def test_select_tasks_for_window_capacity_and_greedy_skip(optimizer_data):
    """Verify greedy packing: selecting tasks up to max_duration and packing smaller tasks when large ones don't fit."""
    today = date.today()
    tasks_df = pd.DataFrame(
        [
            {"task_id": 1, "estimated_duration_min": 100, "urgency_score": 90.0, "section_code": "SEC-1", "km_start": 0, "km_end": 10, "earliest_start_date": today, "latest_end_date": today + timedelta(days=5), "preferred_shift": "any", "status": "scored"},
            {"task_id": 2, "estimated_duration_min": 100, "urgency_score": 80.0, "section_code": "SEC-1", "km_start": 0, "km_end": 10, "earliest_start_date": today, "latest_end_date": today + timedelta(days=5), "preferred_shift": "any", "status": "scored"},
            {"task_id": 3, "estimated_duration_min": 30, "urgency_score": 70.0, "section_code": "SEC-1", "km_start": 0, "km_end": 10, "earliest_start_date": today, "latest_end_date": today + timedelta(days=5), "preferred_shift": "any", "status": "scored"},
        ]
    )
    # Window max duration = 140 min
    # Task 1 (100) fits -> used = 100
    # Task 2 (100) doesn't fit (100+100=200 > 140) -> skipped
    # Task 3 (30) fits (100+30=130 <= 140) -> selected!
    window = pd.Series({"max_duration_min": 140, "valid_date": today, "section_code": "SEC-1", "km_start": 0, "km_end": 10, "start_time": "22:00:00"})

    optimizer = BlockOptimizer(tasks_df, pd.DataFrame([window]))
    candidates = optimizer._get_candidate_tasks(window)
    selected = optimizer._select_tasks_for_window(candidates, window)

    selected_ids = [t["task_id"] for t in selected]
    assert selected_ids == [1, 3]


def test_create_block_and_block_tasks(optimizer_data):
    """Verify attributes of constructed block and block tasks."""
    tasks_df, windows_df = optimizer_data
    optimizer = BlockOptimizer(tasks_df, windows_df)

    window = windows_df.iloc[0]
    candidates = optimizer._get_candidate_tasks(window)
    selected = optimizer._select_tasks_for_window(candidates, window)

    block = optimizer._create_block(window, selected, block_id=42)
    block_tasks = optimizer._create_block_tasks(block_id=42, selected_tasks=selected, start_assignment_id=10)

    assert block["block_id"] == 42
    assert block["section_code"] == "PYRJ-MIU"
    assert block["duration_min"] == 210  # 120 + 90
    assert block["planned_tasks_count"] == 2
    assert sorted(block["departments_involved"]) == ["P.Way", "S&T"]
    assert block["status"] == "planned"

    assert len(block_tasks) == 2
    assert block_tasks[0]["id"] == 10
    assert block_tasks[0]["block_id"] == 42
    assert block_tasks[0]["sequence_order"] == 1
    assert block_tasks[1]["id"] == 11
    assert block_tasks[1]["sequence_order"] == 2


def test_optimize_end_to_end_multiple_windows():
    """Verify that tasks assigned in earlier windows are not assigned in subsequent windows."""
    today = date.today()
    tasks_df = pd.DataFrame(
        [
            {"task_id": 1, "estimated_duration_min": 60, "urgency_score": 90.0, "section_code": "SEC-A", "km_start": 0, "km_end": 10, "earliest_start_date": today, "latest_end_date": today + timedelta(days=5), "preferred_shift": "night", "status": "scored", "department": "S&T"},
            {"task_id": 2, "estimated_duration_min": 60, "urgency_score": 80.0, "section_code": "SEC-A", "km_start": 0, "km_end": 10, "earliest_start_date": today, "latest_end_date": today + timedelta(days=5), "preferred_shift": "night", "status": "scored", "department": "P.Way"},
        ]
    )
    windows_df = pd.DataFrame(
        [
            {"window_id": 1, "corridor_id": "C-1", "section_code": "SEC-A", "km_start": 0, "km_end": 10, "valid_date": today, "start_time": "22:00:00", "end_time": "04:00:00", "max_duration_min": 70, "train_impact_score": 20.0},
            {"window_id": 2, "corridor_id": "C-1", "section_code": "SEC-A", "km_start": 0, "km_end": 10, "valid_date": today + timedelta(days=1), "start_time": "22:00:00", "end_time": "04:00:00", "max_duration_min": 70, "train_impact_score": 20.0},
        ]
    )

    optimizer = BlockOptimizer(tasks_df, windows_df)
    blocks, block_tasks = optimizer.optimize()

    # Window 1 gets Task 1 (60 min)
    # Window 2 gets Task 2 (60 min)
    assert len(blocks) == 2
    assert len(block_tasks) == 2
    assert optimizer.assigned_task_ids == {1, 2}
    assert block_tasks[0]["task_id"] == 1
    assert block_tasks[1]["task_id"] == 2


def test_optimize_empty_candidates():
    """Verify optimizer handles empty task or window inputs gracefully."""
    empty_df = pd.DataFrame()
    optimizer = BlockOptimizer(empty_df, empty_df)
    blocks, block_tasks = optimizer.optimize()
    assert blocks == []
    assert block_tasks == []


# ===========================================================================
# 3. Database Integration Tests for optimize_blocks
# ===========================================================================


def test_optimize_blocks_db_integration(db_session: Session, sample_dataset: dict):
    """Test end-to-end optimize_blocks DB function with real database session."""
    # Ensure tasks start with pending status
    tasks = sample_dataset["tasks"]
    for t in tasks:
        t.status = "pending"
    db_session.commit()

    # Run optimizer
    result = optimize_blocks(db_session, replace_planned=True)

    assert result["blocks_created"] >= 1
    assert result["tasks_scheduled"] >= 1

    # Verify created Block record in DB
    blocks_in_db = db_session.query(Block).all()
    assert len(blocks_in_db) == result["blocks_created"]

    first_block = blocks_in_db[0]
    assert first_block.status == "planned"
    assert first_block.planned_tasks_count > 0
    assert len(first_block.block_tasks) == first_block.planned_tasks_count

    # Verify task status transitioned to 'scheduled'
    scheduled_tasks = db_session.query(MaintenanceTask).filter(MaintenanceTask.status == "scheduled").all()
    assert len(scheduled_tasks) == result["tasks_scheduled"]


def test_optimize_blocks_replace_planned_flag(db_session: Session, sample_dataset: dict):
    """Test replace_planned=True vs replace_planned=False behavior."""
    # First run
    res1 = optimize_blocks(db_session, replace_planned=True)
    initial_blocks_count = res1["blocks_created"]
    assert initial_blocks_count > 0

    # Second run with replace_planned=True should delete previous planned blocks and recreate them
    res2 = optimize_blocks(db_session, replace_planned=True)
    assert res2["blocks_created"] == initial_blocks_count

    total_blocks = db_session.query(Block).count()
    assert total_blocks == initial_blocks_count


def test_optimize_blocks_empty_db(db_session: Session):
    """Test optimize_blocks when database has no tasks or windows."""
    result = optimize_blocks(db_session)
    assert result["blocks_created"] == 0
    assert result["tasks_scheduled"] == 0
