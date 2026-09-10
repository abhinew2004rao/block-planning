"""CLI script to run ML scoring on all maintenance tasks in database."""

import argparse
import sys
from datetime import date, datetime
from pathlib import Path

# Add project root directory to sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.score_backlog_tasks import score_backlog_tasks


def main() -> None:
    parser = argparse.ArgumentParser(description="Run ML scoring service on maintenance tasks.")
    parser.add_argument(
        "--status",
        type=str,
        default="all",
        help="Filter tasks by status (e.g., 'pending', 'scored', 'all'). Default: 'all'",
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
