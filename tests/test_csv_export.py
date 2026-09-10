"""Pytest unit and database integration tests for CSV export service."""

from datetime import date, datetime, time
from pathlib import Path
from unittest.mock import MagicMock

import pandas as pd
import pytest
from sqlalchemy.orm import Session

from app.models import Block, BlockTask, MaintenanceTask
from app.services.csv_export import (
    _ensure_output_dir,
    _format_str,
    dataframe_to_csv,
    export_all_to_csv,
    export_block_tasks_csv,
    export_blocks_csv,
    export_task_schedule_csv,
)

# ===========================================================================
# 1. Unit Tests for Helper Functions
# ===========================================================================


def test_format_str_helper():
    """Verify string formatting across types (date, datetime, time, collection, None, NA)."""
    assert _format_str(None) == ""
    assert _format_str(pd.NA) == ""
    assert _format_str("hello") == "hello"
    assert _format_str(42) == "42"
    assert _format_str(3.1415) == "3.1415"

    d = date(2026, 9, 10)
    assert _format_str(d) == "2026-09-10"

    dt = datetime(2026, 9, 10, 14, 30, 0)
    assert _format_str(dt) == "2026-09-10T14:30:00"

    t = time(22, 30, 0)
    assert _format_str(t) == "22:30:00"

    assert _format_str(["S&T", "P.Way"]) == "S&T, P.Way"
    assert _format_str(("TRD", "ENG")) == "TRD, ENG"


def test_ensure_output_dir_helper(tmp_path: Path):
    """Verify directory creation for nested paths."""
    nested_file = tmp_path / "deep" / "nested" / "output.csv"
    assert not nested_file.parent.exists()
    _ensure_output_dir(nested_file)
    assert nested_file.parent.exists()


def test_dataframe_to_csv_helper():
    """Verify conversion of pandas DataFrame to CSV string."""
    df = pd.DataFrame([{"col1": "A", "col2": 10}, {"col1": "B", "col2": 20}])
    csv_str = dataframe_to_csv(df)
    assert "col1,col2" in csv_str
    assert "A,10" in csv_str
    assert "B,20" in csv_str


# ===========================================================================
# 2. Database Integration Tests with Real Session Fixtures
# ===========================================================================


def test_export_blocks_csv_db_integration(db_session: Session, sample_block: Block, tmp_path: Path):
    """Test export_blocks_csv using real database session and verify CSV contents and file creation."""
    out_file = tmp_path / "output" / "blocks.csv"

    csv_text = export_blocks_csv(db_session, output_path=out_file)

    assert out_file.exists()
    assert "block_id" in csv_text
    assert "corridor_id" in csv_text
    assert "NCR-PRYJ-MKP" in csv_text
    assert "PYRJ-MIU" in csv_text
    assert "10.000" in csv_text
    assert "12.000" in csv_text
    assert "S&T" in csv_text
    assert "planned" in csv_text


def test_export_blocks_csv_empty_db(db_session: Session, tmp_path: Path):
    """Test export_blocks_csv when blocks table is empty."""
    out_file = tmp_path / "empty_blocks.csv"
    csv_text = export_blocks_csv(db_session, output_path=out_file)

    assert out_file.exists()
    # Headers must exist even if there are 0 data rows
    assert "block_id" in csv_text
    assert "corridor_id" in csv_text


def test_export_block_tasks_csv_db_integration(db_session: Session, sample_block_task: BlockTask, tmp_path: Path):
    """Test export_block_tasks_csv using real database session."""
    out_file = tmp_path / "output" / "block_tasks.csv"

    csv_text = export_block_tasks_csv(db_session, output_path=out_file)

    assert out_file.exists()
    assert "block_id" in csv_text
    assert "task_id" in csv_text
    assert "planned_duration_min" in csv_text
    assert "sequence_order" in csv_text
    assert str(sample_block_task.block_id) in csv_text
    assert str(sample_block_task.task_id) in csv_text
    assert "S&T" in csv_text


def test_export_block_tasks_csv_empty_db(db_session: Session, tmp_path: Path):
    """Test export_block_tasks_csv when block_tasks table is empty."""
    out_file = tmp_path / "empty_block_tasks.csv"
    csv_text = export_block_tasks_csv(db_session, output_path=out_file)

    assert out_file.exists()
    assert "block_id" in csv_text
    assert "task_id" in csv_text


def test_export_task_schedule_csv_db_integration(db_session: Session, sample_block_task: BlockTask, tmp_path: Path):
    """Test export_task_schedule_csv joined table query with asset and defect details."""
    out_file = tmp_path / "output" / "task_schedule.csv"

    csv_text = export_task_schedule_csv(db_session, output_path=out_file)

    assert out_file.exists()
    # Key joined headers
    assert "assignment_id" in csv_text
    assert "block_id" in csv_text
    assert "task_id" in csv_text
    assert "section_code" in csv_text
    assert "corridor_id" in csv_text
    assert "asset_type" in csv_text
    assert "defect_severity" in csv_text
    assert "urgency_score" in csv_text
    # Values
    assert "PYRJ-MIU" in csv_text
    assert "signal" in csv_text
    assert "critical" in csv_text


