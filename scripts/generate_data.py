"""Generate synthetic Indian Railways block-planning CSVs for all six tables."""

from __future__ import annotations

import argparse
import csv
import random
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "data" / "raw"

# North Central Railway — Prayagraj (PRYJ) division.
# PYRJ-MIU ≈ Prayagraj–Manikpur (branch). PYRJ-ALD ≈ city / Chheoki chord.
# ALD-MZP ≈ Allahabad–Mirzapur on the Howrah–Delhi main line.
SECTIONS: list[dict] = [
    {
        "section_code": "PYRJ-MIU",
        "corridor_id": "NCR-PRYJ-MKP",
        "km_start": 0.000,
        "km_end": 94.500,
        "line_category": "B",
        "traffic_density_class": "C",
        "freight_traffic_level": "medium",
    },
    {
        "section_code": "PYRJ-ALD",
        "corridor_id": "NCR-PRYJ-CITY",
        "km_start": 0.000,
        "km_end": 12.400,
        "line_category": "suburban",
        "traffic_density_class": "A",
        "freight_traffic_level": "low",
    },
    {
        "section_code": "ALD-MZP",
        "corridor_id": "NCR-PRYJ-MGS",
        "km_start": 627.000,
        "km_end": 709.250,
        "line_category": "A",
        "traffic_density_class": "A",
        "freight_traffic_level": "very_high",
    },
]

DIVISION = "PRYJ"

ASSET_CATALOG: dict[str, dict] = {
    "track": {
        "department": "P.Way",
        "sub_types": ["rail", "sleeper", "ballast", "P&C", "LWR", "SEJ", "bridge_approach"],
        "span_km": (0.200, 4.800),
        "defects": [
            ("rail_fracture", "critical", 180),
            ("weld_failure", "critical", 150),
            ("gauge_slack", "major", 90),
            ("scabbing", "major", 60),
            ("ballast_deficiency", "minor", 45),
            ("weed_growth", "observational", 30),
            ("sleeper_decay", "major", 75),
            ("P&C_wear", "minor", 50),
        ],
        "periodic": [
            ("USFD_testing", 120),
            ("tamping", 180),
            ("destressing", 240),
            ("packing_P&C", 90),
        ],
    },
    "signal": {
        "department": "S&T",
        "sub_types": ["MACLS", "axle_counter", "track_circuit", "IBS", "EI", "LC_gate"],
        "span_km": (0.001, 0.080),
        "defects": [
            ("signal_blank", "critical", 90),
            ("track_circuit_failure", "critical", 75),
            ("axle_counter_reset", "major", 60),
            ("cable_fault", "major", 120),
            ("aspect_dim", "minor", 40),
            ("LC_boom_sticking", "major", 50),
            ("EI_alarm", "observational", 30),
        ],
        "periodic": [
            ("signal_round_testing", 60),
            ("cable_meggering", 90),
            ("point_machine_overhaul", 120),
        ],
    },
    "traction": {
        "department": "TRD",
        "sub_types": ["OHE", "AT", "SSP", "mast", "isolator", "jumper"],
        "span_km": (0.050, 2.400),
        "defects": [
            ("OHE_snap", "critical", 210),
            ("contact_wire_wear", "major", 90),
            ("insulator_flashover", "major", 75),
            ("auto_tension_failure", "critical", 150),
            ("jumper_hotspot", "minor", 45),
            ("mast_foundation_tilt", "major", 180),
            ("dropper_missing", "observational", 30),
        ],
        "periodic": [
            ("OHE_patrolling", 90),
            ("contact_wire_measurement", 120),
            ("isolator_maintenance", 60),
        ],
    },
}

DETECTORS = [
    "SSE/P.Way/PRYJ",
    "JE/P.Way/MZP",
    "SSE/S&T/PRYJ",
    "JE/TRD/ALD",
    "USFD team/PRYJ",
    "TRC recording",
    "OMMS footplate",
]

CREATED_BY = "synthetic-generator"

