/**
 * useDashboard.js – Custom hook that fetches dashboard + history data from the API.
 * Provides loading / error / data states. Polls every 60s for freshness.
 */
import { useEffect, useReducer, useRef } from "react";
import { fetchDashboard, fetchHistory } from "../api/client";

const POLL_INTERVAL_MS = 60_000;

const initialState = {
  loading: true,
  error: null,
  dashboard: null,
  history: null,
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

  async function load() {
    dispatch({ type: "LOADING" });
    const [dashRes, histRes] = await Promise.all([
      fetchDashboard(plant),
      fetchHistory(plant, 200),
    ]);

    if (dashRes.error || histRes.error) {
      dispatch({
        type: "ERROR",
        error: dashRes.error ?? histRes.error,
      });
      return;
    }

    dispatch({
      type: "SUCCESS",
      dashboard: dashRes.data,
      history: histRes.data,
    });
  }

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plant]);

  return { ...state, refresh: load };
}
