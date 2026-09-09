from datetime import timedelta
from uuid import uuid4

import pulp
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models import Block, BlockTask, CorridorWindow, MaintenanceTask
from app.services.ml_scoring import score_tasks

ABSOLUTE_COMPATIBLE = {"absolute"}
CAUTION_COMPATIBLE = {"absolute", "caution", "power"}


def _compatible(task_type: str, window_type: str) -> bool:
    if window_type == "absolute":
        return True
    if window_type == "power":
        return task_type in {"power", "caution"}
    return task_type in CAUTION_COMPATIBLE and task_type != "absolute"


def _overlaps_section(task: MaintenanceTask, window: CorridorWindow) -> bool:
    asset = task.asset
    if asset.section != window.section or asset.line != window.line:
        return False
    return not (asset.km_to < window.km_from or asset.km_from > window.km_to)


def optimize_blocks(
    db: Session,
    replace_planned: bool = True,
    time_limit_seconds: int | None = None,
) -> dict:
    score_tasks(db)
    tasks = (
        db.query(MaintenanceTask)
        .options(joinedload(MaintenanceTask.asset))
        .filter(MaintenanceTask.status == "pending")
        .all()
    )
    windows = (
        db.query(CorridorWindow)
        .filter(CorridorWindow.status == "open")
        .order_by(CorridorWindow.window_start)
        .all()
    )

    if replace_planned:
        planned = db.query(Block).filter(Block.status == "planned").all()
        for block in planned:
            for assignment in block.block_tasks:
                assignment.task.status = "pending"
            db.delete(block)
        db.flush()

    feasible: list[tuple[MaintenanceTask, CorridorWindow]] = []
    for task in tasks:
        for window in windows:
            if task.estimated_duration_min > window.max_duration_min:
                continue
            if not _compatible(task.required_block_type, window.traffic_type):
                continue
            if not _overlaps_section(task, window):
                continue
            feasible.append((task, window))

    run_id = uuid4().hex[:16]
    if not feasible:
        db.commit()
        return {"run_id": run_id, "blocks_created": 0, "tasks_scheduled": 0}

    problem = pulp.LpProblem("ir_block_pack", pulp.LpMaximize)
    assign = {
        (task.id, window.id): pulp.LpVariable(f"x_{task.id}_{window.id}", cat="Binary")
        for task, window in feasible
    }

    problem += pulp.lpSum(
        assign[task.id, window.id] * (task.priority_score + 1.0)
        for task, window in feasible
    )

    for task in tasks:
        vars_for_task = [assign[task.id, w.id] for t, w in feasible if t.id == task.id]
        if vars_for_task:
            problem += pulp.lpSum(vars_for_task) <= 1

    for window in windows:
        vars_for_window = [assign[t.id, window.id] for t, w in feasible if w.id == window.id]
        if vars_for_window:
            problem += (
                pulp.lpSum(
                    assign[t.id, window.id] * t.estimated_duration_min
                    for t, w in feasible
                    if w.id == window.id
                )
                <= window.max_duration_min
            )

    solver = pulp.PULP_CBC_CMD(
        msg=False,
        timeLimit=time_limit_seconds or settings.optimizer_time_limit_seconds,
    )
    problem.solve(solver)

    selected: dict[int, list[MaintenanceTask]] = {}
    for task, window in feasible:
        if pulp.value(assign[task.id, window.id]) >= 0.5:
            selected.setdefault(window.id, []).append(task)

    blocks_created = 0
    tasks_scheduled = 0
    window_by_id = {w.id: w for w in windows}

    for window_id, packed in selected.items():
        packed.sort(key=lambda t: t.priority_score, reverse=True)
        window = window_by_id[window_id]
        cursor = window.window_start
        duration = sum(t.estimated_duration_min for t in packed)
        block = Block(
            corridor_window_id=window.id,
            block_code=f"BLK-{window.section[:8]}-{run_id[-6:]}-{window.id}",
            block_type=window.traffic_type,
            planned_start=window.window_start,
            planned_end=window.window_start + timedelta(minutes=duration),
            duration_min=duration,
            total_priority=round(sum(t.priority_score for t in packed), 2),
            status="planned",
            optimizer_run_id=run_id,
        )
        db.add(block)
        db.flush()
        for seq, task in enumerate(packed, start=1):
            db.add(
                BlockTask(
                    block_id=block.id,
                    task_id=task.id,
                    sequence=seq,
                    allocated_minutes=task.estimated_duration_min,
                )
            )
            task.status = "scheduled"
            cursor += timedelta(minutes=task.estimated_duration_min)
            tasks_scheduled += 1
        blocks_created += 1

    db.commit()
    return {
        "run_id": run_id,
        "solver_status": pulp.LpStatus[problem.status],
        "blocks_created": blocks_created,
        "tasks_scheduled": tasks_scheduled,
        "pending_unscheduled": len(tasks) - tasks_scheduled,
    }
