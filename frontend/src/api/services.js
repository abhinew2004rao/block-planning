import api, {
  ASSETS,
  DEFECTS,
  TASKS,
  BLOCKS,
  OPTIMIZATION,
} from './axios';

/**
 * Standard error formatter for graceful error handling in API services.
 *
 * @param {Error} error
 * @param {string} fallbackMsg
 * @returns {Promise<never>}
 */
const handleError = (error, fallbackMsg) => {
  const message =
    error.response?.data?.detail ||
    error.response?.data?.message ||
    error.message ||
    fallbackMsg;
  console.error(`[API Service Error] ${fallbackMsg}:`, error);
  return Promise.reject(new Error(message));
};

/* ==========================================================================
   1. Assets API Services
   ========================================================================== */

/**
 * Fetch paginated assets list.
 *
 * @param {number} [skip=0] - Number of records to skip
 * @param {number} [limit=100] - Maximum records to return
 * @returns {Promise<Array>} List of assets
 */
export const getAssets = async (skip = 0, limit = 100) => {
  try {
    const response = await api.get(ASSETS, {
      params: { skip, limit },
    });
    return response.data;
  } catch (error) {
    return handleError(error, 'Failed to fetch assets');
  }
};

/**
 * Fetch single asset by ID.
 *
 * @param {number|string} id - Asset ID
 * @returns {Promise<Object>} Asset details
 */
export const getAssetById = async (id) => {
  try {
    const response = await api.get(`${ASSETS}/${id}`);
    return response.data;
  } catch (error) {
    return handleError(error, `Failed to fetch asset #${id}`);
  }
};

/**
 * Create a new infrastructure asset.
 *
 * @param {Object} data - Asset creation payload
 * @returns {Promise<Object>} Created asset
 */
export const createAsset = async (data) => {
  try {
    const response = await api.post(ASSETS, data);
    return response.data;
  } catch (error) {
    return handleError(error, 'Failed to create asset');
  }
};

/**
 * Delete an asset by ID.
 *
 * @param {number|string} id - Asset ID
 * @returns {Promise<Object>} Deletion response
 */
export const deleteAsset = async (id) => {
  try {
    const response = await api.delete(`${ASSETS}/${id}`);
    return response.data;
  } catch (error) {
    return handleError(error, `Failed to delete asset #${id}`);
  }
};

export const assetService = {
  getAssets,
  getAssetById,
  createAsset,
  deleteAsset,
};

/* ==========================================================================
   2. Defects API Services
   ========================================================================== */

/**
 * Fetch paginated defects list.
 *
 * @param {number} [skip=0] - Number of records to skip
 * @param {number} [limit=100] - Maximum records to return
 * @returns {Promise<Array>} List of defects
 */
export const getDefects = async (skip = 0, limit = 100) => {
  try {
    const response = await api.get(DEFECTS, {
      params: { skip, limit },
    });
    return response.data;
  } catch (error) {
    return handleError(error, 'Failed to fetch defects');
  }
};

/**
 * Fetch single defect by ID.
 *
 * @param {number|string} id - Defect ID
 * @returns {Promise<Object>} Defect details
 */
export const getDefectById = async (id) => {
  try {
    const response = await api.get(`${DEFECTS}/${id}`);
    return response.data;
  } catch (error) {
    return handleError(error, `Failed to fetch defect #${id}`);
  }
};

/**
 * Log a new track/signal/traction defect.
 *
 * @param {Object} data - Defect creation payload
 * @returns {Promise<Object>} Created defect
 */
export const createDefect = async (data) => {
  try {
    const response = await api.post(DEFECTS, data);
    return response.data;
  } catch (error) {
    return handleError(error, 'Failed to create defect');
  }
};

/**
 * Delete a defect by ID.
 *
 * @param {number|string} id - Defect ID
 * @returns {Promise<Object>} Deletion response
 */
export const deleteDefect = async (id) => {
  try {
    const response = await api.delete(`${DEFECTS}/${id}`);
    return response.data;
  } catch (error) {
    return handleError(error, `Failed to delete defect #${id}`);
  }
};

export const defectService = {
  getDefects,
  getDefectById,
  createDefect,
  deleteDefect,
};

/* ==========================================================================
   3. Tasks API Services
   ========================================================================== */

/**
 * Fetch paginated maintenance tasks list.
 *
 * @param {number} [skip=0] - Number of records to skip
 * @param {number} [limit=100] - Maximum records to return
 * @returns {Promise<Array>} List of tasks
 */
export const getTasks = async (skip = 0, limit = 100) => {
  try {
    const response = await api.get(TASKS, {
      params: { skip, limit },
    });
    return response.data;
  } catch (error) {
    return handleError(error, 'Failed to fetch tasks');
  }
};

/**
 * Fetch tasks backlog with optional filters.
 *
 * @param {string} [status] - Status filter (e.g. 'pending', 'scored')
 * @param {string} [department] - Department filter (e.g. 'P.Way', 'S&T', 'TRD')
 * @param {number} [min_priority] - Minimum priority score filter
 * @returns {Promise<Array>} Filtered tasks backlog
 */
