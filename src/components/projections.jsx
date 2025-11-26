import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MapProjections = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Default to Globe
  const [currentProjection, setCurrentProjection] = useState("globe");
  const [showGraticule, setShowGraticule] = useState(true);
  const [graticuleSpacing, setGraticuleSpacing] = useState(15);

  const projections = [
    {
      id: "globe",
      name: "Globe",
      description: "True 3D sphere - Earth as it really is",
      icon: "🌐"
    },
    {
      id: "mercator",
      name: "Mercator",
      description: "Standard web map projection",
      icon: "🗺️"
    }
  ];

  const generateGraticule = (spacing = 15) => {
    const features = [];
    // Longitude lines
    for (let lon = -180; lon < 180; lon += spacing) {
      const coordinates = [];
      for (let lat = -90; lat <= 90; lat += 0.5) coordinates.push([lon, lat]);
      features.push({ type: "Feature", geometry: { type: "LineString", coordinates }, properties: { type: "meridian", value: lon } });
    }
    // Latitude lines
    for (let lat = -90; lat <= 90; lat += spacing) {
      const coordinates = [];
      for (let lon = -180; lon <= 180; lon += 0.5) coordinates.push([lon, lat]);
      features.push({ type: "Feature", geometry: { type: "LineString", coordinates }, properties: { type: "parallel", value: lat } });
    }
    // Equator/Prime Meridian
    features.push({ type: "Feature", geometry: { type: "LineString", coordinates: Array.from({ length: 721 }, (_, i) => [-180 + i * 0.5, 0]) }, properties: { type: "equator", value: 0 } });
    features.push({ type: "Feature", geometry: { type: "LineString", coordinates: Array.from({ length: 361 }, (_, i) => [0, -90 + i * 0.5]) }, properties: { type: "prime-meridian", value: 0 } });

    return { type: "FeatureCollection", features: features };
  };

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '© Esri'
          }
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#000000'
            }
          },
          {
            id: 'satellite',
            type: 'raster',
            source: 'raster-tiles',
            paint: {
              'raster-opacity': 0.85,
              'raster-brightness-min': 0.1,
              'raster-brightness-max': 0.9,
              'raster-saturation': 0.3
            }
          }
        ],
        sky: {
          'sky-color': '#0a0e27',
          'sky-horizon-blend': 0.1,
          'horizon-color': '#1a1f3f',
          'horizon-fog-blend': 0.5,
          'fog-color': '#2a3f7f',
          'fog-ground-blend': 0.7,
          'atmosphere-blend': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 1,
            6, 0.8,
            10, 0.5,
            12, 0
          ]
        },
        light: {
          anchor: 'viewport',
          color: '#ffffff',
          intensity: 0.5,
          position: [1.5, 90, 80]
        }
      },
      center: [0, 20],
      zoom: 1.5,
      projection: { type: currentProjection }
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      console.log("Map loaded!");
      
      // Add graticule source
      map.addSource("graticule", {
        type: "geojson",
        data: generateGraticule(graticuleSpacing)
      });

      // Add graticule lines layer
      map.addLayer({
        id: "graticule-lines",
        type: "line",
        source: "graticule",
        filter: ["in", ["get", "type"], ["literal", ["meridian", "parallel"]]],
        layout: {
          "line-join": "round",
          "line-cap": "round",
          "visibility": "visible"
        },
        paint: {
          "line-color": "#00ff88",
          "line-width": 2,
          "line-opacity": 0.8
        }
      });

      // Add special lines (equator and prime meridian)
      map.addLayer({
        id: "graticule-special",
        type: "line",
        source: "graticule",
        filter: ["in", ["get", "type"], ["literal", ["equator", "prime-meridian"]]],
        layout: {
          "line-join": "round",
          "line-cap": "round",
          "visibility": "visible"
        },
        paint: {
          "line-color": "#00d4ff",
          "line-width": 3.5,
          "line-opacity": 1
        }
      });

      console.log("Graticule layers added!");
      setIsMapReady(true);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update projection
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;
    
    try {
      // Use setProjection with proper object format
      map.setProjection({ type: currentProjection });
      console.log("Switched to", currentProjection, "projection");
    } catch (error) {
      console.error("Error switching projection:", error);
    }
  }, [currentProjection, isMapReady]);

  // Toggle visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    const visibility = showGraticule ? "visible" : "none";
    
    try {
      if (map.getLayer("graticule-lines")) {
        map.setLayoutProperty("graticule-lines", "visibility", visibility);
      }
      if (map.getLayer("graticule-special")) {
        map.setLayoutProperty("graticule-special", "visibility", visibility);
      }
    } catch (error) {
      console.error("Error toggling visibility:", error);
    }
  }, [showGraticule, isMapReady]);

  // Update spacing
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;
    
    const source = map.getSource("graticule");
    if (source) {
      source.setData(generateGraticule(graticuleSpacing));
    }
  }, [graticuleSpacing, isMapReady]);

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", background: "#1a1a2e" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      
      {/* Controls */}
      <div style={{ 
        position: "absolute", 
        top: 20, 
        left: 20, 
        zIndex: 10, 
        background: "rgba(255,255,255,0.95)", 
        backdropFilter: "blur(10px)",
        padding: "20px", 
        borderRadius: "12px",
        width: "280px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)"
      }}>
        <h3 style={{ margin: "0 0 15px 0", fontSize: "18px", color: "#2c3e50", fontWeight: "700" }}>Map Projection</h3>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: "10px", marginBottom: "20px" }}>
          {projections.map(p => (
            <button 
              key={p.id} 
              onClick={() => setCurrentProjection(p.id)}
              title={p.description}
              style={{ 
                flex: "1 0 100%",
                background: currentProjection === p.id ? '#3498db' : '#fff',
                color: currentProjection === p.id ? 'white' : '#34495e',
                border: currentProjection === p.id ? 'none' : '2px solid #ecf0f1',
                padding: '12px 16px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '10px',
                transition: 'all 0.2s',
                boxShadow: currentProjection === p.id ? '0 3px 8px rgba(52, 152, 219, 0.4)' : 'none'
              }}
            >
              <span style={{ fontSize: '20px' }}>{p.icon}</span> 
              <div style={{ textAlign: 'left' }}>
                <div>{p.name}</div>
                <div style={{ fontSize: '11px', opacity: 0.8, fontWeight: '400' }}>{p.description}</div>
              </div>
            </button>
          ))}
        </div>
        
        {/* <div style={{ borderTop: "2px solid #ecf0f1", paddingTop: "15px" }}>
           <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#2c3e50", fontWeight: "600" }}>Grid Settings</h3>
           <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
             <button 
               onClick={() => setShowGraticule(!showGraticule)}
               style={{
                 width: "100%",
                 padding: "10px",
                 background: showGraticule ? "#27ae60" : "#95a5a6",
                 color: "white",
                 border: "none",
                 borderRadius: "8px",
                 fontWeight: "700",
                 fontSize: "14px",
                 cursor: "pointer",
                 transition: "all 0.2s",
                 boxShadow: showGraticule ? "0 3px 8px rgba(39, 174, 96, 0.3)" : "none"
               }}
             >
               {showGraticule ? "✅ Grid Visible" : "❌ Grid Hidden"}
             </button>
             
             {showGraticule && (
               <div style={{fontSize: '13px', color: '#7f8c8d', padding: '8px', background: '#f8f9fa', borderRadius: '6px'}}>
                 <div style={{ marginBottom: '8px', fontWeight: '600', color: '#2c3e50' }}>
                   Grid Spacing: <strong style={{ color: '#3498db' }}>{graticuleSpacing}°</strong>
                 </div>
                 <input 
                   type="range" 
                   min="5" max="30" step="5" 
                   value={graticuleSpacing}
                   onChange={(e) => setGraticuleSpacing(Number(e.target.value))}
                   style={{width: '100%', cursor: 'pointer'}}
                 />
               </div>
             )}
           </div>
        </div> */}
      </div>
    </div>
  );
};

export default MapProjections;