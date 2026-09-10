import json
import sys
from collections.abc import Generator
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

# Ensure project root directory is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import create_application
from app.models import (
    Asset,
    Block,
    BlockTask,
    CorridorWindow,
    Defect,
    MaintenanceTask,
)

# ---------------------------------------------------------------------------
# SQLite Compatibility Compilation for PostgreSQL ARRAY Columns
# ---------------------------------------------------------------------------


@compiles(ARRAY, "sqlite")
def compile_array_sqlite(type_: Any, compiler: Any, **kw: Any) -> str:
    """Render PostgreSQL ARRAY column as JSON in SQLite."""
    return "JSON"


ARRAY.bind_processor = lambda self, dialect: (
    (lambda value: json.dumps(value) if dialect.name == "sqlite" and value is not None else value)
)
ARRAY.result_processor = lambda self, dialect, coltype: (
    (lambda value: json.loads(value) if dialect.name == "sqlite" and isinstance(value, str) else (value or []))
)


# ---------------------------------------------------------------------------
# Database Setup and Teardown Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def db_engine():
    """Create a persistent in-memory SQLite engine for the test session."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine) -> Generator[Session, None, None]:
    """Function-scoped database session fixture.

    Creates all tables on setup, yields a fresh Session, and drops all tables
    on teardown to ensure complete isolation between tests.
    """
    Base.metadata.create_all(bind=db_engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = session_factory()

    try:
        yield session
    finally:
        session.rollback()
        session.close()
        Base.metadata.drop_all(bind=db_engine)


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """TestClient fixture with get_db dependency overridden to use the isolated db_session."""
    app = create_application()

    def _override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Model Data Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_asset(db_session: Session) -> Asset:
    """Create and return a sample Asset record in the test database."""
    asset = Asset(
        asset_id=1,
        asset_type="signal",
        sub_type="MACLS",
        division_code="PRYJ",
        section_code="PYRJ-MIU",
        corridor_id="NCR-PRYJ-MKP",
        km_start=Decimal("10.000"),
        km_end=Decimal("12.000"),
        line_category="A",
        traffic_density_class="A",
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)
    return asset


@pytest.fixture
def sample_defect(db_session: Session, sample_asset: Asset) -> Defect:
    """Create and return a sample Defect record linked to sample_asset."""
    defect = Defect(
        defect_id=1,
        asset_id=sample_asset.asset_id,
        department="S&T",
        defect_type="signal_blank",
        defect_severity="critical",
        detected_date=date.today() - timedelta(days=5),
        detected_by="SSE/Signal/PRYJ",
        status="open",
        recommended_action="Replace bulb & check relay contacts",
        estimated_work_duration_min=90,
        max_allowed_delay_days=2,
        source_system="TMS",
        source_defect_id="DEF-001",
    )
    db_session.add(defect)
    db_session.commit()
    db_session.refresh(defect)
    return defect


@pytest.fixture
def sample_task(db_session: Session, sample_asset: Asset, sample_defect: Defect) -> MaintenanceTask:
    """Create and return a sample MaintenanceTask record linked to asset and defect."""
    today = date.today()
    task = MaintenanceTask(
        task_id=1,
        asset_id=sample_asset.asset_id,
        department="S&T",
        task_type="corrective_signal_blank",
        linked_defect_id=sample_defect.defect_id,
        priority_score=85.0,
        failure_prob_7d=0.50,
        failure_prob_30d=0.725,
        urgency_score=78.5,
        estimated_duration_min=90,
        earliest_start_date=today - timedelta(days=2),
        latest_end_date=today + timedelta(days=5),
        preferred_shift="night",
        status="pending",
        source_system="TMS",
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)
    return task


@pytest.fixture
def sample_window(db_session: Session) -> CorridorWindow:
    """Create and return a sample CorridorWindow record in the test database."""
    today = date.today()
    window = CorridorWindow(
        window_id=1,
        corridor_id="NCR-PRYJ-MKP",
        section_code="PYRJ-MIU",
        km_start=Decimal("0.000"),
        km_end=Decimal("30.000"),
        valid_date=today + timedelta(days=1),
        start_time=time(22, 30, 0),
        end_time=time(4, 30, 0),
        block_type_allowed="absolute",
        max_duration_min=240,
        train_impact_score=Decimal("45.00"),
        freight_traffic_level="medium",
        source="COA",
    )
    db_session.add(window)
    db_session.commit()
    db_session.refresh(window)
    return window


@pytest.fixture
def sample_block(db_session: Session) -> Block:
    """Create and return a sample Block record in the test database."""
    today = date.today()
    block = Block(
        block_id=1,
        corridor_id="NCR-PRYJ-MKP",
        section_code="PYRJ-MIU",
        km_start=Decimal("10.000"),
        km_end=Decimal("12.000"),
        block_date=today + timedelta(days=1),
        start_time=time(22, 30, 0),
        end_time=time(4, 30, 0),
        duration_min=90,
        block_type="absolute",
        departments_involved=["S&T"],
        status="planned",
        planned_tasks_count=1,
        estimated_train_impact=Decimal("45.00"),
        created_by="heuristic-optimizer",
    )
    db_session.add(block)
    db_session.commit()
    db_session.refresh(block)
    return block


@pytest.fixture
def sample_block_task(db_session: Session, sample_block: Block, sample_task: MaintenanceTask) -> BlockTask:
    """Create and return a sample BlockTask record linking sample_block and sample_task."""
    bt = BlockTask(
        id=1,
        block_id=sample_block.block_id,
        task_id=sample_task.task_id,
        department="S&T",
        planned_duration_min=90,
        sequence_order=1,
    )
    db_session.add(bt)
    db_session.commit()
    db_session.refresh(bt)
    return bt


@pytest.fixture
def sample_dataset(db_session: Session) -> dict[str, Any]:
    """Create a rich, multi-department, multi-asset dataset for end-to-end testing."""
    today = date.today()

    # Assets
    asset_signal = Asset(
        asset_id=10,
        asset_type="signal",
        sub_type="MACLS",
        division_code="PRYJ",
        section_code="PYRJ-MIU",
        corridor_id="NCR-PRYJ-MKP",
        km_start=Decimal("5.000"),
        km_end=Decimal("10.000"),
        line_category="A",
        traffic_density_class="A",
    )
    asset_track = Asset(
        asset_id=11,
        asset_type="track",
        sub_type="60kg_UIC",
        division_code="PRYJ",
        section_code="PYRJ-MIU",
        corridor_id="NCR-PRYJ-MKP",
        km_start=Decimal("6.000"),
        km_end=Decimal("8.000"),
        line_category="A",
        traffic_density_class="A",
    )
    asset_trd = Asset(
        asset_id=12,
        asset_type="traction",
        sub_type="OHE_25KV",
        division_code="PRYJ",
        section_code="PYRJ-MIU",
        corridor_id="NCR-PRYJ-MKP",
        km_start=Decimal("15.000"),
        km_end=Decimal("20.000"),
        line_category="A",
        traffic_density_class="B",
    )
    db_session.add_all([asset_signal, asset_track, asset_trd])
    db_session.flush()

    # Defects
    def_signal = Defect(
        defect_id=10,
        asset_id=10,
        department="S&T",
        defect_type="signal_lamp_failure",
        defect_severity="critical",
        detected_date=today - timedelta(days=4),
        detected_by="SSE/Signal",
        status="open",
        recommended_action="Replace lamp",
        estimated_work_duration_min=120,
        max_allowed_delay_days=2,
        source_system="TMS",
        source_defect_id="DEF-10",
    )
    def_track = Defect(
        defect_id=11,
        asset_id=11,
        department="P.Way",
        defect_type="weld_fracture",
        defect_severity="major",
        detected_date=today - timedelta(days=2),
        detected_by="USFD Team",
        status="open",
        recommended_action="Weld replacement",
        estimated_work_duration_min=90,
        max_allowed_delay_days=5,
        source_system="TMS",
        source_defect_id="DEF-11",
    )
    def_trd = Defect(
        defect_id=12,
        asset_id=12,
        department="TRD",
        defect_type="insulator_flashover",
        defect_severity="minor",
        detected_date=today - timedelta(days=1),
        detected_by="TRD SSE",
        status="open",
        recommended_action="Insulator cleaning",
        estimated_work_duration_min=60,
        max_allowed_delay_days=10,
        source_system="TMS",
        source_defect_id="DEF-12",
    )
    db_session.add_all([def_signal, def_track, def_trd])
    db_session.flush()

    # Maintenance Tasks
    task_1 = MaintenanceTask(
        task_id=101,
        asset_id=10,
        department="S&T",
        task_type="signal_lamp_replacement",
        linked_defect_id=10,
        priority_score=95.0,
        failure_prob_7d=0.60,
        failure_prob_30d=0.86,
        urgency_score=92.0,
        estimated_duration_min=120,
        earliest_start_date=today,
        latest_end_date=today + timedelta(days=7),
        preferred_shift="night",
        status="pending",
        source_system="TMS",
    )
    task_2 = MaintenanceTask(
        task_id=102,
        asset_id=11,
        department="P.Way",
        task_type="weld_replacement",
        linked_defect_id=11,
        priority_score=75.0,
        failure_prob_7d=0.35,
        failure_prob_30d=0.52,
        urgency_score=70.0,
        estimated_duration_min=90,
        earliest_start_date=today,
        latest_end_date=today + timedelta(days=10),
        preferred_shift="any",
        status="pending",
        source_system="TMS",
    )
    task_3 = MaintenanceTask(
        task_id=103,
        asset_id=12,
        department="TRD",
        task_type="insulator_cleaning",
        linked_defect_id=12,
        priority_score=50.0,
        failure_prob_7d=0.15,
        failure_prob_30d=0.25,
        urgency_score=45.0,
        estimated_duration_min=60,
        earliest_start_date=today,
        latest_end_date=today + timedelta(days=15),
        preferred_shift="any",
        status="pending",
        source_system="TMS",
    )
    db_session.add_all([task_1, task_2, task_3])
    db_session.flush()

    # Corridor Windows
    window_night = CorridorWindow(
        window_id=101,
        corridor_id="NCR-PRYJ-MKP",
        section_code="PYRJ-MIU",
        km_start=Decimal("0.000"),
        km_end=Decimal("30.000"),
        valid_date=today + timedelta(days=1),
        start_time=time(22, 30, 0),
        end_time=time(4, 30, 0),
        block_type_allowed="absolute",
        max_duration_min=240,
        train_impact_score=Decimal("35.00"),
        freight_traffic_level="medium",
        source="COA",
    )
    db_session.add(window_night)
    db_session.commit()

    return {
        "assets": [asset_signal, asset_track, asset_trd],
        "defects": [def_signal, def_track, def_trd],
        "tasks": [task_1, task_2, task_3],
        "windows": [window_night],
    }
