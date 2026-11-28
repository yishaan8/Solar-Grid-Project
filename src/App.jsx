import "./App.css";
import { useState, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { MapPin, Sun, Moon } from "lucide-react";
import { useDashboard } from "./hooks/useDashboard";
import { useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import HeroSection from "./components/HeroSection";
import DashboardSection from "./components/Dashboard";
import PerformanceView from "./components/PerformanceView";
import ForecastView from "./components/ForecastView";
import FarmsView from "./components/FarmsView";
import ReportsView from "./components/ReportsView";
import SettingsView from "./components/SettingsView";
import EnteringDashboard from "./components/EnteringDashboard";
import Login from "./pages/login";
import Register from "./pages/register";
import ProtectedRoute from "./components/ProtectedRoute";

function LandingRoute() {
  const navigate = useNavigate();

  return (
    <EnteringDashboard
      onEnter={() => navigate("/login")}
    />
  );
}


function DashboardLayout() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPlant, setSelectedPlant] = useState(1);
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("solargrid-theme") || "dark";
  });

  const {
    dashboard,
    history,
    anomalies,
    loading,
    error,
    refresh,
  } = useDashboard(selectedPlant);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("solargrid-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) =>
      prev === "dark" ? "light" : "dark"
    );
  };

  const handleLogout = () => {
    logout();
    navigateToLogin();
  };

  const navigateToLogin = () => {
    window.location.href = "/login";
  };

  return (
    <div className="app" data-theme={theme}>
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <main className="main-content">
        <header className="topbar">
          <div className="search">
            Search farms, equipment, or metrics...
          </div>

          <div className="topbar-plant-pills">
            {[1, 2].map((plant) => (
              <button
                key={plant}
                className={`topbar-plant-btn ${
                  selectedPlant === plant ? "active" : ""
                }`}
                onClick={() => setSelectedPlant(plant)}
              >
                Plant {plant}
              </button>
            ))}
          </div>

          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${
              theme === "dark" ? "Light" : "Dark"
            } mode`}
          >
            {theme === "dark" ? (
              <Sun size={16} />
            ) : (
              <Moon size={16} />
            )}

            <span>
              {theme === "dark" ? "Light" : "Dark"}
            </span>
          </button>

          <div className="location">
            <MapPin size={15} />
            Karnataka, IN
          </div>

          <div className="user" title={user?.name}>
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>

          <button
            className="theme-toggle-btn"
            onClick={handleLogout}
          >
            Logout
          </button>
        </header>

        {activeTab === "overview" && (
          <>
            <HeroSection
              selectedPlant={selectedPlant}
              dashboard={dashboard}
              loading={loading}
            />

            <DashboardSection
              selectedPlant={selectedPlant}
              dashboard={dashboard}
              anomalies={anomalies}
              loading={loading}
              error={error}
              onRefresh={refresh}
              onNavigateTab={setActiveTab}
            />
          </>
        )}

        {activeTab === "performance" && (
          <PerformanceView
            selectedPlant={selectedPlant}
            dashboard={dashboard}
            history={history}
            loading={loading}
            error={error}
            onRefresh={refresh}
          />
        )}

        {activeTab === "forecast" && (
          <ForecastView selectedPlant={selectedPlant} />
        )}

        {activeTab === "farms" && (
          <FarmsView
            selectedPlant={selectedPlant}
            onSelectPlant={setSelectedPlant}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === "reports" && (
          <ReportsView selectedPlant={selectedPlant} />
        )}

        {activeTab === "settings" && (
          <SettingsView />
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route
          path="/dashboard"
          element={<DashboardLayout />}
        />
      </Route>
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}
export default App;

