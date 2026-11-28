/**
 * useDashboard.js – Custom hook that fetches dashboard + history data from the API.
 * Provides loading / error / data states. Polls every 60s for freshness.
 */
import { useEffect, useReducer, useRef } from "react";
import {
  fetchDashboard,
  fetchHistory,
  fetchFarmAnomalies,
} from "../api/client";

const POLL_INTERVAL_MS = 60_000;

const initialState = {
  loading: true,
  error: null,
  dashboard: null,
  history: null,
  anomalies: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "LOADING":
      return { ...state, loading: true, error: null };
    case "SUCCESS":
      return {
        loading: false,
        error: null,
        dashboard: action.dashboard,
        history: action.history,
        anomalies: action.anomalies,
      };
    case "ERROR":
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}

export function useDashboard(plant = 1) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const timerRef = useRef(null);
  const requestIdRef = useRef(0);

  async function load() {
    const requestId = ++requestIdRef.current;
    dispatch({ type: "LOADING" });

    const [dashRes, histRes, anomRes] = await Promise.all([
      fetchDashboard(plant),
      fetchHistory(plant, 200),
      fetchFarmAnomalies(plant, 100),
    ]);

    // Ignore responses belonging to an older request.
    if (requestId !== requestIdRef.current) return;
    if (dashRes.error) {
      dispatch({
        type: "ERROR",
        error: dashRes.error,
      });
      return;
    }

    dispatch({
      type: "SUCCESS",
      dashboard: dashRes.data,
      history: histRes.error ? null : histRes.data,
      anomalies: anomRes.error ? null : anomRes.data,
    });
  }

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      requestIdRef.current++;
      clearInterval(timerRef.current);
    };
  }, [plant]);
  return { ...state, refresh: load };
}