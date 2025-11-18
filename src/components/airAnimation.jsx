// src/components/WindMap.jsx
import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const WindMap = () => {
  const mapContainer = useRef(null);
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const windDataRef = useRef([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const CONFIG = {
    PARTICLE_COUNT: 3000,
    OPACITY_FADE: 0.90,  // Controls trail length (higher = longer trail)
    SPEED: 0.1,  // Reduced for real wind data
    COLORS: [
      'rgba(255, 0, 0, 0.8)',  // White (fast wind)
      'rgba(200, 255, 0, 1)',  // Light blue (medium wind)
      'rgba(17, 79, 202, 0.5)'    // Blue (slow wind)
    ],
    OPENWEATHER_API_KEY: '4a8602e18c19a44f872095208acbc7f3' // Replace with your OpenWeatherMap API key
  };

  // --- 1. Fetch Real Wind Data from OpenWeatherMap ---
  const fetchWindData = async (bounds) => {
    if (!bounds) return;

    setIsLoading(true);
    const { _sw, _ne } = bounds;

    // Grid resolution based on zoom level
    const zoom = mapRef.current.getZoom();
    const gridSize = zoom > 4 ? 15 : zoom > 2 ? 10 : 8;

    const latStep = (_ne.lat - _sw.lat) / gridSize;
    const lonStep = (_ne.lng - _sw.lng) / gridSize;

    const windData = [];

    try {
      // Fetch wind data for grid points within bounds
      for (let lat = _sw.lat; lat <= _ne.lat; lat += latStep) {
        for (let lon = _sw.lng; lon <= _ne.lng; lon += lonStep) {
          const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${CONFIG.OPENWEATHER_API_KEY}`;

          try {
            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              if (data.wind) {
                windData.push({
                  lat,
                  lon,
                  speed: data.wind.speed || 0,
                  deg: data.wind.deg || 0,
                  u: -(data.wind.speed || 0) * Math.sin((data.wind.deg || 0) * Math.PI / 180),
                  v: -(data.wind.speed || 0) * Math.cos((data.wind.deg || 0) * Math.PI / 180)
                });
              }
            }
          } catch (err) {
            console.warn('Failed to fetch weather for point:', lat, lon);
          }

          // Rate limiting - small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      windDataRef.current = windData;
      setLastUpdate(new Date());
      console.log(`Fetched ${windData.length} wind data points`);
    } catch (error) {
      console.error('Error fetching wind data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. Interpolate Wind Data using Inverse Distance Weighting (IDW) ---
  const getWindAtPoint = (lat, lon) => {
    const data = windDataRef.current;

    if (!data || data.length === 0) {
      // Fallback to simulated wind if no data
      const time = Date.now() * 0.001;
      const u = Math.sin(lat * 0.05 + time) + Math.sin(lon * 0.05 + time);
      const v = Math.cos(lon * 0.05 + time) + Math.cos(lat * 0.05);
      const m = Math.sqrt(u*u + v*v);
      return { u, v, m };
    }

    // Find nearby points for interpolation
    let weightedU = 0;
    let weightedV = 0;
    let totalWeight = 0;

    // Use 4 nearest points for better performance
    const distances = data.map(point => ({
      ...point,
      dist: Math.sqrt(
        Math.pow(point.lat - lat, 2) +
        Math.pow(point.lon - lon, 2)
      )
    })).sort((a, b) => a.dist - b.dist).slice(0, 4);

    distances.forEach(point => {
      if (point.dist < 0.01) {
        // Very close to a data point, use it directly
        return { u: point.u, v: point.v, m: point.speed };
      }

      const weight = 1 / (point.dist * point.dist + 0.01);
      weightedU += point.u * weight;
      weightedV += point.v * weight;
      totalWeight += weight;
    });

    if (totalWeight > 0) {
      const u = weightedU / totalWeight;
      const v = weightedV / totalWeight;
      const m = Math.sqrt(u*u + v*v);
      return { u, v, m };
    }

    return { u: 0, v: 0, m: 0 };
  };

  useEffect(() => {
    if (!mapContainer.current) return;

    // 1. Initialize Map with Globe Projection
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
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

      // Initialize Particles within current bounds
      const initParticles = () => {
        const bounds = map.getBounds();
        const particles = [];
        for(let i=0; i<CONFIG.PARTICLE_COUNT; i++) {
          particles.push({
            lon: bounds._sw.lng + Math.random() * (bounds._ne.lng - bounds._sw.lng),
            lat: Math.max(-80, Math.min(80, bounds._sw.lat + Math.random() * (bounds._ne.lat - bounds._sw.lat))),
            age: Math.random() * 100
          });
        }
        return particles;
      };

      let particles = initParticles();

      // Fetch initial wind data
      fetchWindData(map.getBounds());

      // --- 3. Update wind data on map move/zoom (with debounce) ---
      let moveTimeout;
      const handleMoveEnd = () => {
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(() => {
          fetchWindData(map.getBounds());
          // Reinitialize particles within new bounds
          particles = initParticles();
        }, 500); // Wait 500ms after user stops moving
      };

      map.on('moveend', handleMoveEnd);
      map.on('zoomend', handleMoveEnd);

      // 4. Animation Loop
      const animate = () => {
        // A. Fade Effect (The "Ghosting" trick for trails)
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.OPACITY_FADE})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // B. Draw New Lines
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 1.5;

        const bounds = map.getBounds();

        particles.forEach(p => {
          // Calculate movement using real wind data
          const wind = getWindAtPoint(p.lat, p.lon);
          const nextLon = p.lon + wind.u * CONFIG.SPEED;
          const nextLat = p.lat + wind.v * CONFIG.SPEED;

          // Project to Screen Pixels (MapLibre's reliable coordinate converter)
          const p1 = map.project([p.lon, p.lat]);
          const p2 = map.project([nextLon, nextLat]);

          // Draw logic (only if visible and valid movement)
          if (p1.x >= 0 && p1.x <= canvas.width && p1.y >= 0 && p1.y <= canvas.height) {
            ctx.beginPath();

            // Color based on wind speed (real m/s values)
            ctx.strokeStyle = wind.m > 10 ? CONFIG.COLORS[0] :
                             wind.m > 5 ? CONFIG.COLORS[1] : CONFIG.COLORS[2];

            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }

          // --- Update Position and Clamp Latitude ---
          // Wrap longitude around
          p.lon = ((nextLon + 180) % 360) - 180;

          // CLAMP: Ensures latitude stays between -85 and 85 to prevent the LngLat error.
          p.lat = Math.max(-85, Math.min(85, nextLat));
          p.age++;

          // Reset particles that leave bounds, get too old, or reach poles
          const outOfBounds = p.lon < bounds._sw.lng || p.lon > bounds._ne.lng ||
                              p.lat < bounds._sw.lat || p.lat > bounds._ne.lat;

          if (p.age > 100 || Math.random() < 0.005 || Math.abs(p.lat) > 84 || outOfBounds) {
            p.lon = bounds._sw.lng + Math.random() * (bounds._ne.lng - bounds._sw.lng);
            p.lat = Math.max(-80, Math.min(80, bounds._sw.lat + Math.random() * (bounds._ne.lat - bounds._sw.lat)));
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
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '12px',
        borderRadius: '6px',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
          🌍 Real-Time Wind Animation
        </h3>
        <div style={{ fontSize: '11px', opacity: 0.9 }}>
          {isLoading ? (
            <div>⏳ Loading wind data...</div>
          ) : windDataRef.current.length > 0 ? (
            <>
              <div>✓ {windDataRef.current.length} data points</div>
              {lastUpdate && (
                <div>Updated: {lastUpdate.toLocaleTimeString()}</div>
              )}
            </>
          ) : (
            <div>Using simulated wind data</div>
          )}
          <div style={{ marginTop: '6px', opacity: 0.7 }}>
            💡 Zoom/pan to load data for that area
          </div>
        </div>
      </div>
    </div>
  );
};

export default WindMap;