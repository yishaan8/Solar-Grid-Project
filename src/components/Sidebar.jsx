import {
  LayoutDashboard,
  Sun,
  Activity,
  TrendingUp,
  FileText,
  Leaf
} from "lucide-react";

function Sidebar({ activeTab = "overview", onSelectTab }) {
  const handleNav = (tab) => {
    if (onSelectTab) onSelectTab(tab);
  };

  const menuItems = [
    { id: "overview", label: "Overview", Icon: LayoutDashboard },
    { id: "farms", label: "Solar Farms", Icon: Sun },
    { id: "performance", label: "Performance", Icon: Activity },
    { id: "forecast", label: "Forecast", Icon: TrendingUp },
    { id: "reports", label: "Reports", Icon: FileText },
    { id: "settings", label: "Settings", Icon: FileText },
  ];

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon">☀</div>
        <div>
          <h2>SOLARGRID</h2>
          <span>Solar Farm Monitoring</span>
        </div>
      </div>

      <div className="module">
        <span>PLANT MONITORING</span>
      </div>

      <nav>
        {menuItems.map(({ id, label, Icon }) => (
          <div
            key={id}
            className={`menu-item ${activeTab === id ? "active" : ""}`}
            onClick={() => handleNav(id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleNav(id);
              }
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="clean-energy">
          <span><Leaf size={18} /></span>
          <div>
            <strong>SolarGrid</strong>
            <small>Monitor. Understand. Improve.</small>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
