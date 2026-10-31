import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const host = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
export const baseURL = host.endsWith('/api') ? host : `${host}/api`;

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Attach Access Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('subflow_access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Mutex Refresh Queue on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!error.response || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Skip refresh on auth endpoints to prevent recursion
    if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('subflow_refresh_token');
    if (!refreshToken) {
      isRefreshing = false;
      localStorage.removeItem('subflow_access_token');
      localStorage.removeItem('subflow_user');
      window.dispatchEvent(new Event('subflow_unauthorized'));
      return Promise.reject(error);
    }

    try {
      const response = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = response.data;

      localStorage.setItem('subflow_access_token', accessToken);
      if (newRefreshToken) {
        localStorage.setItem('subflow_refresh_token', newRefreshToken);
      }

      apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      processQueue(null, accessToken);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      }
      return apiClient(originalRequest);
    } catch (refreshErr) {
      processQueue(refreshErr as Error, null);
      localStorage.removeItem('subflow_access_token');
      localStorage.removeItem('subflow_refresh_token');
      localStorage.removeItem('subflow_user');
      window.dispatchEvent(new Event('subflow_unauthorized'));
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);
