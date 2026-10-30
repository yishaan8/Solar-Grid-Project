import "./App.css";
import { MapPin, Sun, Moon } from "lucide-react";
import Sidebar from "./components/Sidebar";
import HeroSection from "./components/HeroSection";
import DashboardSection from "./components/Dashboard";
import PerformanceView from "./components/PerformanceView";
import ForecastView from "./components/ForecastView";
import FarmsView from "./components/FarmsView";
import ReportsView from "./components/ReportsView";
import SettingsView from "./components/SettingsView";
import EnteringDashboard from "./components/EnteringDashboard";
import { useState, useEffect } from "react";

function App() {
  const [entered, setEntered] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPlant, setSelectedPlant] = useState(1);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("solargrid-theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("solargrid-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  if (!entered) {
    return <EnteringDashboard onEnter={() => setEntered(true)} />;
  }

  return (
    <div className="app" data-theme={theme}>
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />
      <main className="main-content">
        <header className="topbar">
          <div className="search">
            Search farms, equipment, or metrics...
          </div>

          <div className="topbar-plant-pills">
            <button
              className={`topbar-plant-btn ${selectedPlant === 1 ? "active" : ""}`}
              onClick={() => setSelectedPlant(1)}
            >
              Plant 1
            </button>
            <button
              className={`topbar-plant-btn ${selectedPlant === 2 ? "active" : ""}`}
              onClick={() => setSelectedPlant(2)}
            >
              Plant 2
            </button>
          </div>

          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>

          <div className="location">
            <MapPin size={15} />
            Karnataka, IN
          </div>
          <div className="user">P</div>
        </header>

        {activeTab === "overview" && (
          <>
            <HeroSection
              selectedPlant={selectedPlant}
              onSelectPlant={setSelectedPlant}
              theme={theme}
            />
            <DashboardSection
              selectedPlant={selectedPlant}
              onSelectPlant={setSelectedPlant}
              onNavigateTab={setActiveTab}
              theme={theme}
            />
          </>
        )}

        {activeTab === "performance" && (
          <PerformanceView
            selectedPlant={selectedPlant}
            onSelectPlant={setSelectedPlant}
          />
        )}

        {activeTab === "forecast" && <ForecastView />}

        {activeTab === "farms" && (
          <FarmsView
            selectedPlant={selectedPlant}
            onSelectPlant={setSelectedPlant}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === "reports" && <ReportsView selectedPlant={selectedPlant} />}

        {activeTab === "settings" && <SettingsView />}
      </main>
    </div>
  );
}

export default App;