import axios from 'axios';

/**
 * Resolves the API base URL with full environment variable flexibility and safe fallbacks:
 * 1. Checks VITE_API_URL (configured on Vercel / production hosts).
 * 2. Checks VITE_API_BASE_URL (legacy / alternate configuration).
 * 3. Strips trailing slashes to prevent malformed double-slash URLs.
 * 4. In development mode (import.meta.env.DEV), falls back to 'http://localhost:5000/api'.
 * 5. In production builds, falls back to relative '/api', never to localhost:5000.
 */
export function getApiBaseUrl(): string {
  const envUrl =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (import.meta.env.VITE_API_BASE_URL as string | undefined);

  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // Development fallback for local work
  if (import.meta.env.DEV) {
    return 'http://localhost:5000/api';
  }

  // Production fallback: relative endpoint, never localhost
  return '/api';
}

export const API_BASE_URL = getApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 180000, // 3 minutes for heavy cross-document analysis & reasoning
});

// Automatically inject JWT Bearer token into outgoing requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // If unauthorized, clear auth state
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register') &&
        !window.location.pathname.startsWith('/workflow-guide')
      ) {
        window.location.href = '/login';
      }
    }

    const customMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected network error occurred.';
    return Promise.reject(new Error(customMessage));
  }
);
