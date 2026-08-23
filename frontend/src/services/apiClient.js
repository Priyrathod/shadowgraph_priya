import axios from 'axios';
import { getStoredToken } from '../context/AuthContext';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  timeout: 8000
});

function loopbackCandidates(baseURL) {
  const candidates = [];
  const add = (value) => {
    if (value && !candidates.includes(value)) candidates.push(value);
  };
  if (!baseURL) {
    add('http://127.0.0.1:8000');
    add('http://localhost:8000');
    return candidates;
  }
  try {
    const url = new URL(baseURL);
    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1';
      add(url.toString().replace(/\/$/, ''));
    } else if (url.hostname === '127.0.0.1') {
      url.hostname = 'localhost';
      add(url.toString().replace(/\/$/, ''));
    } else if (window?.location?.hostname) {
      const alt = new URL(baseURL);
      alt.hostname = window.location.hostname;
      add(alt.toString().replace(/\/$/, ''));
    }
  } catch {
    // noop
  }
  add('http://127.0.0.1:8000');
  add('http://localhost:8000');
  return candidates.filter((v) => v !== (baseURL || '').replace(/\/$/, ''));
}

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config || {};
    const isNetworkError = !error?.response && Boolean(error?.request);
    if (isNetworkError) {
      const tried = new Set(config.__sgTriedBases || []);
      const currentBase = (config.baseURL || apiClient.defaults.baseURL || '').replace(/\/$/, '');
      tried.add(currentBase);
      const candidates = loopbackCandidates(currentBase);
      const nextBase = candidates.find((candidate) => !tried.has(candidate));
      if (nextBase) {
        config.__sgTriedBases = [...tried];
        config.baseURL = nextBase;
        return apiClient.request(config);
      }
    }

    const status = error?.response?.status;
    if (status === 401) {
      const from = `${window.location.pathname}${window.location.search}`;
      window.dispatchEvent(new CustomEvent('shadowgraph:unauthorized', { detail: { from } }));
    }
    return Promise.reject(error);
  }
);
