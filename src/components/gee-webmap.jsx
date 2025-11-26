import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MapProjections = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [currentProjection, setCurrentProjection] = useState("mercator");
  const [showGraticule, setShowGraticule] = useState(true);
  const [graticuleSpacing, setGraticuleSpacing] = useState(15);

  const projections = [
    {
      id: "mercator",
      name: "Mercator",
      description: "Classic flat projection - distorts size at poles",
      icon: "🌍"
    },
    {
      id: "globe",
      name: "Globe (3D)",
      description: "True 3D sphere representation of Earth",
      icon: "🌐"
    }
  ];

  // Generate graticule lines (lat/lon grid)
  const generateGraticule = (spacing = 15) => {
    const features = [];

    // Longitude lines (meridians) - vertical lines
    for (let lon = -180; lon <= 180; lon += spacing) {
      const coordinates = [];
      for (let lat = -90; lat <= 90; lat += 0.5) {
        coordinates.push([lon, lat]);
      }
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: coordinates
        },
        properties: { type: "meridian", value: lon }
      });
    }

    // Latitude lines (parallels) - horizontal lines
    for (let lat = -90; lat <= 90; lat += spacing) {
      const coordinates = [];
      for (let lon = -180; lon <= 180; lon += 0.5) {
        coordinates.push([lon, lat]);
      }
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: coordinates
        },
        properties: { type: "parallel", value: lat }
      });
    }

    // Add equator and prime meridian as special lines
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: Array.from({ length: 721 }, (_, i) => [-180 + i * 0.5, 0])
      },
      properties: { type: "equator", value: 0 }
    });

    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: Array.from({ length: 361 }, (_, i) => [0, -90 + i * 0.5])
      },
      properties: { type: "prime-meridian", value: 0 }
    });

    return {
      type: "FeatureCollection",
      features: features
    };
  };

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [0, 30],
      zoom: 1.5,
      projection: currentProjection
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      // Add graticule source
      map.addSource("graticule", {
        type: "geojson",
        data: generateGraticule(graticuleSpacing)
      });

      // Add graticule layer with different styles for special lines
      map.addLayer({
        id: "graticule-lines",
        type: "line",
        source: "graticule",
        filter: ["in", ["get", "type"], ["literal", ["meridian", "parallel"]]],
        paint: {
          "line-color": "#FF6B6B",
          "line-width": 1,
          "line-opacity": 0.4
        }
      });

      // Highlight equator and prime meridian
      map.addLayer({
        id: "graticule-special",
        type: "line",
        source: "graticule",
        filter: ["in", ["get", "type"], ["literal", ["equator", "prime-meridian"]]],
        paint: {
          "line-color": "#4299e1",
          "line-width": 2,
          "line-opacity": 0.7
        }
      });

      // Add labels for meridians (vertical lines)
      map.addLayer({
        id: "graticule-labels-meridians",
        type: "symbol",
        source: "graticule",
        filter: ["==", ["get", "type"], "meridian"],
        layout: {
          "text-field": ["concat", ["get", "value"], "°"],
          "text-size": 11,
          "text-font": ["Open Sans Regular"],
          "symbol-placement": "line",
          "text-rotation-alignment": "map"
        },
        paint: {
          "text-color": "#FF6B6B",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1
        }
      });

      // Add labels for parallels (horizontal lines)
      map.addLayer({
        id: "graticule-labels-parallels",
        type: "symbol",
        source: "graticule",
        filter: ["==", ["get", "type"], "parallel"],
        layout: {
          "text-field": ["concat", ["get", "value"], "°"],
          "text-size": 11,
          "text-font": ["Open Sans Regular"],
          "symbol-placement": "line",
          "text-rotation-alignment": "map"
        },
        paint: {
          "text-color": "#4299e1",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1
        }
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update projection
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    try {
      map.setProjection(currentProjection);
      console.log(`Switched to ${currentProjection} projection`);
    } catch (error) {
      console.error("Error switching projection:", error);
    }
  }, [currentProjection]);

  // Toggle graticule visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("graticule-lines")) return;

    const visibility = showGraticule ? "visible" : "none";
    
    map.setLayoutProperty("graticule-lines", "visibility", visibility);
    map.setLayoutProperty("graticule-special", "visibility", visibility);
    map.setLayoutProperty("graticule-labels-meridians", "visibility", visibility);
    map.setLayoutProperty("graticule-labels-parallels", "visibility", visibility);
  }, [showGraticule]);

  // Update graticule spacing
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("graticule")) return;

    map.getSource("graticule").setData(generateGraticule(graticuleSpacing));
  }, [graticuleSpacing]);

  const handleProjectionChange = (projectionId) => {
    setCurrentProjection(projectionId);
  };

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Control Panel */}
      <div style={{
        position: "absolute",
        top: "20px",
        left: "20px",
        background: "rgba(255, 255, 255, 0.95)",
        padding: "20px",
        borderRadius: "12px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
        maxWidth: "320px",
        maxHeight: "90vh",
        overflowY: "auto",
        zIndex: 1000,
        backdropFilter: "blur(10px)"
      }}>
        <h2 style={{
          margin: "0 0 16px 0",
          fontSize: "20px",
          fontWeight: "700",
          color: "#2d3748"
        }}>
          🗺️ Map Projections
        </h2>

        <div style={{
          marginBottom: "20px",
          padding: "12px",
          background: "#f7fafc",
          borderRadius: "8px",
          borderLeft: "4px solid #4299e1"
        }}>
          <div style={{ fontSize: "13px", color: "#4a5568", marginBottom: "4px" }}>
            Current Projection
          </div>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "#2d3748" }}>
            {projections.find(p => p.id === currentProjection)?.name}
          </div>
          <div style={{ fontSize: "12px", color: "#718096", marginTop: "4px" }}>
            {projections.find(p => p.id === currentProjection)?.description}
          </div>
        </div>

        {/* Projection Buttons */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginBottom: "20px"
        }}>
          {projections.map((proj) => (
            <button
              key={proj.id}
              onClick={() => handleProjectionChange(proj.id)}
              style={{
                padding: "12px 16px",
                background: currentProjection === proj.id ? "#4299e1" : "#ffffff",
                color: currentProjection === proj.id ? "#ffffff" : "#2d3748",
                border: currentProjection === proj.id ? "none" : "2px solid #e2e8f0",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                textAlign: "left",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}
              onMouseEnter={(e) => {
                if (currentProjection !== proj.id) {
                  e.target.style.background = "#edf2f7";
                  e.target.style.transform = "translateX(4px)";
                }
              }}
              onMouseLeave={(e) => {
                if (currentProjection !== proj.id) {
                  e.target.style.background = "#ffffff";
                  e.target.style.transform = "translateX(0)";
                }
              }}
            >
              <span style={{ fontSize: "20px" }}>{proj.icon}</span>
              <span>{proj.name}</span>
            </button>
          ))}
        </div>

        {/* Graticule Controls */}
        <div style={{
          padding: "16px",
          background: "#f7fafc",
          borderRadius: "8px",
          marginBottom: "16px"
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px"
          }}>
            <label style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#2d3748"
            }}>
              Show Graticule
            </label>
            <button
              onClick={() => setShowGraticule(!showGraticule)}
              style={{
                padding: "6px 12px",
                background: showGraticule ? "#48bb78" : "#e2e8f0",
                color: showGraticule ? "#ffffff" : "#4a5568",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600",
                transition: "all 0.2s ease"
              }}
            >
              {showGraticule ? "ON" : "OFF"}
            </button>
          </div>

          {showGraticule && (
            <div>
              <label style={{
                fontSize: "13px",
                color: "#4a5568",
                display: "block",
                marginBottom: "8px"
              }}>
                Grid Spacing: <span style={{ fontWeight: "600", color: "#2d3748" }}>{graticuleSpacing}°</span>
              </label>
              <input
                type="range"
                min="5"
                max="30"
                step="5"
                value={graticuleSpacing}
                onChange={(e) => setGraticuleSpacing(Number(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: "#4299e1",
                  cursor: "pointer"
                }}
              />
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11px",
                color: "#718096",
                marginTop: "4px"
              }}>
                <span>Fine (5°)</span>
                <span>Coarse (30°)</span>
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div style={{
          padding: "12px",
          background: "#fef5e7",
          borderRadius: "8px",
          fontSize: "12px",
          color: "#744210",
          lineHeight: "1.5"
        }}>
          <strong>💡 Tip:</strong> Toggle between Mercator (flat) and Globe (3D sphere) to see how the red graticule lines transform! 
          <br/><br/>
          <strong>🔴 Red lines:</strong> Regular lat/lon grid<br/>
          <strong>🔵 Blue labels:</strong> Latitude markers
        </div>
      </div>

      {/* Legend */}
      <div style={{
        position: "absolute",
        bottom: "20px",
        right: "20px",
        background: "rgba(255, 255, 255, 0.95)",
        padding: "16px",
        borderRadius: "8px",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
        fontSize: "12px",
        color: "#4a5568",
        backdropFilter: "blur(10px)"
      }}>
        <div style={{ fontWeight: "600", marginBottom: "8px", color: "#2d3748" }}>
          Legend
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "20px",
              height: "2px",
              background: "#FF6B6B",
              opacity: 0.4
            }} />
            <span>Meridians & Parallels</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "20px",
              height: "2px",
              background: "#4299e1",
              opacity: 0.7
            }} />
            <span>Equator & Prime Meridian</span>
          </div>
        </div>
      </div>

      <style>{`
        div::-webkit-scrollbar {
          width: 6px;
        }
        div::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }
      `}</style> 
    </div>
  );
};

export default MapProjections;