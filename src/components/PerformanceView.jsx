import React, { useMemo } from "react";
import "./DashboardSection.css";

import {
  Activity,
  CheckCircle2,
  Info,
  Calendar,
  Layers,
  Database,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useDashboard } from "../hooks/useDashboard";

function fmt(val, digits = 2) {
  if (val == null || !Number.isFinite(val)) return "—";
  return Number(val).toFixed(digits);
}

function fmtTime(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function PerformanceView({ selectedPlant = 1, onSelectPlant }) {
  const { loading, error, dashboard, history, refresh } = useDashboard(selectedPlant);

  const activePlant = dashboard?.active_plant ?? dashboard?.plant1 ?? {};
  const metrics = activePlant.model_metrics ?? null;
  const isComparable = metrics?.comparable !== false && (history?.records?.length ?? 0) > 0;
  const plantTitle = selectedPlant === 2 ? "Solar Farm B (Plant 2)" : "Solar Farm A (Plant 1)";

  const chartData = useMemo(() => {
    if (!isComparable || !history?.records?.length) return [];
    return history.records.slice(-70).map((d) => ({
      time: fmtTime(d.timestamp),
      actual: d.actual_ac_power != null ? Math.round(d.actual_ac_power * 10) / 10 : null,
      predicted: d.predicted_ac_power != null ? Math.round(d.predicted_ac_power * 10) / 10 : null,
    }));
  }, [history, isComparable]);

  return (
    <div className="performance-page-container">
     
    </div>
  );
}

export default PerformanceView;
