import "./App.css";
import { MapPin } from "lucide-react";
import Sidebar from "./components/Sidebar";
import HeroSection from "./components/HeroSection";

function App() {
  return (
    <div className="app">

      <Sidebar />

      <main className="main-content">

        <header className="topbar">

          <div className="search">
            Search farms, equipment, or alerts...
          </div>

          <div className="location">
            <MapPin size={14} />
            Bengaluru, KA
          </div>

          <div className="user">
            P
          </div>

        </header>

        <HeroSection />

      </main>

    </div>
  );
}

export default App;