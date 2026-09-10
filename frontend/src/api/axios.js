import axios from 'axios';

// API Endpoints constants
export const ASSETS = '/assets';
export const DEFECTS = '/defects';
export const TASKS = '/tasks';
export const BLOCKS = '/blocks';
export const OPTIMIZATION = '/optimization';

// Axios instance configuration
const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to log outgoing requests
api.interceptors.request.use(
  (config) => {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
      baseURL: config.baseURL,
      url: config.url,
      method: config.method,
      params: config.params,
      data: config.data,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors with user-friendly formatting
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    let message = 'An unexpected error occurred';

    // 1. Network / Connectivity Errors (Server offline, DNS, CORS)
    if (!error.response) {
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        message = 'Network Error: Unable to connect to backend server. Please check your network connection or verify the server is running.';
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        message = 'Request Timeout: The server took too long to respond. Please try again.';
      } else {
        message = error.message || 'Network Error: Server is currently unreachable.';
      }
    } else {
      // 2. HTTP Responses with Error Status (4xx, 5xx)
      const data = error.response.data;
      if (data) {
        if (typeof data.detail === 'string') {
          message = data.detail;
        } else if (Array.isArray(data.detail)) {
          // FastAPI / Pydantic validation error array: [{ loc: ['body', 'field'], msg: '...' }]
          message = data.detail
            .map((item) => {
              const field = Array.isArray(item.loc)
                ? item.loc.filter((segment) => segment !== 'body').join('.')
                : '';
              return field ? `${field}: ${item.msg}` : item.msg || JSON.stringify(item);
            })
            .join('; ');
        } else if (typeof data.message === 'string') {
          message = data.message;
        } else if (typeof data === 'string') {
          message = data;
        } else {
          message = `Server responded with error status ${error.response.status} (${error.response.statusText || 'Error'})`;
        }
      } else {
        message = `Server error ${error.response.status}: ${error.response.statusText || 'Unknown error'}`;
      }
    }

    console.error('[API Response Error]', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message,
      data: error.response?.data,
    });

    const enhancedError = new Error(message);
    enhancedError.status = error.response?.status;
    enhancedError.isNetworkError = !error.response;
    enhancedError.originalError = error;

    return Promise.reject(enhancedError);
  }
);

export default api;
