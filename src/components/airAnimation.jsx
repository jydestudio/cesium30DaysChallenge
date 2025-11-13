// src/components/WindMap.jsx
import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const WindMap = () => {
  const mapContainer = useRef(null);
  const canvasRef = useRef(null);
  const mapRef = useRef(null);

  const CONFIG = {
    PARTICLE_COUNT: 3000,
    OPACITY_FADE: 0.90,  // Controls trail length (higher = longer trail)
    SPEED: 0.5,
    COLORS: ['rgba(255, 255, 255, 0.8)', 'rgba(100, 150, 255, 0.6)', 'rgba(50, 100, 200, 0.5)'] 
  };

  // --- 1. Wind Physics (Simulated) ---
  const getWind = (lat, lon, time) => {
    // A simple math model to create a swirling/wavy pattern across the globe
    const u = Math.sin(lat * 0.05 + time) + Math.sin(lon * 0.05 + time);
    const v = Math.cos(lon * 0.05 + time) + Math.cos(lat * 0.05);
    const m = Math.sqrt(u*u + v*v);
    return { u, v, m }; // u=East-West velocity, v=North-South velocity, m=Magnitude (speed)
  };

  useEffect(() => {
    if (!mapContainer.current) return;

    // 1. Initialize Map with Globe Projection
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [0, 20],
      zoom: 1.5,
      pitch: 0,
      renderWorldCopies: false,
      antialias: true
    });

    mapRef.current = map;

    // Set globe projection after style loads
    map.on('style.load', () => {
      map.setProjection({ type: 'globe' });
    });

    // 2. Setup Canvas Layer
    map.on('load', () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Sync Canvas Size with Map
      const resizeCanvas = () => {
        if(mapContainer.current) {
          canvas.width = mapContainer.current.clientWidth;
          canvas.height = mapContainer.current.clientHeight;
        }
      };
      resizeCanvas();
      map.on('resize', resizeCanvas);

      // Initialize Particles
      const particles = [];
      for(let i=0; i<CONFIG.PARTICLE_COUNT; i++) {
        particles.push({
          lon: Math.random() * 360 - 180,
          lat: Math.random() * 160 - 80, // -80 to 80
          age: Math.random() * 100
        });
      }

      // 3. Animation Loop
      const animate = () => {
        const time = Date.now() * 0.001;
        
        // A. Fade Effect (The "Ghosting" trick for trails)
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.OPACITY_FADE})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // B. Draw New Lines
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 1.5;

        particles.forEach(p => {
          // Calculate movement
          const wind = getWind(p.lat, p.lon, time);
          const nextLon = p.lon + wind.u * CONFIG.SPEED;
          const nextLat = p.lat + wind.v * CONFIG.SPEED;

          // Project to Screen Pixels (MapLibre's reliable coordinate converter)
          const p1 = map.project([p.lon, p.lat]);
          const p2 = map.project([nextLon, nextLat]);

          // Draw logic (only if visible and valid movement)
          if (p1.x >= 0 && p1.x <= canvas.width && p1.y >= 0 && p1.y <= canvas.height) {
            ctx.beginPath();
            
            // Color based on speed magnitude
            ctx.strokeStyle = wind.m > 1.5 ? CONFIG.COLORS[0] : 
                             wind.m > 1.0 ? CONFIG.COLORS[1] : CONFIG.COLORS[2];
            
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }

          // --- FIXED: Update Position and Clamp Latitude ---
          // Wrap longitude around
          p.lon = ((nextLon + 180) % 360) - 180;

          // CLAMP: Ensures latitude stays between -85 and 85 to prevent the LngLat error.
          p.lat = Math.max(-85, Math.min(85, nextLat));
          p.age++;

          // Reset dead/old particles or if they reach poles
          if (p.age > 100 || Math.random() < 0.01 || Math.abs(p.lat) > 84) {
            p.lon = Math.random() * 360 - 180;
            p.lat = (Math.random() * 140) - 70; // -70 to 70 (safe range)
            p.age = 0;
          }
        });

        requestAnimationFrame(animate);
      };

      animate();
    });

    // Cleanup
    return () => map.remove();
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none', // Allows map interaction
          zIndex: 2
        }}
      />
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 3,
        background: 'rgba(0,0,0,0.6)', color: 'white', padding: '10px', borderRadius: '4px'
      }}>
        <h3>Global Wind Particle Map (MapLibre)</h3>
      </div>
    </div>
  );
};

export default WindMap;