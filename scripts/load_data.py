"""
Script to load raw CSV files into PostgreSQL database using Pandas and SQLAlchemy.

Requirements:
- Load all 6 CSV files from data/raw/
- Use pandas read_csv + to_sql with SQLAlchemy engine
- Handle foreign key constraints (load in correct order)
- Print row counts after loading
- Add error handling
"""

import sys
import argparse
import logging
import os
from pathlib import Path
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("load_data")

# Order of tables to load respecting Foreign Key constraints:
# 1. assets (No FK)
# 2. defects (FK -> assets)
# 3. maintenance_tasks (FK -> assets, defects)
# 4. corridor_windows (No FK)
# 5. blocks (No FK)
# 6. block_tasks (FK -> blocks, maintenance_tasks)
TABLE_LOAD_ORDER = [
    ("assets", "assets.csv", "asset_id"),
    ("defects", "defects.csv", "defect_id"),
    ("maintenance_tasks", "maintenance_tasks.csv", "task_id"),
    ("corridor_windows", "corridor_windows.csv", "window_id"),
    ("blocks", "blocks.csv", "block_id"),
    ("block_tasks", "block_tasks.csv", "id"),
]


def clean_dataframe(table_name: str, df: pd.DataFrame) -> pd.DataFrame:
    """Perform table-specific data cleaning and formatting before SQL insertion."""
    df = df.copy()

    if table_name == "maintenance_tasks":
        # Convert empty strings / NaNs in linked_defect_id to nullable Int64
        if "linked_defect_id" in df.columns:
            df["linked_defect_id"] = pd.to_numeric(df["linked_defect_id"], errors="coerce").astype("Int64")

    return df


def truncate_tables(engine) -> None:
    """Truncate existing tables in reverse FK order to prepare for clean load."""
    reverse_tables = [t[0] for t in reversed(TABLE_LOAD_ORDER)]
    truncate_sql = f"TRUNCATE TABLE {', '.join(reverse_tables)} CASCADE;"
    logger.info(f"Truncating existing tables: {', '.join(reverse_tables)}...")
    with engine.begin() as conn:
        conn.execute(text(truncate_sql))
    logger.info("Tables truncated successfully.")


def reset_identity_sequences(engine) -> None:
    """Reset PostgreSQL identity/serial sequences after inserting explicit primary keys."""
    logger.info("Resetting PostgreSQL identity sequences...")
    with engine.begin() as conn:
        for table_name, _, pk_column in TABLE_LOAD_ORDER:
            query = text(
                f"SELECT setval(pg_get_serial_sequence('{table_name}', '{pk_column}'), "
                f"COALESCE((SELECT MAX({pk_column}) FROM {table_name}), 1));"
            )
            try:
                val = conn.execute(query).scalar()
                logger.info(f"Sequence reset for {table_name}.{pk_column} -> {val}")
            except Exception as e:
                logger.warning(f"Could not reset sequence for {table_name}.{pk_column}: {e}")


def load_csv_data(data_dir: Path, db_url: str = "", truncate: bool = True) -> dict[str, int]:
    """Load all 6 CSV files into PostgreSQL using pandas to_sql and SQLAlchemy engine."""
    load_dotenv()
    if not db_url:
        db_url = os.getenv("DATABASE_URL", "postgresql+psycopg2://ir_block:ir_block@localhost:5432/block_planning")

    logger.info("Connecting to database...")
    engine = create_engine(db_url)

    # Test database connection
    try:
        with engine.connect() as conn:
            db_version = conn.execute(text("SELECT version()")).scalar()
            logger.info(f"Connected successfully to DB: {db_version.split(',')[0]}")
    except SQLAlchemyError as err:
        logger.error(f"Database connection failed: {err}")
        raise

    if truncate:
        truncate_tables(engine)

    row_counts: dict[str, int] = {}

    for table_name, csv_filename, _ in TABLE_LOAD_ORDER:
        csv_path = data_dir / csv_filename
        if not csv_path.exists():
            raise FileNotFoundError(f"Required CSV file not found: {csv_path}")

        logger.info(f"Reading {csv_path}...")
        df = pd.read_csv(csv_path)
        raw_rows = len(df)

        df_cleaned = clean_dataframe(table_name, df)

        logger.info(f"Loading {raw_rows} rows into table '{table_name}' via pandas to_sql...")
        try:
            df_cleaned.to_sql(
                name=table_name,
                con=engine,
                if_exists="append",
                index=False,
                method="multi",
                chunksize=1000
            )
            row_counts[table_name] = len(df_cleaned)
            logger.info(f"Successfully loaded {len(df_cleaned)} rows into '{table_name}'.")
        except SQLAlchemyError as err:
            logger.error(f"Failed to load table '{table_name}' from {csv_filename}: {err}")
            raise

    reset_identity_sequences(engine)
    return row_counts


def main():
    parser = argparse.ArgumentParser(description="Load CSV files into PostgreSQL using pandas and SQLAlchemy.")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "raw",
        help="Path to directory containing CSV files (default: data/raw)",
    )
    parser.add_argument(
        "--db-url",
        type=str,
        default="",
        help="SQLAlchemy database connection URL (defaults to DATABASE_URL env var)",
    )
    parser.add_argument(
        "--no-truncate",
        action="store_true",
        help="Do not truncate existing tables before loading data",
    )

    args = parser.parse_args()

    try:
        counts = load_csv_data(
            data_dir=args.data_dir,
            db_url=args.db_url,
            truncate=not args.no_truncate
        )

        logger.info("=" * 55)
        logger.info("SUMMARY OF LOADED DATA:")
        logger.info("=" * 55)
        total_rows = 0
        for table, count in counts.items():
            logger.info(f" Table: {table:<22} | Row Count: {count:>5}")
            total_rows += count
        logger.info("-" * 55)
        logger.info(f" Total Loaded Rows across all tables: {total_rows:>5}")
        logger.info("=" * 55)

    except Exception as e:
        logger.error(f"Data loading failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
