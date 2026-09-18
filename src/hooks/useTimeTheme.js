import { useEffect, useState } from "react";

function getTimeTheme() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 7) {
    return "dawn";
  }

  if (hour >= 7 && hour < 11) {
    return "morning";
  }

  if (hour >= 11 && hour < 15) {
    return "afternoon";
  }

  if (hour >= 15 && hour < 18) {
    return "evening";
  }

  if (hour >= 18 && hour < 20) {
    return "dusk";
  }

  return "night";
}

export function useTimeTheme() {
  const [timeTheme, setTimeTheme] = useState(getTimeTheme);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setTimeTheme(getTimeTheme());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return {
    timeTheme,
    currentTime,
  };
}