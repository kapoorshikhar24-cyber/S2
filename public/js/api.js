/**
 * api.js — UAT Dashboard API client
 *
 * Wraps all fetch calls to the backend. Automatically attaches the JWT token
 * from sessionStorage and handles common error conditions centrally.
 *
 * Usage (loaded via <script> tag — no ES modules):
 *   const data = await API.get('/environments');
 *   await API.post('/runs', { env: 'staging' });
 */

const API = {
  /** Read the current JWT from session storage. */
  token: () => sessionStorage.getItem('uat_token'),

  /** Build request headers, injecting the Bearer token when present. */
  headers() {
    const h = { 'Content-Type': 'application/json' };
    const token = API.token();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  },

  /**
   * Core fetch wrapper.
   * @param {string} method  HTTP verb (GET, POST, PUT, DELETE)
   * @param {string} path    API path, e.g. '/runs'
   * @param {object} [body]  Optional request body (will be JSON-serialised)
   * @returns {Promise<any|null>} Parsed JSON response, or null on 401
   */
  async request(method, path, body) {
    const options = {
      method,
      headers: API.headers(),
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const response = await fetch(path, options);

    // Session expired or invalid token — delegate logout to Auth module
    if (response.status === 401) {
      window.Auth.handleLogout();
      return null;
    }

    // Surface any other non-2xx status as a readable error
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.message || `Request failed: ${response.status}`);
    }

    // Return parsed JSON; gracefully handle empty bodies (e.g. 204 No Content)
    return response.status === 204 ? null : response.json();
  },

  // Convenience shorthands
  get:  (path)        => API.request('GET',    path),
  post: (path, body)  => API.request('POST',   path, body),
  put:  (path, body)  => API.request('PUT',    path, body),
  del:  (path, body)  => API.request('DELETE', path, body),
};

// Expose globally so other scripts loaded via <script> tags can use window.API
window.API = API;
