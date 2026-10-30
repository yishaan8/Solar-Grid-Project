import React, { useState, useEffect } from "react";
import "./DashboardSection.css";
import { Settings, Server, CheckCircle2, RefreshCw } from "lucide-react";
import { fetchHealth } from "../api/client";

function SettingsView() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth().then((res) => {
      setHealth(res.data);
      setLoading(false);
    });
  }, []);

  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  return (
    <div className="settings-page-container">
     
    </div>
  );
}

export default SettingsView;
