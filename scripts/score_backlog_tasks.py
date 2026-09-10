"""CLI script to run ML scoring on backlog maintenance tasks in database."""

import argparse
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

# Add project root directory to sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy.orm import joinedload

from app.database import SessionLocal
from app.models import MaintenanceTask
from app.services.ml_scoring import (
    calculate_failure_prob_7d,
    calculate_priority_score,
    calculate_urgency_score,
)


def score_backlog_tasks(
    status_filter: str | None = None,
    ref_date: date | None = None,
    update_status: bool = False,
) -> int:
    """Query backlog tasks from DB, calculate ML scores, update records, and print summary statistics."""
    ref = ref_date or date.today()
    print(f"=== Running ML Scoring Service (Reference Date: {ref.isoformat()}) ===")

    db = SessionLocal()
    try:
        query = db.query(MaintenanceTask).options(
            joinedload(MaintenanceTask.asset),
            joinedload(MaintenanceTask.linked_defect),
        )

        if status_filter and status_filter.lower() != "all":
            statuses = [s.strip() for s in status_filter.split(",")]
            query = query.filter(MaintenanceTask.status.in_(statuses))
        else:
            # Default backlog tasks: pending, scored, or scheduled tasks
            query = query.filter(MaintenanceTask.status.in_(["pending", "scored"]))

        tasks = query.all()
        total_tasks = len(tasks)
        print(f"Found {total_tasks} backlog task(s) matching criteria.")

        if total_tasks == 0:
            print("No tasks to score.")
            return 0

        priorities = []
        fail_probs = []
        urgencies = []

        for task in tasks:
            asset = task.asset
            defect = task.linked_defect

            defect_severity = defect.defect_severity if defect else None
            traffic_density = asset.traffic_density_class if asset else None
            asset_type = asset.asset_type if asset else None

            # Calculate days overdue
            days_overdue = 0
            if task.latest_end_date and ref > task.latest_end_date:
                days_overdue = (ref - task.latest_end_date).days
            elif defect and defect.detected_date and defect.max_allowed_delay_days:
                due_date = defect.detected_date + timedelta(days=defect.max_allowed_delay_days)
                if ref > due_date:
                    days_overdue = (ref - due_date).days

            # Calculate task age
            task_age_days = 0
            if defect and defect.detected_date:
                task_age_days = max(0, (ref - defect.detected_date).days)
            elif task.earliest_start_date:
                task_age_days = max(0, (ref - task.earliest_start_date).days)

            # Calculate scores
            p_score = calculate_priority_score(
                defect_severity=defect_severity,
                traffic_density=traffic_density,
                asset_type=asset_type,
                days_overdue=days_overdue,
            )

            f_prob_7d = calculate_failure_prob_7d(
                defect_severity=defect_severity,
                task_age_days=task_age_days,
                asset_type=asset_type,
            )

            # failure_prob_30d must satisfy DB constraint failure_prob_30d >= failure_prob_7d
            f_prob_30d = float(min(1.0, max(f_prob_7d, round(f_prob_7d * 1.35 + 0.05, 4))))

            u_score = calculate_urgency_score(
                priority_score=p_score,
                failure_prob_7d=f_prob_7d,
                days_overdue=days_overdue,
            )

            # Update database model fields
            task.priority_score = p_score
            task.failure_prob_7d = f_prob_7d
            task.failure_prob_30d = f_prob_30d
            task.urgency_score = u_score

            if update_status and task.status == "pending":
                task.status = "scored"

            priorities.append(p_score)
            fail_probs.append(f_prob_7d)
            urgencies.append(u_score)

        db.commit()
        print(f"Successfully scored and updated {total_tasks} task(s) in the database.")

        if priorities:
            avg_p = sum(priorities) / len(priorities)
            avg_f = sum(fail_probs) / len(fail_probs)
            avg_u = sum(urgencies) / len(urgencies)
            print("\n--- Summary Statistics ---")
            print(f"Priority Score  : Min={min(priorities):.2f}, Max={max(priorities):.2f}, Avg={avg_p:.2f}")
            print(f"Failure Prob 7D : Min={min(fail_probs):.4f}, Max={max(fail_probs):.4f}, Avg={avg_f:.4f}")
            print(f"Urgency Score   : Min={min(urgencies):.2f}, Max={max(urgencies):.2f}, Avg={avg_u:.2f}")

        return total_tasks
    except Exception as err:
        db.rollback()
        print(f"Error during ML scoring: {err}", file=sys.stderr)
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run ML scoring service on maintenance backlog tasks.")
    parser.add_argument(
        "--status",
        type=str,
        default="pending,scored",
        help="Comma-separated status values to filter tasks (or 'all'). Default: 'pending,scored'",
    )
    parser.add_argument(
        "--ref-date",
        type=str,
        default=None,
        help="Reference date for scoring calculation in YYYY-MM-DD format. Default: today",
    )
    parser.add_argument(
        "--update-status",
        action="store_true",
        help="Update task status from 'pending' to 'scored' after scoring",
    )

    args = parser.parse_args()

    parsed_date = None
    if args.ref_date:
        try:
            parsed_date = datetime.strptime(args.ref_date, "%Y-%m-%d").date()
        except ValueError:
            print("Invalid date format for --ref-date. Expected YYYY-MM-DD.", file=sys.stderr)
            sys.exit(1)

    score_backlog_tasks(
        status_filter=args.status,
        ref_date=parsed_date,
        update_status=args.update_status,
    )


if __name__ == "__main__":
    main()
