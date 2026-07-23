import axios from "axios";

const rawBase = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "http://localhost:8000/api";
export const API_BASE = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;

const client = axios.create({ baseURL: API_BASE });

function getTokens() {
  return {
    access: localStorage.getItem("genhire_access"),
    refresh: localStorage.getItem("genhire_refresh"),
  };
}

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem("genhire_access", access);
  if (refresh) localStorage.setItem("genhire_refresh", refresh);
}

export function clearTokens() {
  localStorage.removeItem("genhire_access");
  localStorage.removeItem("genhire_refresh");
}

client.interceptors.request.use((config) => {
  const { access } = getTokens();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

let isRefreshing = false;
let queue = [];

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      const { refresh } = getTokens();
      if (!refresh) {
        clearTokens();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject, originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE}/auth/token/refresh/`, { refresh });
        setTokens({ access: res.data.access });
        queue.forEach(({ resolve, originalRequest: req }) => {
          req.headers.Authorization = `Bearer ${res.data.access}`;
          resolve(client(req));
        });
        queue = [];
        originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
        return client(originalRequest);
      } catch (refreshError) {
        queue.forEach(({ reject }) => reject(refreshError));
        queue = [];
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;
