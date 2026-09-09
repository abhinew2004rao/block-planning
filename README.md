# Indian Railways — AI Block Planning

Decision-support system for planning **traffic blocks** (maintenance possessions) on Indian Railways corridors. Defects and assets are scored for priority, then packed into corridor possession windows.

## Stack

- FastAPI
- PostgreSQL + SQLAlchemy
- scikit-learn priority scoring
- PuLP mixed-integer packing for block schedules
- CSV export of approved blocks and task assignments

## Quick start

```bash
docker compose up -d
python -m venv .venv
.venv\Scripts\activate        # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env        # Linux/macOS: cp .env.example .env
alembic upgrade head
python scripts/generate_data.py
uvicorn app.main:app --reload
```

API docs: http://127.0.0.1:8000/docs

Run the optimizer:

```bash
python scripts/run_optimizer.py
```

Export CSVs:

```bash
curl -o exports/blocks.csv http://127.0.0.1:8000/api/v1/export/blocks.csv
```

## Domain tables

| Table | Role |
|---|---|
| `assets` | Track, OHE, signalling, P&C, bridges on a section |
| `defects` | Reported failures / irregularities against assets |
| `maintenance_tasks` | Work items needing a possession |
| `corridor_windows` | Permitted block slots on a corridor |
| `blocks` | Planned possessions produced by the optimizer |
| `block_tasks` | Tasks packed into each block |

## Layout

```
app/           API, models, scoring, optimizer
alembic/       migrations
scripts/       synthetic data + optimizer CLI
tests/         unit tests
```