export const getTasksBacklog = async (status, department, min_priority) => {
  try {
    const params = {};
    if (status) params.status = status;
    if (department) params.department = department;
    if (min_priority !== undefined && min_priority !== null) params.min_priority = min_priority;

    const response = await api.get(`${TASKS}/backlog`, { params });
    return response.data;
  } catch (error) {
    return handleError(error, 'Failed to fetch tasks backlog');
  }
};

/**
 * Run ML heuristic scoring on maintenance backlog tasks.
 *
 * @param {Array<number>} [taskIds] - Optional array of specific task IDs to score
 * @param {boolean} [updateStatus=true] - Whether to transition tasks from pending to scored
 * @returns {Promise<Object>} Scoring result summary
 */
export const runMLScoring = async (taskIds = null, updateStatus = true) => {
  try {
    const params = { update_status: updateStatus };
    const response = await api.post(`${TASKS}/score`, taskIds || null, { params });
    return response.data;
  } catch (error) {
    return handleError(error, 'Failed to run ML priority scoring');
  }
};

export const taskService = {
  getTasks,
  getTasksBacklog,
  runMLScoring,
};

/* ==========================================================================
   4. Blocks API Services
   ========================================================================== */

/**
 * Fetch paginated corridor blocks list.
 *
 * @param {number} [skip=0] - Number of records to skip
 * @param {number} [limit=100] - Maximum records to return
 * @returns {Promise<Array>} List of corridor blocks
 */
export const getBlocks = async (skip = 0, limit = 100) => {
  try {
    const response = await api.get(BLOCKS, {
      params: { skip, limit },
    });
    return response.data;
  } catch (error) {
    return handleError(error, 'Failed to fetch corridor blocks');
  }
};

/**
 * Fetch single block details by block_id.
 *
 * @param {number|string} id - Block ID
 * @returns {Promise<Object>} Block details
 */
export const getBlockById = async (id) => {
  try {
    const response = await api.get(`${BLOCKS}/${id}`);
    return response.data;
  } catch (error) {
    return handleError(error, `Failed to fetch block #${id}`);
  }
};

/**
 * Fetch tasks packed into a specific corridor block.
 *
 * @param {number|string} id - Block ID
 * @returns {Promise<Array>} Packed tasks list
 */
export const getBlockTasks = async (id) => {
  try {
    const response = await api.get(`${BLOCKS}/${id}/tasks`);
    return response.data;
  } catch (error) {
    return handleError(error, `Failed to fetch tasks for block #${id}`);
  }
};

/**
 * Export corridor blocks to CSV format as a Blob.
 *
 * @param {string} [start_date] - Optional start date (YYYY-MM-DD)
 * @param {string} [end_date] - Optional end date (YYYY-MM-DD)
 * @returns {Promise<Blob>} CSV file Blob
 */
export const exportBlocksCSV = async (start_date, end_date) => {
  try {
    const params = {};
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;

    const response = await api.get(`${BLOCKS}/export/csv`, {
      params,
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    return handleError(error, 'Failed to export blocks CSV');
  }
};

export const blockService = {
  getBlocks,
  getBlockById,
  getBlockTasks,
  exportBlocksCSV,
};

/* ==========================================================================
   5. Optimization API Services
   ========================================================================== */

/**
 * Run block optimizer engine on maintenance tasks and corridor windows.
 *
 * @param {string} [start_date] - Horizon start date (YYYY-MM-DD)
 * @param {string} [end_date] - Horizon end date (YYYY-MM-DD)
 * @param {string} [horizon='weekly'] - Planning horizon ('weekly' or 'monthly')
 * @param {boolean} [replace_planned=true] - Whether to replace unapproved planned blocks
 * @returns {Promise<Object>} Optimization execution summary
 */
export const runOptimization = async (
  start_date,
  end_date,
  horizon = 'weekly',
  replace_planned = true
) => {
  try {
    const params = {
      horizon,
      replace_planned: String(replace_planned),
    };
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;

    const response = await api.post(`${OPTIMIZATION}/run`, null, { params });
    return response.data;
  } catch (error) {
    return handleError(error, 'Failed to execute block optimizer');
  }
};

/**
 * Export optimization results to CSV files on the server.
 *
 * @param {string} [output_dir='data/output'] - Output directory
 * @returns {Promise<Object>} Exported file paths
 */
export const exportOptimizationCSV = async (output_dir = 'data/output') => {
  try {
    const response = await api.post(`${OPTIMIZATION}/export-csv`, null, {
      params: { output_dir },
    });
    return response.data;
  } catch (error) {
    return handleError(error, 'Failed to export optimization CSV files');
  }
};

/**
 * Fetch optimization statistics and operational KPI metrics.
 *
 * @returns {Promise<Object>} Optimization status stats
 */
export const getOptimizationStatus = async () => {
  try {
    const response = await api.get(`${OPTIMIZATION}/status`);
    return response.data;
  } catch (error) {
    return handleError(error, 'Failed to fetch optimization status');
  }
};

export const optimizationService = {
  runOptimization,
  exportOptimizationCSV,
  getOptimizationStatus,
};

/* ==========================================================================
   Combined Default Export
   ========================================================================== */
const services = {
  assets: assetService,
  defects: defectService,
  tasks: taskService,
  blocks: blockService,
  optimization: optimizationService,
};

export default services;
