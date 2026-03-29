const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('netrunner_token');
}

export function setToken(token) {
  localStorage.setItem('netrunner_token', token);
}

export function clearToken() {
  localStorage.removeItem('netrunner_token');
}

export function isLoggedIn() {
  return !!getToken();
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Nicht autorisiert');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Fehler' }));
    throw new Error(err.detail || 'Fehler');
  }

  return res.json();
}

export const api = {
  login: (password) => request('POST', '/login', { password }),
  getPlayer: () => request('GET', '/player'),
  setHandle: (handle) => request('POST', '/player/handle', { handle }),
  getSession: () => request('GET', '/session'),
  getMission: (id) => request('GET', `/mission/${id}`),
  runCode: (code, stdin = '') => request('POST', '/run', { code, stdin }),
  submit: (id, code) => request('POST', `/submit/${id}`, { code }),
  getHint: (id) => request('POST', `/hint/${id}`),
  getMap: () => request('GET', '/map'),
  getInventory: () => request('GET', '/inventory'),
  getStats: () => request('GET', '/stats'),
};
