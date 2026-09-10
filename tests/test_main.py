"""Pytest tests for FastAPI main application, routers, middleware, and exception handlers using isolated fixtures."""

import pytest
from fastapi.testclient import TestClient

from app.models import Asset, Block, BlockTask, Defect, MaintenanceTask


def test_root_endpoint(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Indian Railways Maintenance Block Planning API"
    assert data["version"] == "1.0.0"
    assert data["status"] == "online"
    assert data["docs_url"] == "/docs"


def test_health_check_endpoint(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data


def test_cors_headers(client: TestClient):
    response = client.options("/", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") in ["*", "http://localhost:3000"]


def test_http_exception_404_handler(client: TestClient):
    response = client.get("/api/v1/assets/99999999")
    assert response.status_code == 404
    data = response.json()
    assert data["status_code"] == 404
    assert "not found" in data["detail"].lower()


def test_validation_error_422_handler(client: TestClient):
    response = client.post("/api/v1/assets", json={})
    assert response.status_code == 422
    data = response.json()
    assert data["status_code"] == 422
    assert data["message"] == "Validation Error"
    assert isinstance(data["detail"], list)


def test_assets_crud(client: TestClient, sample_asset: Asset):
    # 1. Get all assets
    response = client.get("/api/assets?limit=5")
    assert response.status_code == 200
    assets = response.json()
    assert isinstance(assets, list)
    assert len(assets) >= 1

    asset_id = sample_asset.asset_id
    # 2. Get specific asset
    resp_get = client.get(f"/api/assets/{asset_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["asset_id"] == asset_id


def test_defects_crud_and_status_update(client: TestClient, sample_defect: Defect):
    defect_id = sample_defect.defect_id

    # 1. Get all defects
    response = client.get("/api/defects?limit=5")
    assert response.status_code == 200
    defects = response.json()
    assert isinstance(defects, list)
    assert len(defects) >= 1

    # 2. Get specific defect
    resp_get = client.get(f"/api/defects/{defect_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["defect_id"] == defect_id

    # 3. Update defect status
    resp_put_status = client.put(f"/api/defects/{defect_id}/status", json={"status": "in_progress"})
    assert resp_put_status.status_code == 200
    assert resp_put_status.json()["status"] == "in_progress"


def test_tasks_crud_backlog_status_and_score(client: TestClient, sample_task: MaintenanceTask):
    task_id = sample_task.task_id

    # 1. Get all tasks
    response = client.get("/api/tasks?limit=5")
    assert response.status_code == 200
    tasks = response.json()
    assert isinstance(tasks, list)
    assert len(tasks) >= 1

    # 2. Get backlog tasks
    resp_backlog = client.get("/api/tasks/backlog?status=pending,scored&limit=5")
    assert resp_backlog.status_code == 200
    assert isinstance(resp_backlog.json(), list)
    assert len(resp_backlog.json()) >= 1

    # 3. Get specific task
    resp_get = client.get(f"/api/tasks/{task_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["task_id"] == task_id

    # 4. Update task status
    resp_status = client.put(f"/api/tasks/{task_id}/status", json={"status": "scored"})
    assert resp_status.status_code == 200
    assert resp_status.json()["status"] == "scored"

    # 5. Score tasks
    resp_score = client.post("/api/tasks/score")
    assert resp_score.status_code == 200
    assert "tasks_scored" in resp_score.json()


def test_blocks_crud_and_status_update(client: TestClient, sample_block: Block, sample_block_task: BlockTask):
    block_id = sample_block.block_id

    # 1. Get all blocks
    response = client.get("/api/blocks?skip=0&limit=5")
    assert response.status_code == 200
    blocks = response.json()
    assert isinstance(blocks, list)
    assert len(blocks) >= 1

    # 2. Get specific block
    resp_get = client.get(f"/api/blocks/{block_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["block_id"] == block_id

    # 3. Get tasks for a block
    resp_tasks = client.get(f"/api/blocks/{block_id}/tasks")
    assert resp_tasks.status_code == 200
    assert isinstance(resp_tasks.json(), list)
    assert len(resp_tasks.json()) >= 1

    # 4. Update block status
    resp_put = client.put(f"/api/blocks/{block_id}/status", json={"status": "approved"})
    assert resp_put.status_code == 200
    assert resp_put.json()["status"] == "approved"


def test_optimization_router_endpoints(client: TestClient, sample_dataset: dict):
    # 1. POST /api/optimization/run
    response_run = client.post("/api/optimization/run?horizon=weekly")
    assert response_run.status_code == 200
    run_data = response_run.json()
    assert run_data["status"] == "success"
    assert "blocks_created" in run_data
    assert "tasks_scheduled" in run_data

    # 2. GET /api/optimization/stats
    response_stats = client.get("/api/optimization/stats")
    assert response_stats.status_code == 200
    stats = response_stats.json()
    assert "total_blocks" in stats
    assert "tasks_scheduled" in stats
    assert "avg_train_impact" in stats

    # 3. POST /api/optimization/export-csv
    response_export = client.post("/api/optimization/export-csv")
    assert response_export.status_code == 200
    export_data = response_export.json()
    assert export_data["status"] == "success"
    assert "exported_files" in export_data
