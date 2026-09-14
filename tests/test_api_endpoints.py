"""Comprehensive pytest tests for all API router endpoints, middleware, and error handling."""

from datetime import date, datetime, time, timedelta

import pytest
from fastapi.testclient import TestClient

from app.models import Asset, Block, BlockTask, Defect, MaintenanceTask


# ===========================================================================
# 1. System, Root, Health, CORS, and Middleware Endpoints
# ===========================================================================


def test_root_endpoint(client: TestClient):
    """Test root endpoint returns API information banner."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Indian Railways Maintenance Block Planning API"
    assert data["version"] == "1.0.0"
    assert data["status"] == "online"
    assert data["docs_url"] == "/docs"


def test_health_check_endpoint(client: TestClient):
    """Test health check endpoint reports status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data
    assert data["status"] in ["healthy", "degraded"]


def test_cors_options_preflight(client: TestClient):
    """Test CORS headers on OPTIONS preflight request."""
    response = client.options(
        "/",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers


def test_logging_middleware_process_time_header(client: TestClient):
    """Test custom LoggingMiddleware adds X-Process-Time-Ms header to responses."""
    response = client.get("/")
    assert response.status_code == 200
    assert "X-Process-Time-Ms" in response.headers
    process_time = float(response.headers["X-Process-Time-Ms"])
    assert process_time >= 0.0


def test_http_exception_404_handler(client: TestClient):
    """Test custom 404 exception handler format."""
    response = client.get("/api/v1/assets/999999")
    assert response.status_code == 404
    data = response.json()
    assert data["status_code"] == 404
    assert "not found" in data["detail"].lower()
    assert data["path"] == "/api/v1/assets/999999"


def test_validation_error_422_handler(client: TestClient):
    """Test custom 422 RequestValidationError exception handler format."""
    response = client.post("/api/v1/assets", json={})
    assert response.status_code == 422
    data = response.json()
    assert data["status_code"] == 422
    assert data["message"] == "Validation Error"
    assert isinstance(data["detail"], list)


# ===========================================================================
# 2. Assets API Endpoints (/api/v1/assets and /api/assets)
# ===========================================================================


def test_assets_crud_flow(client: TestClient):
    """Test full CRUD cycle for Assets API."""
    # 1. Create asset
    new_asset_data = {
        "asset_type": "track",
        "sub_type": "60kg_UIC",
        "division_code": "PRYJ",
        "section_code": "PYRJ-MIU",
        "corridor_id": "NCR-PRYJ-MKP",
        "km_start": 15.500,
        "km_end": 20.000,
        "line_category": "A",
        "traffic_density_class": "A",
    }
    resp_create = client.post("/api/v1/assets", json=new_asset_data)
    assert resp_create.status_code == 201
    created_asset = resp_create.json()
    asset_id = created_asset["asset_id"]
    assert created_asset["section_code"] == "PYRJ-MIU"
    assert float(created_asset["km_start"]) == 15.500

    # 2. Get asset by ID
    resp_get = client.get(f"/api/v1/assets/{asset_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["asset_id"] == asset_id

    # 3. List assets with pagination
    resp_list = client.get("/api/v1/assets?skip=0&limit=10")
    assert resp_list.status_code == 200
    items = resp_list.json()
    assert len(items) >= 1
    assert any(a["asset_id"] == asset_id for a in items)

    # 4. Update asset
    update_data = {**new_asset_data, "sub_type": "52kg_Modified"}
    resp_update = client.put(f"/api/v1/assets/{asset_id}", json=update_data)
    assert resp_update.status_code == 200
    assert resp_update.json()["sub_type"] == "52kg_Modified"

    # 5. Delete asset
    resp_delete = client.delete(f"/api/v1/assets/{asset_id}")
    assert resp_delete.status_code == 200
    assert f"Asset {asset_id} successfully deleted" in resp_delete.json()["message"]

    # 6. Verify deleted (404)
    resp_verify = client.get(f"/api/v1/assets/{asset_id}")
    assert resp_verify.status_code == 404


def test_assets_error_cases(client: TestClient):
    """Test 404 and 422 error cases on assets endpoints."""
    # 404 for non-existent asset ID on GET, PUT, DELETE
    assert client.get("/api/v1/assets/88888").status_code == 404
    assert client.delete("/api/v1/assets/88888").status_code == 404

    dummy_payload = {
        "asset_type": "track",
        "sub_type": "60kg",
        "division_code": "PRYJ",
        "section_code": "SEC",
        "corridor_id": "CORR",
        "km_start": 10.0,
        "km_end": 12.0,
        "line_category": "A",
        "traffic_density_class": "A",
    }
    assert client.put("/api/v1/assets/88888", json=dummy_payload).status_code == 404

    # 422 for invalid KM range (km_end < km_start)
    invalid_km_payload = {**dummy_payload, "km_start": 20.0, "km_end": 10.0}
    assert client.post("/api/v1/assets", json=invalid_km_payload).status_code == 422


# ===========================================================================
# 3. Defects API Endpoints (/api/v1/defects and /api/defects)
# ===========================================================================


def test_defects_crud_and_status_update(client: TestClient, sample_asset: Asset):
    """Test full CRUD and status update for Defects API."""
    today_str = date.today().isoformat()

    # 1. Create defect
    new_defect_data = {
        "asset_id": sample_asset.asset_id,
        "department": "S&T",
        "defect_type": "track_circuit_failure",
        "defect_severity": "critical",
        "detected_date": today_str,
        "detected_by": "JE/Signal",
        "status": "open",
        "recommended_action": "Check relay box wiring",
        "estimated_work_duration_min": 60,
        "max_allowed_delay_days": 1,
        "source_system": "TMS",
        "source_defect_id": "DEF-TC-01",
    }
    resp_create = client.post("/api/v1/defects", json=new_defect_data)
    assert resp_create.status_code == 201
    created_defect = resp_create.json()
    defect_id = created_defect["defect_id"]
    assert created_defect["defect_type"] == "track_circuit_failure"

    # 2. Get defect by ID
    resp_get = client.get(f"/api/v1/defects/{defect_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["defect_id"] == defect_id

    # 3. List defects (ordered desc by default, with X-Total-Count header)
    resp_list = client.get("/api/v1/defects?skip=0&limit=10")
    assert resp_list.status_code == 200
    assert len(resp_list.json()) >= 1
    assert "X-Total-Count" in resp_list.headers
    assert int(resp_list.headers["X-Total-Count"]) >= 1
    # Newly created defect should appear first in default descending order
    assert resp_list.json()[0]["defect_id"] == defect_id

    # 3b. Test defect statistics endpoint
    resp_stats = client.get("/api/v1/defects/stats")
    assert resp_stats.status_code == 200
    stats = resp_stats.json()
    assert "total" in stats
    assert "critical" in stats
    assert "open" in stats
    assert "closed" in stats
    assert stats["total"] >= 1

    # 4. Update defect
    update_data = {**new_defect_data, "recommended_action": "Replace fuse and relay"}
    resp_update = client.put(f"/api/v1/defects/{defect_id}", json=update_data)
    assert resp_update.status_code == 200
    assert resp_update.json()["recommended_action"] == "Replace fuse and relay"

    # 5. Update defect status
    resp_status = client.put(f"/api/v1/defects/{defect_id}/status", json={"status": "in_progress"})
    assert resp_status.status_code == 200
    assert resp_status.json()["status"] == "in_progress"

    # 6. Delete defect
    resp_del = client.delete(f"/api/v1/defects/{defect_id}")
    assert resp_del.status_code == 200

    # 7. Verify deleted (404)
    assert client.get(f"/api/v1/defects/{defect_id}").status_code == 404


def test_defects_error_cases(client: TestClient):
    """Test 404 and 422 error cases on defects endpoints."""
    assert client.get("/api/v1/defects/77777").status_code == 404
    assert client.put("/api/v1/defects/77777/status", json={"status": "open"}).status_code == 404
    assert client.delete("/api/v1/defects/77777").status_code == 404

    # 422 for invalid defect_severity enum
    invalid_severity_payload = {
        "asset_id": 1,
        "department": "S&T",
        "defect_type": "invalid_type",
        "defect_severity": "super_critical",  # invalid
        "detected_date": "2026-09-01",
        "detected_by": "Tester",
        "status": "open",
        "recommended_action": "Fix",
        "estimated_work_duration_min": 60,
        "max_allowed_delay_days": 1,
        "source_system": "TMS",
        "source_defect_id": "DEF-INV",
    }
    assert client.post("/api/v1/defects", json=invalid_severity_payload).status_code == 422


# ===========================================================================
# 4. Tasks API Endpoints (/api/v1/tasks and /api/tasks)
# ===========================================================================


def test_tasks_crud_backlog_and_scoring(client: TestClient, sample_asset: Asset, sample_defect: Defect):
    """Test full CRUD, backlog filtering, and scoring trigger for Maintenance Tasks API."""
    today = date.today()

    # 1. Create task
    new_task_data = {
        "asset_id": sample_asset.asset_id,
        "department": "S&T",
        "task_type": "signal_relay_replacement",
        "linked_defect_id": sample_defect.defect_id,
        "priority_score": 80.0,
        "failure_prob_7d": 0.40,
        "failure_prob_30d": 0.60,
        "urgency_score": 75.0,
        "estimated_duration_min": 90,
        "earliest_start_date": today.isoformat(),
        "latest_end_date": (today + timedelta(days=7)).isoformat(),
        "preferred_shift": "night",
        "status": "pending",
        "source_system": "TMS",
    }
    resp_create = client.post("/api/v1/tasks", json=new_task_data)
    assert resp_create.status_code == 201
    created_task = resp_create.json()
    task_id = created_task["task_id"]
    assert created_task["task_type"] == "signal_relay_replacement"

    # 2. Get task by ID
    resp_get = client.get(f"/api/v1/tasks/{task_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["task_id"] == task_id

    # 3. Backlog endpoint filtering by status and department
    resp_backlog = client.get(
        "/api/v1/tasks/backlog",
        params={"status": "pending", "department": "S&T", "min_priority": 50},
    )
    assert resp_backlog.status_code == 200
    backlog_items = resp_backlog.json()
    assert len(backlog_items) >= 1
    assert any(t["task_id"] == task_id for t in backlog_items)

    # 4. Update task
    update_data = {**new_task_data, "estimated_duration_min": 120}
    resp_update = client.put(f"/api/v1/tasks/{task_id}", json=update_data)
    assert resp_update.status_code == 200
    assert resp_update.json()["estimated_duration_min"] == 120

    # 5. Update task status
    resp_status = client.put(f"/api/v1/tasks/{task_id}/status", json={"status": "scored"})
    assert resp_status.status_code == 200
    assert resp_status.json()["status"] == "scored"

    # 6. Trigger ML scoring endpoint
    resp_score = client.post("/api/v1/tasks/score?update_status=true")
    assert resp_score.status_code == 200
    assert "tasks_scored" in resp_score.json()
    assert resp_score.json()["tasks_scored"] >= 1

    # 7. Delete task
    resp_del = client.delete(f"/api/v1/tasks/{task_id}")
    assert resp_del.status_code == 200

    # 8. Verify deleted (404)
    assert client.get(f"/api/v1/tasks/{task_id}").status_code == 404


def test_tasks_error_cases(client: TestClient):
    """Test 404 and 422 error cases on tasks endpoints."""
    assert client.get("/api/v1/tasks/66666").status_code == 404
    assert client.put("/api/v1/tasks/66666/status", json={"status": "pending"}).status_code == 404
    assert client.delete("/api/v1/tasks/66666").status_code == 404

    # 422 for latest_end_date earlier than earliest_start_date
    invalid_date_payload = {
        "asset_id": 1,
        "department": "S&T",
        "task_type": "signal_relay",
        "estimated_duration_min": 60,
        "earliest_start_date": "2026-09-10",
        "latest_end_date": "2026-09-05",  # earlier!
        "preferred_shift": "night",
        "status": "pending",
        "source_system": "TMS",
    }
    assert client.post("/api/v1/tasks", json=invalid_date_payload).status_code == 422


# ===========================================================================
# 5. Blocks API Endpoints (/api/v1/blocks and /api/blocks)
# ===========================================================================


def test_blocks_crud_and_status(client: TestClient, sample_block: Block):
    """Test Blocks API listing, getting by ID, status update, tasks retrieval, and deletion."""
    block_id = sample_block.block_id

    # 1. List blocks
    resp_list = client.get("/api/v1/blocks?skip=0&limit=10")
    assert resp_list.status_code == 200
    assert len(resp_list.json()) >= 1

    # 2. Get specific block
    resp_get = client.get(f"/api/v1/blocks/{block_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["block_id"] == block_id

    # 3. Get tasks assigned to block
    resp_tasks = client.get(f"/api/v1/blocks/{block_id}/tasks")
    assert resp_tasks.status_code == 200
    assert isinstance(resp_tasks.json(), list)

    # 4. Update block status
    resp_status = client.put(f"/api/v1/blocks/{block_id}/status", json={"status": "approved"})
    assert resp_status.status_code == 200
    assert resp_status.json()["status"] == "approved"

    # 5. Export blocks CSV endpoint
    resp_csv = client.get("/api/v1/blocks/export/csv")
    assert resp_csv.status_code == 200
    assert "text/csv" in resp_csv.headers["content-type"]
    assert "block_id" in resp_csv.text

    # 6. Delete block
    resp_del = client.delete(f"/api/v1/blocks/{block_id}")
    assert resp_del.status_code == 200

    # 7. Verify deleted (404)
    assert client.get(f"/api/v1/blocks/{block_id}").status_code == 404


def test_blocks_create_and_validation(client: TestClient):
    """Test manual block creation and validation rules."""
    new_block_data = {
        "corridor_id": "NCR-PRYJ-MKP",
        "section_code": "PYRJ-MIU",
        "km_start": 5.0,
        "km_end": 10.0,
        "block_date": "2026-09-12",
        "start_time": "22:00:00",
        "end_time": "04:00:00",
        "duration_min": 360,
        "block_type": "absolute",
        "departments_involved": ["S&T", "P.Way"],
        "status": "planned",
        "planned_tasks_count": 0,
        "estimated_train_impact": 25.0,
        "created_by": "test-admin",
    }
    resp_create = client.post("/api/v1/blocks", json=new_block_data)
    assert resp_create.status_code == 201
    created = resp_create.json()
    assert created["corridor_id"] == "NCR-PRYJ-MKP"
    assert "S&T" in created["departments_involved"]

    # 422 for duplicate departments in departments_involved
    invalid_depts_payload = {**new_block_data, "departments_involved": ["S&T", "S&T"]}
    assert client.post("/api/v1/blocks", json=invalid_depts_payload).status_code == 422


# ===========================================================================
# 6. Optimization Router Endpoints (/api/v1/optimization and /api/optimization)
# ===========================================================================


def test_optimization_run_and_stats(client: TestClient, sample_dataset: dict):
    """Test running the block optimizer via API and fetching optimization statistics."""
    # 1. Run optimization
    resp_run = client.post("/api/v1/optimization/run?horizon=weekly&replace_planned=true")
    assert resp_run.status_code == 200
    run_data = resp_run.json()
    assert run_data["status"] == "success"
    assert run_data["horizon"] == "weekly"
    assert run_data["blocks_created"] >= 1
    assert run_data["tasks_scheduled"] >= 1

    # 2. Get optimization statistics
    resp_stats = client.get("/api/v1/optimization/stats")
    assert resp_stats.status_code == 200
    stats = resp_stats.json()
    assert stats["total_blocks"] >= 1
    assert stats["tasks_scheduled"] >= 1
    assert "avg_train_impact" in stats
    assert "pending_backlog_tasks" in stats
    assert "multi_department_blocks" in stats


def test_optimization_export_csv_endpoint(client: TestClient, sample_block_task: BlockTask, tmp_path):
    """Test optimization export-csv endpoint generates all CSV files."""
    export_dir = str(tmp_path / "api_export")
    resp_export = client.post(f"/api/v1/optimization/export-csv?output_dir={export_dir}")
    assert resp_export.status_code == 200
    data = resp_export.json()
    assert data["status"] == "success"
    assert "exported_files" in data
    assert "blocks" in data["exported_files"]
    assert "block_tasks" in data["exported_files"]
    assert "task_schedule" in data["exported_files"]
