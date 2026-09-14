BEGIN;

-- 1. assets (100 records)
\copy assets (asset_id, asset_type, sub_type, division_code, section_code, corridor_id, km_start, km_end, line_category, traffic_density_class, created_at, updated_at) FROM 'data/raw/assets.csv' WITH (FORMAT csv, HEADER true);

-- 2. defects (200 records)
\copy defects (defect_id, asset_id, department, defect_type, defect_severity, detected_date, detected_by, status, recommended_action, estimated_work_duration_min, max_allowed_delay_days, source_system, source_defect_id, created_at, updated_at) FROM 'data/raw/defects.csv' WITH (FORMAT csv, HEADER true);

-- 3. maintenance_tasks (200 records)
\copy maintenance_tasks (task_id, asset_id, department, task_type, linked_defect_id, priority_score, failure_prob_7d, failure_prob_30d, urgency_score, estimated_duration_min, earliest_start_date, latest_end_date, preferred_shift, status, source_system, created_at, updated_at) FROM 'data/raw/maintenance_tasks.csv' WITH (FORMAT csv, HEADER true);

-- 4. corridor_windows (30 records)
\copy corridor_windows (window_id, corridor_id, section_code, km_start, km_end, valid_date, start_time, end_time, block_type_allowed, max_duration_min, train_impact_score, freight_traffic_level, source, created_at, updated_at) FROM 'data/raw/corridor_windows.csv' WITH (FORMAT csv, HEADER true);

-- 5. blocks (30 records)
\copy blocks (block_id, corridor_id, section_code, km_start, km_end, block_date, start_time, end_time, duration_min, block_type, departments_involved, status, planned_tasks_count, estimated_train_impact, created_by, created_at, updated_at) FROM 'data/raw/blocks.csv' WITH (FORMAT csv, HEADER true);

-- 6. block_tasks (73 records)
\copy block_tasks (id, block_id, task_id, department, planned_duration_min, sequence_order, created_at) FROM 'data/raw/block_tasks.csv' WITH (FORMAT csv, HEADER true);

-- Reset identity sequences so subsequent auto-incrementing inserts start above max ID
SELECT setval(pg_get_serial_sequence('assets', 'asset_id'), COALESCE((SELECT MAX(asset_id) FROM assets), 1));
SELECT setval(pg_get_serial_sequence('defects', 'defect_id'), COALESCE((SELECT MAX(defect_id) FROM defects), 1));
SELECT setval(pg_get_serial_sequence('maintenance_tasks', 'task_id'), COALESCE((SELECT MAX(task_id) FROM maintenance_tasks), 1));
SELECT setval(pg_get_serial_sequence('corridor_windows', 'window_id'), COALESCE((SELECT MAX(window_id) FROM corridor_windows), 1));
SELECT setval(pg_get_serial_sequence('blocks', 'block_id'), COALESCE((SELECT MAX(block_id) FROM blocks), 1));
SELECT setval(pg_get_serial_sequence('block_tasks', 'id'), COALESCE((SELECT MAX(id) FROM block_tasks), 1));

COMMIT;
