-- Row Counts
SELECT 'assets' AS table_name, count(*) AS row_count FROM assets
UNION ALL
SELECT 'defects', count(*) FROM defects
UNION ALL
SELECT 'maintenance_tasks', count(*) FROM maintenance_tasks
UNION ALL
SELECT 'corridor_windows', count(*) FROM corridor_windows
UNION ALL
SELECT 'blocks', count(*) FROM blocks
UNION ALL
SELECT 'block_tasks', count(*) FROM block_tasks
ORDER BY table_name;

-- Foreign Key Integrity Checks (All must return 0)
SELECT 
    (SELECT count(*) FROM defects WHERE asset_id NOT IN (SELECT asset_id FROM assets)) AS orphaned_defects_asset,
    (SELECT count(*) FROM maintenance_tasks WHERE asset_id NOT IN (SELECT asset_id FROM assets)) AS orphaned_tasks_asset,
    (SELECT count(*) FROM maintenance_tasks WHERE linked_defect_id IS NOT NULL AND linked_defect_id NOT IN (SELECT defect_id FROM defects)) AS orphaned_tasks_defect,
    (SELECT count(*) FROM block_tasks WHERE block_id NOT IN (SELECT block_id FROM blocks)) AS orphaned_block_tasks_block,
    (SELECT count(*) FROM block_tasks WHERE task_id NOT IN (SELECT task_id FROM maintenance_tasks)) AS orphaned_block_tasks_task;
