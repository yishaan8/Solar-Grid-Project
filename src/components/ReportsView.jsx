import React from "react";
import "./DashboardSection.css";
import { FileText, Download, Calendar, BarChart2 } from "lucide-react";

function ReportsView({ selectedPlant = 1 }) {
  const plantTitle = selectedPlant === 2 ? "Plant 2" : "Plant 1";

  return (
    <div className="reports-page-container">
     
    </div>
  );
}

export default ReportsView;
