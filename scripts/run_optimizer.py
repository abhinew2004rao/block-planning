"""CLI script to run heuristic BlockOptimizer on database tasks and save planned blocks to PostgreSQL."""

import argparse
import sys
from datetime import date, datetime
from pathlib import Path

# Add project root directory to sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pandas as pd
from sqlalchemy.orm import joinedload

from app.database import SessionLocal
from app.models import Asset, Block, BlockTask, CorridorWindow, MaintenanceTask
from app.services.ml_scoring import score_tasks
from app.services.optimizer import BlockOptimizer


def run_optimizer(replace_planned: bool = True) -> dict:
    """Load tasks and windows from database, execute BlockOptimizer, save results to DB, and print summary."""
    print("=== Running Block Optimization Service ===")

    db = SessionLocal()
    try:
        # Step 1: Ensure tasks are scored
        print("Ensuring tasks are ML-scored...")
        score_tasks(db)

        # Step 2: Query tasks, windows, assets
        tasks = (
            db.query(MaintenanceTask)
            .options(joinedload(MaintenanceTask.asset))
            .filter(MaintenanceTask.status.in_(["pending", "scored"]))
            .all()
        )

        windows = (
            db.query(CorridorWindow)
            .order_by(CorridorWindow.valid_date, CorridorWindow.start_time)
            .all()
        )

        assets = db.query(Asset).all()

        print(f"Loaded {len(tasks)} unscheduled task(s), {len(windows)} corridor window(s), and {len(assets)} asset(s).")

        if not tasks or not windows:
            print("Insufficient tasks or corridor windows to run optimization.")
            return {"blocks_created": 0, "tasks_scheduled": 0}

        # Step 3: Replace existing planned blocks if requested
        if replace_planned:
            planned_blocks = db.query(Block).filter(Block.status == "planned").all()
            if planned_blocks:
                print(f"Replacing {len(planned_blocks)} previously planned block(s)...")
                for b in planned_blocks:
                    # Reset associated tasks status back to scored/pending
                    for assignment in b.block_tasks:
                        if assignment.task:
                            assignment.task.status = "scored"
                    db.delete(b)
                db.flush()

        # Step 4: Convert DB models to DataFrames
        task_dicts = []
        for t in tasks:
            td = {
                "task_id": t.task_id,
                "asset_id": t.asset_id,
                "department": t.department,
                "task_type": t.task_type,
                "priority_score": t.priority_score,
                "failure_prob_7d": t.failure_prob_7d,
                "urgency_score": t.urgency_score,
                "estimated_duration_min": t.estimated_duration_min,
                "earliest_start_date": t.earliest_start_date,
                "latest_end_date": t.latest_end_date,
                "preferred_shift": t.preferred_shift,
                "status": t.status,
            }
            if t.asset:
                td["section_code"] = t.asset.section_code
                td["km_start"] = float(t.asset.km_start)
                td["km_end"] = float(t.asset.km_end)
            task_dicts.append(td)

        window_dicts = []
        for w in windows:
            wd = {
                "window_id": w.window_id,
                "corridor_id": w.corridor_id,
                "section_code": w.section_code,
                "km_start": float(w.km_start),
                "km_end": float(w.km_end),
                "valid_date": w.valid_date,
                "start_time": w.start_time,
                "end_time": w.end_time,
                "block_type_allowed": w.block_type_allowed,
                "max_duration_min": w.max_duration_min,
                "train_impact_score": float(w.train_impact_score) if w.train_impact_score else 0.0,
            }
            window_dicts.append(wd)

        asset_dicts = []
        for a in assets:
            asset_dicts.append(
                {
                    "asset_id": a.asset_id,
                    "section_code": a.section_code,
                    "km_start": float(a.km_start),
                    "km_end": float(a.km_end),
                }
            )

        # Step 5: Run BlockOptimizer
        optimizer = BlockOptimizer(
            tasks_df=pd.DataFrame(task_dicts),
            windows_df=pd.DataFrame(window_dicts),
            assets_df=pd.DataFrame(asset_dicts),
        )

        blocks, block_tasks = optimizer.optimize()

        # Step 6: Save blocks and block_tasks to database & update task status to 'scheduled'
        task_map = {t.task_id: t for t in tasks}

        for b_dict in blocks:
            b_date = b_dict["block_date"]
            if not isinstance(b_date, date):
                b_date = date.fromisoformat(str(b_date)[:10])

            s_time = b_dict["start_time"]
            if isinstance(s_time, str):
                s_time = datetime.strptime(s_time, "%H:%M:%S" if len(s_time) == 8 else "%H:%M").time()

            e_time = b_dict["end_time"]
            if isinstance(e_time, str):
                e_time = datetime.strptime(e_time, "%H:%M:%S" if len(e_time) == 8 else "%H:%M").time()

            block = Block(
                corridor_id=b_dict["corridor_id"],
                section_code=b_dict["section_code"],
                km_start=b_dict["km_start"],
                km_end=b_dict["km_end"],
                block_date=b_date,
                start_time=s_time,
                end_time=e_time,
                duration_min=b_dict["duration_min"],
                block_type=b_dict["block_type"],
                departments_involved=b_dict["departments_involved"],
                status="planned",
                planned_tasks_count=b_dict["planned_tasks_count"],
                estimated_train_impact=b_dict["estimated_train_impact"],
                created_by=b_dict["created_by"],
            )
            db.add(block)
            db.flush()  # assign block.block_id

            for bt_dict in [bt for bt in block_tasks if bt["block_id"] == b_dict["block_id"]]:
                bt = BlockTask(
                    block_id=block.block_id,
                    task_id=bt_dict["task_id"],
                    department=bt_dict["department"],
                    planned_duration_min=bt_dict["planned_duration_min"],
                    sequence_order=bt_dict["sequence_order"],
                )
                db.add(bt)

                # Update task status to 'scheduled'
                if bt_dict["task_id"] in task_map:
                    task_map[bt_dict["task_id"]].status = "scheduled"

        db.commit()

        # Step 7: Print Summary Report
        blocks_created = len(blocks)
        tasks_scheduled = len(optimizer.assigned_task_ids)

        print("\n--- Block Optimization Summary ---")
        print(f"Blocks Created   : {blocks_created}")
        print(f"Tasks Scheduled  : {tasks_scheduled}")
        print(f"Pending Unscheduled: {len(tasks) - tasks_scheduled}")

        if blocks:
            multi_dept_count = sum(1 for b in blocks if len(b["departments_involved"]) > 1)
            print(f"Multi-Department Blocks: {multi_dept_count}")

        return {
            "blocks_created": blocks_created,
            "tasks_scheduled": tasks_scheduled,
        }
    except Exception as err:
        db.rollback()
        print(f"Error during block optimization: {err}", file=sys.stderr)
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run heuristic BlockOptimizer service on database tasks.")
    parser.add_argument(
        "--keep-planned",
        action="store_true",
        help="Do not replace existing planned blocks (default replaces existing planned blocks)",
    )

    args = parser.parse_args()

    run_optimizer(replace_planned=not args.keep_planned)


if __name__ == "__main__":
    main()