ASSET_FIELDS = [
    "asset_id",
    "asset_type",
    "sub_type",
    "division_code",
    "section_code",
    "corridor_id",
    "km_start",
    "km_end",
    "line_category",
    "traffic_density_class",
    "created_at",
    "updated_at",
]
DEFECT_FIELDS = [
    "defect_id",
    "asset_id",
    "department",
    "defect_type",
    "defect_severity",
    "detected_date",
    "detected_by",
    "status",
    "recommended_action",
    "estimated_work_duration_min",
    "max_allowed_delay_days",
    "source_system",
    "source_defect_id",
    "created_at",
    "updated_at",
]
TASK_FIELDS = [
    "task_id",
    "asset_id",
    "department",
    "task_type",
    "linked_defect_id",
    "priority_score",
    "failure_prob_7d",
    "failure_prob_30d",
    "urgency_score",
    "estimated_duration_min",
    "earliest_start_date",
    "latest_end_date",
    "preferred_shift",
    "status",
    "source_system",
    "created_at",
    "updated_at",
]
WINDOW_FIELDS = [
    "window_id",
    "corridor_id",
    "section_code",
    "km_start",
    "km_end",
    "valid_date",
    "start_time",
    "end_time",
    "block_type_allowed",
    "max_duration_min",
    "train_impact_score",
    "freight_traffic_level",
    "source",
    "created_at",
    "updated_at",
]
BLOCK_FIELDS = [
    "block_id",
    "corridor_id",
    "section_code",
    "km_start",
    "km_end",
    "block_date",
    "start_time",
    "end_time",
    "duration_min",
    "block_type",
    "departments_involved",
    "status",
    "planned_tasks_count",
    "estimated_train_impact",
    "created_by",
    "created_at",
    "updated_at",
]
BLOCK_TASK_FIELDS = [
    "id",
    "block_id",
    "task_id",
    "department",
    "planned_duration_min",
    "sequence_order",
    "created_at",
]


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def _fmt_ts(ts: datetime) -> str:
    return ts.isoformat()


def _pg_text_array(values: list[str]) -> str:
    escaped = [v.replace('"', '\\"') for v in values]
    inner = ",".join(f'"{v}"' for v in escaped)
    return "{" + inner + "}"


def _km_on_section(rng: random.Random, section: dict, span: tuple[float, float]) -> tuple[float, float]:
    lo, hi = section["km_start"], section["km_end"]
    width = rng.uniform(*span)
    width = min(width, max(0.001, hi - lo))
    start = rng.uniform(lo, hi - width)
    end = start + width
    return round(start, 3), round(end, 3)


def generate_assets(rng: random.Random, ts: datetime) -> list[dict]:
    types = ["track"] * 40 + ["signal"] * 30 + ["traction"] * 30
    rng.shuffle(types)
    rows = []
    for i, asset_type in enumerate(types, start=1):
        section = SECTIONS[(i - 1) % len(SECTIONS)]
        catalog = ASSET_CATALOG[asset_type]
        km_start, km_end = _km_on_section(rng, section, catalog["span_km"])
        rows.append(
            {
                "asset_id": i,
                "asset_type": asset_type,
                "sub_type": rng.choice(catalog["sub_types"]),
                "division_code": DIVISION,
                "section_code": section["section_code"],
                "corridor_id": section["corridor_id"],
                "km_start": f"{km_start:.3f}",
                "km_end": f"{km_end:.3f}",
                "line_category": section["line_category"],
                "traffic_density_class": section["traffic_density_class"],
                "created_at": _fmt_ts(ts),
                "updated_at": _fmt_ts(ts),
            }
        )
    return rows


