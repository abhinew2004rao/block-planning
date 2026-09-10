"""CLI script to run optimization and export blocks, block_tasks, and task_schedule CSVs to data/output/."""

import argparse
import sys
from pathlib import Path

# Add project root directory to sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal
from app.services.csv_export import export_all_to_csv
from app.services.optimizer import optimize_blocks


def export_data(run_opt: bool = True, output_dir: str | Path = "data/output") -> dict[str, str]:
    """Run optimization if requested, then export all CSVs to output_dir."""
    print("=== Running CSV Export Service ===")

    db = SessionLocal()
    try:
        if run_opt:
            print("Running block optimization before export...")
            res = optimize_blocks(db, replace_planned=True)
            print(f"Optimization completed: {res['blocks_created']} blocks created, {res['tasks_scheduled']} tasks scheduled.")

        out_dir = Path(output_dir)
        print(f"Exporting CSV files to '{out_dir}'...")

        file_paths = export_all_to_csv(db, output_dir=out_dir)

        print("\n--- Exported Files Summary ---")
        for key, path_str in file_paths.items():
            path = Path(path_str)
            if path.exists():
                lines_count = len(path.read_text(encoding="utf-8").strip().splitlines()) - 1
                print(f"- {key:15s}: {path_str} ({max(0, lines_count)} rows)")

        return file_paths
    except Exception as err:
        db.rollback()
        print(f"Error during CSV export: {err}", file=sys.stderr)
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Export scheduled blocks, block_tasks, and task_schedule to CSV files.")
    parser.add_argument(
        "--skip-optimize",
        action="store_true",
        help="Skip optimization step and export currently planned database records",
    )
    parser.add_argument(
        "--out-dir",
        type=str,
        default="data/output",
        help="Directory to save exported CSV files. Default: 'data/output'",
    )

    args = parser.parse_args()

    export_data(
        run_opt=not args.skip_optimize,
        output_dir=args.out_dir,
    )


if __name__ == "__main__":
    main()