def test_export_task_schedule_csv_empty_db(db_session: Session, tmp_path: Path):
    """Test export_task_schedule_csv when table is empty."""
    out_file = tmp_path / "empty_task_schedule.csv"
    csv_text = export_task_schedule_csv(db_session, output_path=out_file)

    assert out_file.exists()
    assert "assignment_id" in csv_text
    assert "urgency_score" in csv_text


def test_export_all_to_csv_db_integration(db_session: Session, sample_block_task: BlockTask, tmp_path: Path):
    """Test export_all_to_csv generates all 3 CSV files into target directory."""
    out_dir = tmp_path / "export_all_test"

    paths = export_all_to_csv(db_session, output_dir=out_dir)

    assert "blocks" in paths
    assert "block_tasks" in paths
    assert "task_schedule" in paths

    blocks_path = Path(paths["blocks"])
    block_tasks_path = Path(paths["block_tasks"])
    task_schedule_path = Path(paths["task_schedule"])

    assert blocks_path.exists()
    assert block_tasks_path.exists()
    assert task_schedule_path.exists()

    assert blocks_path.stat().st_size > 0
    assert block_tasks_path.stat().st_size > 0
    assert task_schedule_path.stat().st_size > 0


# ===========================================================================
# 3. Unit Tests with Mock DB Session
# ===========================================================================


@pytest.fixture
def mock_db_session():
    """Mock DB Session fixture for testing isolated query framing."""
    db = MagicMock()

    mock_block = MagicMock()
    mock_block.block_id = 1
    mock_block.corridor_id = "NCR-PRYJ-MKP"
    mock_block.section_code = "PYRJ-MIU"
    mock_block.km_start = 5.0
    mock_block.km_end = 10.0
    mock_block.block_date = date(2026, 9, 5)
    mock_block.start_time = time(22, 30, 0)
    mock_block.end_time = time(4, 30, 0)
    mock_block.duration_min = 60
    mock_block.block_type = "absolute"
    mock_block.departments_involved = ["S&T", "P.Way"]
    mock_block.status = "planned"
    mock_block.planned_tasks_count = 1
    mock_block.estimated_train_impact = 40.0
    mock_block.created_by = "test-user"
    mock_block.created_at = datetime(2026, 9, 5, 10, 0, 0)
    mock_block.updated_at = datetime(2026, 9, 5, 10, 0, 0)

    mock_asset = MagicMock()
    mock_asset.asset_id = 10
    mock_asset.asset_type = "signal"
    mock_asset.sub_type = "MACLS"
    mock_asset.section_code = "PYRJ-MIU"
    mock_asset.corridor_id = "NCR-PRYJ-MKP"

    mock_defect = MagicMock()
    mock_defect.defect_severity = "critical"

    mock_task = MagicMock()
    mock_task.task_id = 101
    mock_task.task_type = "corrective_signal_blank"
    mock_task.department = "S&T"
    mock_task.priority_score = 85.0
    mock_task.failure_prob_7d = 0.45
    mock_task.urgency_score = 78.5
    mock_task.preferred_shift = "night"
    mock_task.status = "scheduled"
    mock_task.asset_id = 10
    mock_task.linked_defect_id = 50
    mock_task.asset = mock_asset
    mock_task.linked_defect = mock_defect

    mock_bt = MagicMock()
    mock_bt.id = 1
    mock_bt.block_id = 1
    mock_bt.task_id = 101
    mock_bt.department = "S&T"
    mock_bt.planned_duration_min = 60
    mock_bt.sequence_order = 1
    mock_bt.created_at = datetime(2026, 9, 5, 10, 0, 0)
    mock_bt.block = mock_block
    mock_bt.task = mock_task

    def query_side_effect(model):
        q = MagicMock()
        model_name = getattr(model, "__name__", str(model))
        if "BlockTask" in model_name:
            q.options.return_value = q
            q.order_by.return_value = q
            q.all.return_value = [mock_bt]
        elif "Block" in model_name:
            q.order_by.return_value = q
            q.all.return_value = [mock_block]
        else:
            q.all.return_value = []
        return q

    db.query.side_effect = query_side_effect
    return db


def test_mock_export_blocks_csv(mock_db_session, tmp_path):
    """Test export_blocks_csv with mock session."""
    out_file = tmp_path / "mock_blocks.csv"
    csv_text = export_blocks_csv(mock_db_session, output_path=out_file)
    assert out_file.exists()
    assert "block_id" in csv_text
    assert "NCR-PRYJ-MKP" in csv_text


def test_mock_export_block_tasks_csv(mock_db_session, tmp_path):
    """Test export_block_tasks_csv with mock session."""
    out_file = tmp_path / "mock_block_tasks.csv"
    csv_text = export_block_tasks_csv(mock_db_session, output_path=out_file)
    assert out_file.exists()
    assert "task_id" in csv_text
    assert "101" in csv_text


def test_mock_export_task_schedule_csv(mock_db_session, tmp_path):
    """Test export_task_schedule_csv with mock session."""
    out_file = tmp_path / "mock_task_schedule.csv"
    csv_text = export_task_schedule_csv(mock_db_session, output_path=out_file)
    assert out_file.exists()
    assert "assignment_id" in csv_text
    assert "78.5" in csv_text