def generate_defects(rng: random.Random, assets: list[dict], ts: datetime) -> list[dict]:
    statuses = (
        ["open"] * 90
        + ["acknowledged"] * 50
        + ["in_progress"] * 30
        + ["deferred"] * 20
        + ["closed"] * 10
    )
    rng.shuffle(statuses)
    rows = []
    today = date.today()
    for i in range(1, 201):
        asset = assets[rng.randrange(len(assets))]
        catalog = ASSET_CATALOG[asset["asset_type"]]
        defect_type, severity, duration = rng.choice(catalog["defects"])
        delay = {"critical": 2, "major": 7, "minor": 21, "observational": 45}[severity]
        detected = today - timedelta(days=rng.randint(0, 40))
        rows.append(
            {
                "defect_id": i,
                "asset_id": int(asset["asset_id"]),
                "department": catalog["department"],
                "defect_type": defect_type,
                "defect_severity": severity,
                "detected_date": detected.isoformat(),
                "detected_by": rng.choice(DETECTORS),
                "status": statuses[i - 1],
                "recommended_action": (
                    f"Attend {defect_type.replace('_', ' ')} on {asset['section_code']} "
                    f"km {asset['km_start']}-{asset['km_end']}"
                ),
                "estimated_work_duration_min": max(15, duration + rng.choice([-15, 0, 15, 30])),
                "max_allowed_delay_days": delay + rng.randint(0, 3),
                "source_system": rng.choice(["TMS", "CRIS-CMS", "FOIS-OMMS", "USFD", "TRC"]),
                "source_defect_id": f"{asset['section_code']}-{i:04d}",
                "created_at": _fmt_ts(ts),
                "updated_at": _fmt_ts(ts),
            }
        )
    return rows


def _score_from_defect(severity: str, rng: random.Random) -> tuple[float, float, float, float]:
    base = {"critical": 88, "major": 70, "minor": 42, "observational": 22}[severity]
    priority = min(100.0, max(0.0, base + rng.uniform(-6, 6)))
    p7 = {"critical": 0.35, "major": 0.18, "minor": 0.06, "observational": 0.02}[severity]
    p7 = min(0.95, max(0.0, p7 + rng.uniform(-0.03, 0.04)))
    p30 = min(1.0, p7 + rng.uniform(0.05, 0.25))
    urgency = min(100.0, max(0.0, priority - rng.uniform(0, 8)))
    return round(priority, 2), round(p7, 4), round(p30, 4), round(urgency, 2)


def generate_tasks(rng: random.Random, assets: list[dict], defects: list[dict], ts: datetime) -> list[dict]:
    today = date.today()
    assets_by_id = {int(a["asset_id"]): a for a in assets}
    rows: list[dict] = []
    task_id = 1

    linked = defects[:]
    rng.shuffle(linked)
    linked = linked[:140]
    for defect in linked:
        asset = assets_by_id[int(defect["asset_id"])]
        priority, p7, p30, urgency = _score_from_defect(defect["defect_severity"], rng)
        delay_days = max(int(defect["max_allowed_delay_days"]), 7)
        rows.append(
            {
                "task_id": task_id,
                "asset_id": int(defect["asset_id"]),
                "department": defect["department"],
                "task_type": f"corrective_{defect['defect_type']}",
                "linked_defect_id": int(defect["defect_id"]),
                "priority_score": priority,
                "failure_prob_7d": p7,
                "failure_prob_30d": p30,
                "urgency_score": urgency,
                "estimated_duration_min": int(defect["estimated_work_duration_min"]),
                "earliest_start_date": today.isoformat(),
                "latest_end_date": (today + timedelta(days=delay_days)).isoformat(),
                "preferred_shift": rng.choices(["night", "any", "day"], weights=[0.7, 0.2, 0.1])[0],
                "status": "pending",
                "source_system": defect["source_system"],
                "created_at": _fmt_ts(ts),
                "updated_at": _fmt_ts(ts),
            }
        )
        task_id += 1

    while task_id <= 200:
        asset = assets[rng.randrange(len(assets))]
        catalog = ASSET_CATALOG[asset["asset_type"]]
        task_type, duration = rng.choice(catalog["periodic"])
        start = today + timedelta(days=rng.randint(-3, 5))
        latest = start + timedelta(days=rng.choice([7, 14, 21, 30]))
        p7 = rng.uniform(0.01, 0.08)
        p30 = min(1.0, p7 + rng.uniform(0.04, 0.15))
        rows.append(
            {
                "task_id": task_id,
                "asset_id": int(asset["asset_id"]),
                "department": catalog["department"],
                "task_type": f"periodic_{task_type}",
                "linked_defect_id": "",
                "priority_score": round(rng.uniform(18, 48), 2),
                "failure_prob_7d": round(p7, 4),
                "failure_prob_30d": round(p30, 4),
                "urgency_score": round(rng.uniform(15, 40), 2),
                "estimated_duration_min": duration,
                "earliest_start_date": start.isoformat(),
                "latest_end_date": latest.isoformat(),
                "preferred_shift": rng.choice(["night", "any"]),
                "status": "pending",
                "source_system": "IR-PMS",
                "created_at": _fmt_ts(ts),
                "updated_at": _fmt_ts(ts),
            }
        )
        task_id += 1

    return rows


