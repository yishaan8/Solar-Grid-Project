import React from "react";
import "./DashboardSection.css";
import {
  BarChart3,
  CloudSun,
  Activity,
  Bell,
  AlertTriangle,
  Leaf,
  Droplets,
  Wind,
  ThermometerSun,
  ShieldCheck,
} from "lucide-react";

function DashboardSection() {
  return (
    <section className="dashboard-section">

      {/* =====================================================
          TOP ROW
      ===================================================== */}

      <div className="dashboard-grid top-grid">

        {/* TODAY'S GENERATION */}
        <div className="dashboard-card generation-card">

          <div className="card-header">
            <div className="card-title">
              <BarChart3 size={16} />
              <span>Today's Generation</span>
            </div>

            <button className="card-dropdown">
              Power Output
              <span>⌄</span>
            </button>
          </div>

          <div className="chart-container">

            <div className="chart-y-axis">
              <span>15</span>
              <span>10</span>
              <span>5</span>
              <span>0</span>
            </div>

            <svg
              className="generation-chart"
              viewBox="0 0 500 150"
              preserveAspectRatio="none"
            >

              {/* Grid */}
              <line x1="0" y1="20" x2="500" y2="20" />
              <line x1="0" y1="60" x2="500" y2="60" />
              <line x1="0" y1="100" x2="500" y2="100" />
              <line x1="0" y1="140" x2="500" y2="140" />

              {/* Area */}
              <path
                className="chart-area"
                d="
                  M0,140
                  C50,138 75,125 105,110
                  C145,88 165,60 210,45
                  C250,30 280,25 320,42
                  C365,60 390,90 425,110
                  C455,128 475,137 500,140
                  L500,140
                  L0,140
                  Z
                "
              />

              {/* Line */}
              <path
                className="chart-line"
                d="
                  M0,140
                  C50,138 75,125 105,110
                  C145,88 165,60 210,45
                  C250,30 280,25 320,42
                  C365,60 390,90 425,110
                  C455,128 475,137 500,140
                "
              />

              {/* Peak point */}
              <circle
                cx="270"
                cy="30"
                r="5"
                className="chart-point"
              />

            </svg>

            <div className="chart-tooltip">
              <strong>12.4 MW</strong>
              <span>12:00 PM</span>
            </div>

            <div className="chart-x-axis">
              <span>6 AM</span>
              <span>9 AM</span>
              <span>12 PM</span>
              <span>3 PM</span>
              <span>6 PM</span>
            </div>

          </div>

        </div>


        {/* WEATHER */}
        <div className="dashboard-card weather-card">

          <div className="card-header">

            <div className="card-title">
              <CloudSun size={17} />
              <span>Weather Conditions</span>
            </div>

            <span className="live-badge">
              <span></span>
              Live
            </span>

          </div>

          <div className="weather-main">

            <div className="weather-icon">
              ☀
            </div>

            <div>
              <strong>28°C</strong>
              <span>Clear Sky</span>
            </div>

          </div>

          <div className="weather-stats">

            <div>
              <span className="weather-stat-icon">☀</span>
              <strong>820 W/m²</strong>
              <small>Irradiance</small>
            </div>

            <div>
              <Droplets size={14} />
              <strong>42%</strong>
              <small>Humidity</small>
            </div>

            <div>
              <Wind size={15} />
              <strong>12 km/h</strong>
              <small>Wind Speed</small>
            </div>

          </div>

        </div>


        {/* EQUIPMENT HEALTH */}
        <div className="dashboard-card equipment-card">

          <div className="card-header">

            <div className="card-title">
              <Activity size={16} />
              <span>Equipment Health</span>
            </div>

          </div>

          <div className="equipment-content">

            <div className="health-donut">

              <div className="donut-center">
                <strong>500</strong>
                <span>Total Units</span>
              </div>

            </div>

            <div className="health-legend">

              <div>
                <span className="legend-dot healthy"></span>
                <span>Healthy</span>
                <strong>430</strong>
              </div>

              <div>
                <span className="legend-dot attention"></span>
                <span>Attention</span>
                <strong>50</strong>
              </div>

              <div>
                <span className="legend-dot faulty"></span>
                <span>Faulty</span>
                <strong>20</strong>
              </div>

            </div>

          </div>

        </div>

      </div>


      {/* =====================================================
          BOTTOM ROW
      ===================================================== */}

      <div className="dashboard-grid bottom-grid">


        {/* RECENT ALERTS */}
        <div className="dashboard-card alerts-card">

          <div className="card-header">

            <div className="card-title">
              <Bell size={16} />
              <span>Recent Alerts</span>
            </div>

            <button className="view-all">
              View All
            </button>

          </div>


          <div className="alert-list">

            <div className="alert-item">

              <AlertTriangle
                size={17}
                className="alert-danger"
              />

              <div>
                <strong>Inverter 3 - Overheating</strong>
                <span>Solar Farm A • 10:12 AM</span>
              </div>

              <span className="alert-badge critical">
                Critical
              </span>

            </div>


            <div className="alert-item">

              <Leaf
                size={17}
                className="alert-warning"
              />

              <div>
                <strong>Panel String B2 - Low Output</strong>
                <span>Solar Farm A • 09:48 AM</span>
              </div>

              <span className="alert-badge warning">
                Warning
              </span>

            </div>


            <div className="alert-item">

              <AlertTriangle
                size={17}
                className="alert-warning"
              />

              <div>
                <strong>Efficiency Drop Detected</strong>
                <span>Solar Farm C • 08:30 AM</span>
              </div>

              <span className="alert-badge warning">
                Warning
              </span>

            </div>


            <div className="alert-item">

              <ShieldCheck
                size={17}
                className="alert-info"
              />

              <div>
                <strong>Scheduled Maintenance Due</strong>
                <span>Solar Farm A • Apr 22, 2025</span>
              </div>

              <span className="alert-badge info">
                Info
              </span>

            </div>

          </div>

        </div>


        {/* PERFORMANCE SUMMARY */}
        <div className="dashboard-card performance-card">

          <div className="card-header">

            <div className="card-title">
              <BarChart3 size={16} />
              <span>Performance Summary</span>
            </div>

            <button className="card-dropdown">
              Today
              <span>⌄</span>
            </button>

          </div>


          <div className="performance-grid">

            <div className="performance-stat">
              <span className="performance-icon">⚡</span>
              <strong>78.6 MWh</strong>
              <small>Energy Generated</small>
              <em>↑ 8.1%</em>
            </div>

            <div className="performance-stat">
              <span className="performance-icon">▥</span>
              <strong>95.7%</strong>
              <small>Performance Ratio</small>
              <em>↑ 2.3%</em>
            </div>

            <div className="performance-stat">
              <span className="performance-icon">▦</span>
              <strong>89.4%</strong>
              <small>Capacity Utilization</small>
              <em>↑ 1.1%</em>
            </div>

            <div className="performance-stat">
              <span className="performance-icon">🌿</span>
              <strong>42.3 tons</strong>
              <small>CO₂ Offset</small>
              <em>↑ 8.5%</em>
            </div>

          </div>

        </div>
        </div>

    </section>
  );
}

export default DashboardSection;