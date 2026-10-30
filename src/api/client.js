/**
 * Centralised API request helpers.
 * All components import from here rather than duplicating fetch() logic.
 *
 * VITE_API_BASE_URL is set in .env.local  →  http://127.0.0.1:8000
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

/**
 * Thin wrapper around fetch that always returns { data, error }.
 * Never throws – callers just check `error`.
 */
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) {
      const msg =
        typeof data?.detail === "string"
          ? data.detail
          : JSON.stringify(data?.detail ?? data);
      return { data: null, error: `HTTP ${res.status}: ${msg}` };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message ?? "Network error" };
  }
}

// ── Public helpers ──────────────────────────────────────────────────────────

export function fetchHealth() {
  return apiFetch("/api/health");
}

export function fetchModelInfo() {
  return apiFetch("/api/model-info");
}

/**
 * @param {object} payload - { timestamp, irradiation, ambient_temperature, module_temperature }
 */
export function fetchPrediction(payload) {
  return apiFetch("/api/predict", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * @param {number} plant  - 1 or 2
 * @param {number} limit  - max records
 */
export function fetchHistory(plant = 1, limit = 200) {
  return apiFetch(`/api/history?plant=${plant}&limit=${limit}`);
}

/**
 * @param {number} plant  - 1 or 2
 */
export function fetchDashboard(plant = 1) {
  return apiFetch(`/api/dashboard?plant=${plant}`);
}
