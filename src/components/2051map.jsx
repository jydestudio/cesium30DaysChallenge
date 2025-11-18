import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const FuturisticMap = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState({
    temp: 28,
    condition: "Partly Cloudy",
    icon: "🌤️",
    humidity: 65,
    windSpeed: 12,
    pressure: 1013,
    uvIndex: 7,
    forecast: [
      { time: "12 PM", temp: 28, icon: "☀️" },
      { time: "3 PM", temp: 30, icon: "☀️" },
      { time: "6 PM", temp: 27, icon: "🌤️" },
      { time: "9 PM", temp: 24, icon: "🌙" },
    ]
  });
  const [location] = useState({ lat: 4.8583, lng: 7.0059, name: "Port Harcourt, Nigeria" });
  const [systemStatus] = useState({
    satellites: 12,
    accuracy: 98,
    network: "5G Ultra"
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [location.lng, location.lat],
      zoom: 13,
      pitch: 60,
      bearing: -17.6,
    });

    mapRef.current = map;
    
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    
    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.innerHTML = '<div class="marker-pulse"></div>';
    
    new maplibregl.Marker({ element: el })
      .setLngLat([location.lng, location.lat])
      .addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [location]);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div ref={mapContainerRef} style={{ width: "100%", height: "100vh", position: "relative", background: "#000" }}>
      
      {/* Holographic HUD Overlay */}
      <div className="hud-corners">
        <div className="corner top-left"></div>
        <div className="corner top-right"></div>
        <div className="corner bottom-left"></div>
        <div className="corner bottom-right"></div>
      </div>

      {/* Scanning Line Effect */}
      <div className="scan-line"></div>

      {/* Main HUD Header */}
      <div className="hud-header">
        <div className="hud-section">
          <div className="system-badge">
            <span className="status-dot"></span>
            SYSTEM ONLINE
          </div>
          <div className="time-display">
            <div className="time-large">{formatTime(currentTime)}</div>
            <div className="date-small">{formatDate(currentTime)}</div>
          </div>
        </div>
        
        <div className="hud-section center">
          <div className="location-hud">
            <div className="location-icon-container">
              <div className="location-ring"></div>
              <div className="location-ring-2"></div>
              <span className="location-icon">📍</span>
            </div>
            <div className="location-info">
              <div className="location-name">{location.name}</div>
              <div className="location-coords">{location.lat.toFixed(4)}° N, {location.lng.toFixed(4)}° E</div>
            </div>
          </div>
        </div>

        <div className="hud-section right">
          <div className="system-stats">
            <div className="stat-mini">
              <span className="stat-icon">🛰️</span>
              <span className="stat-value">{systemStatus.satellites} SAT</span>
            </div>
            <div className="stat-mini">
              <span className="stat-icon">📶</span>
              <span className="stat-value">{systemStatus.network}</span>
            </div>
            <div className="stat-mini accuracy">
              <span className="stat-icon">🎯</span>
              <span className="stat-value">{systemStatus.accuracy}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Weather Console */}
      <div className="weather-console">
        <div className="console-header">
          <span className="console-title">METEOROLOGICAL DATA</span>
          <div className="signal-indicator">
            <span className="signal-bar"></span>
            <span className="signal-bar"></span>
            <span className="signal-bar"></span>
            <span className="signal-bar active"></span>
          </div>
        </div>

        <div className="weather-main-display">
          <div className="weather-visual">
            <div className="weather-icon-glow">{weather.icon}</div>
            <div className="temp-massive">{weather.temp}<span className="temp-unit">°C</span></div>
          </div>
          <div className="condition-text">{weather.condition}</div>
        </div>

        <div className="data-grid">
          <div className="data-cell">
            <div className="data-icon">💧</div>
            <div className="data-content">
              <div className="data-label">HUMIDITY</div>
              <div className="data-value">{weather.humidity}%</div>
              <div className="data-bar">
                <div className="data-bar-fill" style={{width: `${weather.humidity}%`}}></div>
              </div>
            </div>
          </div>

          <div className="data-cell">
            <div className="data-icon">💨</div>
            <div className="data-content">
              <div className="data-label">WIND SPEED</div>
              <div className="data-value">{weather.windSpeed} km/h</div>
              <div className="data-bar">
                <div className="data-bar-fill" style={{width: `${(weather.windSpeed/50)*100}%`}}></div>
              </div>
            </div>
          </div>

          <div className="data-cell">
            <div className="data-icon">🌡️</div>
            <div className="data-content">
              <div className="data-label">PRESSURE</div>
              <div className="data-value">{weather.pressure} hPa</div>
              <div className="data-bar">
                <div className="data-bar-fill" style={{width: '75%'}}></div>
              </div>
            </div>
          </div>

          <div className="data-cell">
            <div className="data-icon">☀️</div>
            <div className="data-content">
              <div className="data-label">UV INDEX</div>
              <div className="data-value">{weather.uvIndex}/10</div>
              <div className="data-bar">
                <div className="data-bar-fill high" style={{width: `${(weather.uvIndex/10)*100}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="forecast-panel">
          <div className="forecast-header">24H PROJECTION</div>
          <div className="forecast-timeline">
            {weather.forecast.map((item, idx) => (
              <div key={idx} className="forecast-node">
                <div className="forecast-time">{item.time}</div>
                <div className="forecast-visual">
                  <div className="forecast-icon-container">{item.icon}</div>
                  <div className="forecast-connector"></div>
                </div>
                <div className="forecast-temp">{item.temp}°</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Control Panel */}
      <div className="control-panel">
        <div className="panel-title">NAVIGATION CONTROL</div>
        <div className="control-grid">
          <button className="control-btn" onClick={() => mapRef.current?.flyTo({ 
            center: [location.lng, location.lat], 
            zoom: 13,
            pitch: 60,
            bearing: -17.6,
            duration: 2000
          })}>
            <div className="btn-glow"></div>
            <span className="btn-icon">🎯</span>
            <span className="btn-label">RECENTER</span>
          </button>

          <button className="control-btn" onClick={() => {
            const currentPitch = mapRef.current?.getPitch() || 0;
            mapRef.current?.easeTo({ pitch: currentPitch === 0 ? 60 : 0, duration: 1000 });
          }}>
            <div className="btn-glow"></div>
            <span className="btn-icon">🗺️</span>
            <span className="btn-label">3D VIEW</span>
          </button>

          <button className="control-btn" onClick={() => {
            const currentBearing = mapRef.current?.getBearing() || 0;
            mapRef.current?.rotateTo(currentBearing + 90, { duration: 1000 });
          }}>
            <div className="btn-glow"></div>
            <span className="btn-icon">🧭</span>
            <span className="btn-label">ROTATE</span>
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-item">
          <div className="status-dot active"></div>
          <span>NAVIGATION ACTIVE</span>
        </div>
        <div className="status-item">
          <div className="status-dot active"></div>
          <span>REAL-TIME TRACKING</span>
        </div>
        <div className="status-item">
          <div className="status-dot active"></div>
          <span>DATA SYNC ENABLED</span>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;900&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Orbitron', monospace;
        }

        /* Custom Marker */
        .custom-marker {
          width: 40px;
          height: 40px;
          position: relative;
        }

        .marker-pulse {
          position: absolute;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, rgba(0, 243, 255, 0.8) 0%, transparent 70%);
          border-radius: 50%;
          animation: pulse 2s ease-out infinite;
        }

        .marker-pulse::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 12px;
          height: 12px;
          background: #00f3ff;
          border-radius: 50%;
          box-shadow: 0 0 20px #00f3ff, 0 0 40px #00f3ff;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        /* HUD Corners */
        .hud-corners .corner {
          position: absolute;
          width: 60px;
          height: 60px;
          border: 2px solid #00f3ff;
          z-index: 1000;
          pointer-events: none;
        }

        .corner.top-left {
          top: 20px;
          left: 20px;
          border-right: none;
          border-bottom: none;
          box-shadow: -2px -2px 20px rgba(0, 243, 255, 0.5);
        }

        .corner.top-right {
          top: 20px;
          right: 20px;
          border-left: none;
          border-bottom: none;
          box-shadow: 2px -2px 20px rgba(0, 243, 255, 0.5);
        }

        .corner.bottom-left {
          bottom: 20px;
          left: 20px;
          border-right: none;
          border-top: none;
          box-shadow: -2px 2px 20px rgba(0, 243, 255, 0.5);
        }

        .corner.bottom-right {
          bottom: 20px;
          right: 20px;
          border-left: none;
          border-top: none;
          box-shadow: 2px 2px 20px rgba(0, 243, 255, 0.5);
        }

        /* Scanning Line */
        .scan-line {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #00f3ff, transparent);
          box-shadow: 0 0 20px #00f3ff;
          animation: scan 4s linear infinite;
          z-index: 999;
          pointer-events: none;
        }

        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }

        /* HUD Header */
        .hud-header {
          position: absolute;
          top: 40px;
          left: 100px;
          right: 100px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          z-index: 1001;
          gap: 40px;
        }

        .hud-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .hud-section.center {
          flex: 1;
          align-items: center;
        }

        .hud-section.right {
          align-items: flex-end;
        }

        .system-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 20px;
          background: rgba(0, 0, 0, 0.85);
          border: 1px solid #00f3ff;
          border-radius: 4px;
          color: #00f3ff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2px;
          box-shadow: 0 0 30px rgba(0, 243, 255, 0.3), inset 0 0 20px rgba(0, 243, 255, 0.1);
          animation: glowPulse 2s ease-in-out infinite;
        }

        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 30px rgba(0, 243, 255, 0.3), inset 0 0 20px rgba(0, 243, 255, 0.1); }
          50% { box-shadow: 0 0 50px rgba(0, 243, 255, 0.6), inset 0 0 30px rgba(0, 243, 255, 0.2); }
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: #00f3ff;
          border-radius: 50%;
          box-shadow: 0 0 10px #00f3ff;
          animation: blink 1.5s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .time-display {
          background: rgba(0, 0, 0, 0.9);
          padding: 16px 24px;
          border: 2px solid rgba(0, 243, 255, 0.5);
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }

        .time-display::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(0, 243, 255, 0.2), transparent);
          animation: shimmer 3s infinite;
        }

        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }

        .time-large {
          font-size: 36px;
          font-weight: 900;
          color: #00f3ff;
          letter-spacing: 4px;
          text-shadow: 0 0 20px #00f3ff, 0 0 40px #00f3ff;
          font-variant-numeric: tabular-nums;
        }

        .date-small {
          font-size: 10px;
          color: rgba(0, 243, 255, 0.7);
          letter-spacing: 2px;
          margin-top: 4px;
          text-transform: uppercase;
        }

        .location-hud {
          display: flex;
          align-items: center;
          gap: 20px;
          background: rgba(0, 0, 0, 0.9);
          padding: 20px 30px;
          border: 2px solid #ff00ff;
          border-radius: 4px;
          position: relative;
          box-shadow: 0 0 40px rgba(255, 0, 255, 0.4);
        }

        .location-icon-container {
          position: relative;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .location-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 2px solid #ff00ff;
          border-radius: 50%;
          animation: ringExpand 2s ease-out infinite;
        }

        .location-ring-2 {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 2px solid #ff00ff;
          border-radius: 50%;
          animation: ringExpand 2s ease-out infinite 1s;
        }

        @keyframes ringExpand {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        .location-icon {
          font-size: 24px;
          filter: drop-shadow(0 0 10px #ff00ff);
          position: relative;
          z-index: 2;
        }

        .location-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .location-name {
          font-size: 18px;
          font-weight: 700;
          color: #ff00ff;
          letter-spacing: 1px;
          text-transform: uppercase;
          text-shadow: 0 0 10px #ff00ff;
        }

        .location-coords {
          font-size: 11px;
          color: rgba(255, 0, 255, 0.7);
          font-weight: 400;
          letter-spacing: 1px;
        }

        .system-stats {
          display: flex;
          gap: 16px;
        }

        .stat-mini {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 0, 0, 0.85);
          padding: 10px 16px;
          border: 1px solid rgba(0, 243, 255, 0.5);
          border-radius: 4px;
          color: #00f3ff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .stat-mini.accuracy {
          border-color: #00ff88;
          color: #00ff88;
        }

        /* Weather Console */
        .weather-console {
          position: absolute;
          top: 180px;
          right: 40px;
          width: 420px;
          background: rgba(0, 0, 0, 0.95);
          border: 2px solid #00f3ff;
          border-radius: 4px;
          padding: 24px;
          z-index: 1001;
          box-shadow: 0 0 50px rgba(0, 243, 255, 0.4), inset 0 0 30px rgba(0, 243, 255, 0.05);
        }

        .console-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(0, 243, 255, 0.3);
        }

        .console-title {
          font-size: 11px;
          font-weight: 700;
          color: #00f3ff;
          letter-spacing: 3px;
        }

        .signal-indicator {
          display: flex;
          gap: 4px;
          align-items: flex-end;
        }

        .signal-bar {
          width: 4px;
          height: 12px;
          background: rgba(0, 243, 255, 0.3);
          border-radius: 2px;
        }

        .signal-bar:nth-child(2) { height: 16px; }
        .signal-bar:nth-child(3) { height: 20px; }
        .signal-bar:nth-child(4) { height: 24px; }

        .signal-bar.active {
          background: #00f3ff;
          box-shadow: 0 0 10px #00f3ff;
          animation: signalPulse 1s ease-in-out infinite;
        }

        @keyframes signalPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .weather-main-display {
          text-align: center;
          margin-bottom: 24px;
        }

        .weather-visual {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-bottom: 12px;
        }

        .weather-icon-glow {
          font-size: 72px;
          filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.8));
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .temp-massive {
          font-size: 72px;
          font-weight: 900;
          color: #ffffff;
          text-shadow: 0 0 30px rgba(255, 255, 255, 0.8);
          letter-spacing: -4px;
          line-height: 1;
        }

        .temp-unit {
          font-size: 36px;
          color: rgba(255, 255, 255, 0.6);
          margin-left: 4px;
        }

        .condition-text {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .data-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
        }

        .data-cell {
          display: flex;
          gap: 12px;
          background: rgba(0, 243, 255, 0.05);
          border: 1px solid rgba(0, 243, 255, 0.3);
          border-radius: 4px;
          padding: 12px;
          transition: all 0.3s ease;
        }

        .data-cell:hover {
          background: rgba(0, 243, 255, 0.1);
          border-color: #00f3ff;
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0, 243, 255, 0.3);
        }

        .data-icon {
          font-size: 24px;
        }

        .data-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .data-label {
          font-size: 9px;
          color: rgba(0, 243, 255, 0.7);
          letter-spacing: 1px;
          font-weight: 600;
        }

        .data-value {
          font-size: 16px;
          color: #ffffff;
          font-weight: 700;
        }

        .data-bar {
          height: 4px;
          background: rgba(0, 243, 255, 0.2);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 4px;
        }

        .data-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #00f3ff, #00ffaa);
          box-shadow: 0 0 10px #00f3ff;
          transition: width 0.5s ease;
        }

        .data-bar-fill.high {
          background: linear-gradient(90deg, #ff6b00, #ff0000);
          box-shadow: 0 0 10px #ff6b00;
        }

        .forecast-panel {
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(0, 243, 255, 0.3);
          border-radius: 4px;
          padding: 16px;
        }

        .forecast-header {
          font-size: 10px;
          color: #00f3ff;
          letter-spacing: 2px;
          margin-bottom: 16px;
          font-weight: 700;
        }

        .forecast-timeline {
          display: flex;
          justify-content: space-between;
          position: relative;
        }

        .forecast-timeline::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #00f3ff, transparent);
          z-index: 0;
        }

        .forecast-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          position: relative;
          z-index: 1;
        }

        .forecast-time {
          font-size: 10px;
          color: rgba(0, 243, 255, 0.7);
          font-weight: 600;
        }

        .forecast-visual {
          position: relative;
        }

        .forecast-icon-container {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          background: rgba(0, 0, 0, 0.8);
          border: 2px solid #00f3ff;
          border-radius: 50%;
          box-shadow: 0 0 20px rgba(0, 243, 255, 0.5);
        }

        .forecast-temp {
          font-size: 14px;
          color: #ffffff;
          font-weight: 700;
        }

        /* Control Panel */
        .control-panel {
          position: absolute;
          bottom: 100px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.95);
          border: 2px solid #ff00ff;
          border-radius: 4px;
          padding: 20px;
          z-index: 1001;
          box-shadow: 0 0 40px rgba(255, 0, 255, 0.4);
        }

        .panel-title {
          font-size: 11px;
          color: #ff00ff;
          letter-spacing: 3px;
          margin-bottom: 16px;
          font-weight: 700;
          text-align: center;
        }

        .control-grid {
          display: flex;
          gap: 16px;
        }

        .control-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          background: rgba(0, 0, 0, 0.8);
          border: 2px solid rgba(255, 0, 255, 0.5);
          border-radius: 4px;
          padding: 20px 28px;
          cursor: pointer;
          transition: all 0.3s ease;
          color: #ff00ff;
          overflow: hidden;
        }

        .btn-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 0;
          height: 0;
          background: radial-gradient(circle, rgba(255, 0, 255, 0.4), transparent);
          border-radius: 50%;
          transition: all 0.5s ease;
        }

        .control-btn:hover {
          border-color: #ff00ff;
          box-shadow: 0 0 30px rgba(255, 0, 255, 0.6);
          transform: translateY(-3px);
        }

        .control-btn:hover .btn-glow {
          width: 200px;
          height: 200px;
        }

        .control-btn:active {
          transform: translateY(-1px);
        }

        .btn-icon {
          font-size: 32px;
          filter: drop-shadow(0 0 10px #ff00ff);
        }

        .btn-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
        }

        /* Status Bar */
        .status-bar {
          position: absolute;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 24px;
          background: rgba(0, 0, 0, 0.9);
          border: 1px solid rgba(0, 255, 136, 0.5);
          border-radius: 4px;
          padding: 12px 24px;
          z-index: 1001;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          color: #00ff88;
          letter-spacing: 1px;
          font-weight: 600;
        }

        .status-item .status-dot {
          width: 6px;
          height: 6px;
          background: #00ff88;
          border-radius: 50%;
          box-shadow: 0 0 10px #00ff88;
        }

        .status-item .status-dot.active {
          animation: blink 1.5s infinite;
        }

        /* Responsive Design */
        @media (max-width: 1400px) {
          .hud-header {
            left: 80px;
            right: 80px;
          }
          
          .weather-console {
            width: 360px;
          }
        }

        @media (max-width: 1024px) {
          .hud-header {
            flex-direction: column;
            align-items: center;
            left: 20px;
            right: 20px;
          }

          .hud-section.right {
            align-items: center;
          }

          .weather-console {
            position: relative;
            top: auto;
            right: auto;
            margin: 20px auto;
            width: calc(100% - 40px);
            max-width: 420px;
          }

          .control-panel {
            bottom: 140px;
          }

          .control-grid {
            flex-wrap: wrap;
            justify-content: center;
          }

          .status-bar {
            flex-direction: column;
            gap: 8px;
            bottom: 20px;
          }

          .hud-corners .corner {
            width: 40px;
            height: 40px;
          }
        }

        /* Scrollbar Styling */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.5);
        }

        ::-webkit-scrollbar-thumb {
          background: #00f3ff;
          border-radius: 4px;
          box-shadow: 0 0 10px #00f3ff;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #ff00ff;
          box-shadow: 0 0 10px #ff00ff;
        }
      `}</style>
    </div>
  );
};

export default FuturisticMap;