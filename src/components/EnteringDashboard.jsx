import "./EnteringDashboard.css";
import solarBackgroundVideo from "../assets/backgrounds/solar_v.mp4";
import { Sun } from 'lucide-react';
import {Home, Info, Phone} from "lucide-react";
import {useNavigate} from "react-router-dom";
import AboutSection from "./AboutSection";
import { useRef } from "react";

function EnteringDashboard({onEnter}) {
  const aboutRef = useRef(null);
  const scrollToAbout = () => {
    if (aboutRef.current) {
      aboutRef.current.scrollIntoView({ behavior: "smooth",block: "start" });
    }
  };
  const navigate = useNavigate();
  return (
    <div className="landing-page">
    <section className="entering-dashboard"> 
    <video 
      className="background-video"
      autoPlay
      loop
      muted
      playsInline
    >
      <source src={solarBackgroundVideo} type="video/mp4" />
    </video>

    <div className="video-overlay"></div>
      <nav className="nav-bar">
        <div className="nav-logo">
        <span className="logo">
          <div className="logo-design"><Sun  /></div>
          <h3>SolarGrid</h3></span>
        </div>
        <div className="nav-content">
        <span className="nav-link"><Home />Home</span>
        <span className="nav-link" onClick={scrollToAbout} style={{cursor:"pointer"}}><Info />About</span>
        <span className="nav-link"><Phone />Contact</span>
        </div>
      </nav>

      <div className="entry-content">
        <h1>SolarGrid</h1>
        <p>Solar Plant Monitoring &amp; Performance Analytics</p>

        <button className="cta-button" onClick={onEnter}>
          Enter Dashboard →
        </button>
      </div>
    </section>
    <div ref={aboutRef}>
      <AboutSection onEnter={onEnter} />
    </div>
    </div>
  );
}

export default EnteringDashboard;