def generate_windows(rng: random.Random, ts: datetime) -> list[dict]:
    """7 nights × 3 sections = 21, plus 9 extra late-night slots → 30."""
    today = date.today()
    primary = (datetime.strptime("22:30", "%H:%M").time(), datetime.strptime("04:30", "%H:%M").time(), 360)
    extra = (datetime.strptime("00:45", "%H:%M").time(), datetime.strptime("03:45", "%H:%M").time(), 180)
    rows = []
    window_id = 1
    for day_offset in range(7):
        valid = today + timedelta(days=day_offset)
        for section in SECTIONS:
            start, end, duration = primary
            impact = {"very_high": 78, "medium": 42, "low": 28}[section["freight_traffic_level"]]
            rows.append(
                {
                    "window_id": window_id,
                    "corridor_id": section["corridor_id"],
                    "section_code": section["section_code"],
                    "km_start": f"{section['km_start']:.3f}",
                    "km_end": f"{section['km_end']:.3f}",
                    "valid_date": valid.isoformat(),
                    "start_time": start.strftime("%H:%M:%S"),
                    "end_time": end.strftime("%H:%M:%S"),
                    "block_type_allowed": rng.choice(["absolute", "absolute", "caution", "power", "any"]),
                    "max_duration_min": duration,
                    "train_impact_score": f"{impact + rng.uniform(-8, 8):.2f}",
                    "freight_traffic_level": section["freight_traffic_level"],
                    "source": "WTT-NCR",
                    "created_at": _fmt_ts(ts),
                    "updated_at": _fmt_ts(ts),
                }
            )
            window_id += 1

    extra_pairs = [(d, s) for d in range(3) for s in SECTIONS]
    for day_offset, section in extra_pairs:
        valid = today + timedelta(days=day_offset)
        start, end, duration = extra
        rows.append(
            {
                "window_id": window_id,
                "corridor_id": section["corridor_id"],
                "section_code": section["section_code"],
                "km_start": f"{section['km_start']:.3f}",
                "km_end": f"{section['km_end']:.3f}",
                "valid_date": valid.isoformat(),
                "start_time": start.strftime("%H:%M:%S"),
                "end_time": end.strftime("%H:%M:%S"),
                "block_type_allowed": "absolute",
                "max_duration_min": duration,
                "train_impact_score": f"{35 + rng.uniform(0, 20):.2f}",
                "freight_traffic_level": section["freight_traffic_level"],
                "source": "WTT-NCR",
                "created_at": _fmt_ts(ts),
                "updated_at": _fmt_ts(ts),
            }
        )
        window_id += 1

    return rows


def _km_overlaps(a_start: float, a_end: float, b_start: float, b_end: float) -> bool:
    return not (a_end < b_start or a_start > b_end)


