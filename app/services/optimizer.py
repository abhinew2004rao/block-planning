"""Block optimization service using a heuristic greedy approach."""

from datetime import date, datetime, time, timedelta
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session, joinedload

from app.models import Block, BlockTask, CorridorWindow, MaintenanceTask
from app.services.ml_scoring import score_tasks


def _parse_date(val: Any) -> date | None:
    if val is None or pd.isna(val):
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    try:
        return datetime.strptime(str(val)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def _is_night_window(start_time_val: Any) -> bool:
    if start_time_val is None or pd.isna(start_time_val):
        return True  # Default to night
    if isinstance(start_time_val, time):
        hour = start_time_val.hour
    else:
        str_val = str(start_time_val).strip()
        try:
            hour = int(str_val.split(":")[0])
        except Exception:
            hour = 22
    return hour >= 20 or hour < 6


def _km_overlaps(
    a_start: float | None,
    a_end: float | None,
    b_start: float | None,
    b_end: float | None,
) -> bool:
    if a_start is None or a_end is None or b_start is None or b_end is None:
        return True
    return not (float(a_end) < float(b_start) or float(a_start) > float(b_end))


class BlockOptimizer:
    """Heuristic optimizer for packing maintenance tasks into corridor windows."""

    def __init__(
        self,
        tasks_df: pd.DataFrame,
        windows_df: pd.DataFrame,
        assets_df: pd.DataFrame | None = None,
    ) -> None:
        self.tasks_df = tasks_df.copy()
        self.windows_df = windows_df.copy()

        # Merge asset spatial location info if needed
        if assets_df is not None and len(assets_df) > 0:
            asset_cols = [c for c in ["asset_id", "section_code", "km_start", "km_end"] if c in assets_df.columns]
            if "section_code" not in self.tasks_df.columns and "asset_id" in self.tasks_df.columns:
                self.tasks_df = self.tasks_df.merge(
                    assets_df[asset_cols],
                    on="asset_id",
                    how="left",
                    suffixes=("", "_asset"),
                )

        # Preprocess and normalize data
        self._preprocess_data()
        self.assigned_task_ids: set[int] = set()

    def _preprocess_data(self) -> None:
        # Normalize date columns in tasks_df
        if "earliest_start_date" in self.tasks_df.columns:
            self.tasks_df["earliest_start_date_parsed"] = self.tasks_df["earliest_start_date"].apply(_parse_date)
        else:
            self.tasks_df["earliest_start_date_parsed"] = date.today()

        if "latest_end_date" in self.tasks_df.columns:
            self.tasks_df["latest_end_date_parsed"] = self.tasks_df["latest_end_date"].apply(_parse_date)
        else:
            self.tasks_df["latest_end_date_parsed"] = date.today() + timedelta(days=30)

        # Ensure numeric columns
        for col in ["urgency_score", "priority_score", "estimated_duration_min", "km_start", "km_end"]:
            if col in self.tasks_df.columns:
                self.tasks_df[col] = pd.to_numeric(self.tasks_df[col], errors="coerce").fillna(0.0)

        # Normalize date columns in windows_df
        if "valid_date" in self.windows_df.columns:
            self.windows_df["valid_date_parsed"] = self.windows_df["valid_date"].apply(_parse_date)
        else:
            self.windows_df["valid_date_parsed"] = date.today()

        if "max_duration_min" in self.windows_df.columns:
            self.windows_df["max_duration_min"] = pd.to_numeric(
                self.windows_df["max_duration_min"], errors="coerce"
            ).fillna(0.0)

        # Sort windows by date and start_time chronologically
        sort_cols = [c for c in ["valid_date_parsed", "start_time"] if c in self.windows_df.columns]
        if sort_cols:
            self.windows_df = self.windows_df.sort_values(by=sort_cols).reset_index(drop=True)

    def _get_candidate_tasks(self, window: pd.Series | dict) -> pd.DataFrame:
        """Filter unassigned tasks for a window based on section, km overlap, dates, shift preference, and duration."""
        if self.tasks_df.empty:
            return pd.DataFrame()

        win_dict = window.to_dict() if isinstance(window, pd.Series) else window
        win_date = win_dict.get("valid_date_parsed") or _parse_date(win_dict.get("valid_date")) or date.today()
        win_section = win_dict.get("section_code")
        win_km_start = win_dict.get("km_start")
        win_km_end = win_dict.get("km_end")
        win_max_duration = float(win_dict.get("max_duration_min", 0.0))
        is_night = _is_night_window(win_dict.get("start_time"))

        candidates = []
        for idx, task in self.tasks_df.iterrows():
            t_id = int(task.get("task_id", idx))
            if t_id in self.assigned_task_ids:
                continue

            status = str(task.get("status", "pending")).lower()
            if status in ["completed", "scheduled", "cancelled"]:
                continue

            dur = float(task.get("estimated_duration_min", 0.0))
            if dur > win_max_duration or dur <= 0:
                continue

            # Section matching
            t_section = task.get("section_code")
            if win_section and t_section and str(t_section).strip() != str(win_section).strip():
                continue

            # KM spatial overlap
            t_km_start = task.get("km_start")
            t_km_end = task.get("km_end")
            if not _km_overlaps(t_km_start, t_km_end, win_km_start, win_km_end):
                continue

            # Temporal / Deadline window check
            earliest = task.get("earliest_start_date_parsed") or date.today()
            latest = task.get("latest_end_date_parsed") or (date.today() + timedelta(days=365))
            if not (earliest <= win_date <= latest):
                continue

            # Shift preference check
            pref_shift = str(task.get("preferred_shift", "any")).strip().lower()
            if pref_shift == "night" and not is_night:
                continue
            if pref_shift == "day" and is_night:
                continue

            candidates.append(task)

        if not candidates:
            return pd.DataFrame()

        cand_df = pd.DataFrame(candidates)
        # Sort candidates by urgency_score (descending), tiebreaker priority_score (descending)
        sort_cols = [c for c in ["urgency_score", "priority_score"] if c in cand_df.columns]
        if sort_cols:
            cand_df = cand_df.sort_values(by=sort_cols, ascending=False).reset_index(drop=True)

        return cand_df

    def _select_tasks_for_window(
        self,
        candidate_tasks: pd.DataFrame,
        window: pd.Series | dict,
    ) -> list[dict]:
        """Greedily select tasks fitting within window duration capacity."""
        if candidate_tasks.empty:
            return []

        win_dict = window.to_dict() if isinstance(window, pd.Series) else window
        max_duration = float(win_dict.get("max_duration_min", 0.0))

        selected: list[dict] = []
        used_duration = 0.0

        for _, task in candidate_tasks.iterrows():
            dur = float(task.get("estimated_duration_min", 0.0))
            if used_duration + dur <= max_duration:
                selected.append(task.to_dict())
                used_duration += dur

        return selected

    def _create_block(
        self,
        window: pd.Series | dict,
        selected_tasks: list[dict],
        block_id: int,
    ) -> dict:
        """Construct block dictionary representation."""
        win_dict = window.to_dict() if isinstance(window, pd.Series) else window
        total_duration = sum(int(t.get("estimated_duration_min", 0)) for t in selected_tasks)

        depts = sorted({str(t.get("department")) for t in selected_tasks if t.get("department")})
        allowed = str(win_dict.get("block_type_allowed", "absolute")).lower()
        block_type = "absolute" if allowed in ["absolute", "any", ""] else allowed

        km_starts = [float(t.get("km_start")) for t in selected_tasks if t.get("km_start") is not None]
        km_ends = [float(t.get("km_end")) for t in selected_tasks if t.get("km_end") is not None]

        b_km_start = min(km_starts) if km_starts else win_dict.get("km_start", 0.0)
        b_km_end = max(km_ends) if km_ends else win_dict.get("km_end", 0.0)

        valid_d = win_dict.get("valid_date")
        if isinstance(valid_d, date):
            valid_d_str = valid_d.isoformat()
        else:
            valid_d_str = str(valid_d)[:10] if valid_d else date.today().isoformat()

        return {
            "block_id": block_id,
            "corridor_id": win_dict.get("corridor_id", "CORRIDOR-01"),
            "section_code": win_dict.get("section_code", "SEC-01"),
            "km_start": f"{float(b_km_start):.3f}" if b_km_start is not None else "0.000",
            "km_end": f"{float(b_km_end):.3f}" if b_km_end is not None else "0.000",
            "block_date": valid_d_str,
            "start_time": str(win_dict.get("start_time", "22:00:00")),
            "end_time": str(win_dict.get("end_time", "04:00:00")),
            "duration_min": total_duration,
            "block_type": block_type,
            "departments_involved": depts,
            "status": "planned",
            "planned_tasks_count": len(selected_tasks),
            "estimated_train_impact": float(win_dict.get("train_impact_score", 0.0)),
            "created_by": "heuristic-optimizer",
        }

    def _create_block_tasks(
        self,
        block_id: int,
        selected_tasks: list[dict],
        start_assignment_id: int = 1,
    ) -> list[dict]:
        """Construct block task assignment mapping dictionaries."""
        assignment_rows: list[dict] = []
        assignment_id = start_assignment_id

        for seq, task in enumerate(selected_tasks, start=1):
            assignment_rows.append(
                {
                    "id": assignment_id,
                    "block_id": block_id,
                    "task_id": int(task["task_id"]),
                    "department": str(task.get("department", "General")),
                    "planned_duration_min": int(task.get("estimated_duration_min", 0)),
                    "sequence_order": seq,
                }
            )
            assignment_id += 1

        return assignment_rows

    def optimize(self) -> tuple[list[dict], list[dict]]:
        """Run heuristic greedy block optimization and return (blocks, block_tasks)."""
        blocks: list[dict] = []
        block_tasks: list[dict] = []

        block_id = 1
        assignment_id = 1

        for _, window in self.windows_df.iterrows():
            candidates = self._get_candidate_tasks(window)
            if candidates.empty:
                continue

            selected = self._select_tasks_for_window(candidates, window)
            if not selected:
                continue

            block = self._create_block(window, selected, block_id)
            bts = self._create_block_tasks(block_id, selected, start_assignment_id=assignment_id)

            blocks.append(block)
            block_tasks.extend(bts)

            # Mark tasks as assigned
            for t in selected:
                self.assigned_task_ids.add(int(t["task_id"]))

            block_id += 1
            assignment_id += len(bts)

        return blocks, block_tasks


def optimize_blocks(
    db: Session,
    replace_planned: bool = True,
) -> dict:
    """Wrapper function to run heuristic block optimization using SQLAlchemy DB session."""
    score_tasks(db)

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

    if replace_planned:
        planned_blocks = db.query(Block).filter(Block.status == "planned").all()
        for b in planned_blocks:
            for assignment in b.block_tasks:
                if assignment.task:
                    assignment.task.status = "pending"
            db.delete(b)
        db.flush()

    if not tasks or not windows:
        db.commit()
        return {"blocks_created": 0, "tasks_scheduled": 0}

    # Convert SQLAlchemy objects to dict lists for DataFrame initialization
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

    optimizer = BlockOptimizer(
        tasks_df=pd.DataFrame(task_dicts),
        windows_df=pd.DataFrame(window_dicts),
    )

    blocks, block_tasks = optimizer.optimize()

    # Save created blocks and block tasks to DB
    task_map = {t.task_id: t for t in tasks}

    for b_dict in blocks:
        block = Block(
            corridor_id=b_dict["corridor_id"],
            section_code=b_dict["section_code"],
            km_start=b_dict["km_start"],
            km_end=b_dict["km_end"],
            block_date=b_dict["block_date"] if isinstance(b_dict["block_date"], date) else date.fromisoformat(b_dict["block_date"]),
            start_time=datetime.strptime(b_dict["start_time"], "%H:%M:%S").time() if isinstance(b_dict["start_time"], str) else b_dict["start_time"],
            end_time=datetime.strptime(b_dict["end_time"], "%H:%M:%S").time() if isinstance(b_dict["end_time"], str) else b_dict["end_time"],
            duration_min=b_dict["duration_min"],
            block_type=b_dict["block_type"],
            departments_involved=b_dict["departments_involved"],
            status="planned",
            planned_tasks_count=b_dict["planned_tasks_count"],
            estimated_train_impact=b_dict["estimated_train_impact"],
            created_by=b_dict["created_by"],
        )
        db.add(block)
        db.flush()

        for bt_dict in [bt for bt in block_tasks if bt["block_id"] == b_dict["block_id"]]:
            bt = BlockTask(
                block_id=block.block_id,
                task_id=bt_dict["task_id"],
                department=bt_dict["department"],
                planned_duration_min=bt_dict["planned_duration_min"],
                sequence_order=bt_dict["sequence_order"],
            )
            db.add(bt)
            if bt_dict["task_id"] in task_map:
                task_map[bt_dict["task_id"]].status = "scheduled"

    db.commit()

    return {
        "blocks_created": len(blocks),
        "tasks_scheduled": len(optimizer.assigned_task_ids),
    }
