const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
export async function apiFetch(path, options = {}) {
  try {
    const token = localStorage.getItem("solarhub-token");
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const data =
      response.status === 204 ? null : await response.json();

    if (!response.ok) {
      const message =
        typeof data?.detail === "string"
          ? data.detail
          : JSON.stringify(data?.detail ?? data);

      return {
        data: null,
        error: `HTTP ${response.status}: ${message}`,
      };
    }

    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error.message || "Network error",
    };
  }
}

export const fetchHealth = () => apiFetch("/api/health");
export const fetchModelInfo = () => apiFetch("/api/model-info");
export const fetchPrediction = (payload) =>
  apiFetch("/api/predict", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const fetchHistory = (plant = 1, limit = 200) =>
  apiFetch(`/api/history?plant=${plant}&limit=${limit}`);
export const fetchDashboard = (plant = 1) =>
  apiFetch(`/api/dashboard?plant=${plant}`);

// Farm-level model endpoints
export const fetchFarmMetrics = () =>
  apiFetch("/api/farm/metrics");
export const fetchFarmHistory = (plant = 1, limit = 200) =>
  apiFetch(`/api/farm/history?plant=${plant}&limit=${limit}`);

// Starts a historical CSV replay and stores the results in MongoDB.
export const startFarmReplay = (limit = 200) =>
  apiFetch(`/api/farm-telemetry/replay?limit=${limit}`, {
    method: "POST",
  });

// Retrieves a previously created replay belonging to the logged-in user.
export const fetchFarmReplay = (replayId) =>
  apiFetch(`/api/farm-telemetry/replay/${replayId}`);
// Farm-level manual prediction endpoint.
export const fetchFarmPrediction = (payload) =>
  apiFetch("/api/farm/predict", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const fetchSimulationRange = (plant = 1) =>
  apiFetch(`/api/simulation/range?plant=${encodeURIComponent(plant)}`);

export const fetchSimulationForecast = (plant = 1, asOf, days = 3) =>
  apiFetch(
    `/api/simulation/forecast?plant=${encodeURIComponent(plant)}&as_of=${encodeURIComponent(asOf)}&days=${encodeURIComponent(days)}`
  );