def generate_blocks_and_assignments(
    rng: random.Random,
    assets: list[dict],
    tasks: list[dict],
    windows: list[dict],
    ts: datetime,
) -> tuple[list[dict], list[dict]]:
    assets_by_id = {int(a["asset_id"]): a for a in assets}
    assigned: set[int] = set()
    block_rows: list[dict] = []
    assignment_rows: list[dict] = []
    assignment_id = 1
    block_id = 1

    for window in windows:
        candidates: list[dict] = []
        for task in tasks:
            if int(task["task_id"]) in assigned:
                continue
            asset = assets_by_id[int(task["asset_id"])]
            if asset["section_code"] != window["section_code"]:
                continue
            if not _km_overlaps(
                float(asset["km_start"]),
                float(asset["km_end"]),
                float(window["km_start"]),
                float(window["km_end"]),
            ):
                continue
            if int(task["estimated_duration_min"]) > int(window["max_duration_min"]):
                continue
            earliest = date.fromisoformat(task["earliest_start_date"])
            latest = date.fromisoformat(task["latest_end_date"])
            valid = date.fromisoformat(window["valid_date"])
            if not (earliest <= valid <= latest):
                continue
            candidates.append(task)

        if not candidates:
            continue

        candidates.sort(key=lambda t: float(t["priority_score"]), reverse=True)
        picked: list[dict] = []
        used = 0
        cap = int(window["max_duration_min"])
        target_count = rng.randint(2, 4)
        for task in candidates:
            dur = int(task["estimated_duration_min"])
            if used + dur > cap:
                continue
            picked.append(task)
            used += dur
            if len(picked) >= target_count:
                break

        if not picked:
            continue

        depts = sorted({str(t["department"]) for t in picked})
        allowed = window["block_type_allowed"]
        block_type = "absolute" if allowed in {"absolute", "any"} else allowed
        block_rows.append(
            {
                "block_id": block_id,
                "corridor_id": window["corridor_id"],
                "section_code": window["section_code"],
                "km_start": window["km_start"],
                "km_end": window["km_end"],
                "block_date": window["valid_date"],
                "start_time": window["start_time"],
                "end_time": window["end_time"],
                "duration_min": used,
                "block_type": block_type,
                "departments_involved": _pg_text_array(depts),
                "status": rng.choice(["planned", "planned", "draft", "approved"]),
                "planned_tasks_count": len(picked),
                "estimated_train_impact": f"{float(window['train_impact_score']):.2f}",
                "created_by": CREATED_BY,
                "created_at": _fmt_ts(ts),
                "updated_at": _fmt_ts(ts),
            }
        )
        for seq, task in enumerate(picked, start=1):
            assigned.add(int(task["task_id"]))
            task["status"] = "scheduled"
            assignment_rows.append(
                {
                    "id": assignment_id,
                    "block_id": block_id,
                    "task_id": int(task["task_id"]),
                    "department": task["department"],
                    "planned_duration_min": int(task["estimated_duration_min"]),
                    "sequence_order": seq,
                    "created_at": _fmt_ts(ts),
                }
            )
            assignment_id += 1
        block_id += 1

    return block_rows, assignment_rows


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote {path} ({len(rows)} rows)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic IR block-planning CSVs.")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    ts = _now()

    assets = generate_assets(rng, ts)
    defects = generate_defects(rng, assets, ts)
    tasks = generate_tasks(rng, assets, defects, ts)
    windows = generate_windows(rng, ts)
    blocks, block_tasks = generate_blocks_and_assignments(rng, assets, tasks, windows, ts)

    out = args.out_dir
    write_csv(out / "assets.csv", ASSET_FIELDS, assets)
    write_csv(out / "defects.csv", DEFECT_FIELDS, defects)
    write_csv(out / "maintenance_tasks.csv", TASK_FIELDS, tasks)
    write_csv(out / "corridor_windows.csv", WINDOW_FIELDS, windows)
    write_csv(out / "blocks.csv", BLOCK_FIELDS, blocks)
    write_csv(out / "block_tasks.csv", BLOCK_TASK_FIELDS, block_tasks)


if __name__ == "__main__":
    main()
