import {
  LayoutDashboard,
  Sun,
  Cpu,
  Activity,
  AlertTriangle,
  Wrench,
  FileText,
  Settings,
} from "lucide-react";

function Sidebar() {
  return (
    <aside className="sidebar">

      <div className="logo">
        <div className="logo-icon">☀</div>

        <div>
          <h2>SOLARHUB</h2>
          <span>Brighter Tomorrows</span>
        </div>
      </div>

      <div className="module">
        <span>Asset Intelligence</span>
      </div>

      <nav>

        <div className="menu-item active">
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </div>

        <div className="menu-item">
          <Sun size={18} />
          <span>Solar Farms</span>
        </div>

        <div className="menu-item">
          <Cpu size={18} />
          <span>Equipment</span>
        </div>

        <div className="menu-item">
          <Activity size={18} />
          <span>Performance</span>
        </div>

        <div className="menu-item">
          <AlertTriangle size={18} />
          <span>AI Insights</span>
        </div>

        <div className="menu-item">
          <Wrench size={18} />
          <span>Maintenance</span>
        </div>

        <div className="menu-item">
          <FileText size={18} />
          <span>Reports</span>
        </div>

      </nav>

      <div className="sidebar-bottom">

        <div className="clean-energy">
          <span>🌿</span>

          <div>
            <strong>Clean Energy</strong>
            <small>Smarter Decisions</small>
          </div>
        </div>

        <div className="menu-item">
          <Settings size={18} />
          <span>Settings</span>
        </div>

      </div>

    </aside>
  );
}

export default Sidebar;