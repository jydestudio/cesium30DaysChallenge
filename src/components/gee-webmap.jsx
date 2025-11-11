import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// NOTE: This component assumes 'ee' is loaded globally via script tag in index.html.
// You MUST register this CLIENT_ID with Google Cloud and enable the Earth Engine API.
const CLIENT_ID = "941915183963-2e2brgg5pgr7vp29ip7g7n1onp19p93l.apps.googleusercontent.com";

function GeeWebMap({ id = "gee-map", style = {}, onReady }) {
  const mapContainerRef = useRef(null);
  const [authStatus, setAuthStatus] = useState("loading");
  const [error, setError] = useState(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    // Check for Earth Engine library
    const checkLibraries = () => {
      if (typeof ee !== "undefined") {
        console.log("✅ Earth Engine library loaded");
        checkAuthentication();
      } else {
        console.log("⏳ Waiting for Earth Engine library...");
        setTimeout(checkLibraries, 100);
      }
    };

    checkLibraries();
  }, []);

  // --- Auth & Initialization Logic ---

  const checkAuthentication = () => {
    setAuthStatus("checking");
    
    try {
      const token = ee.data.getAuthToken();
      
      if (token) {
        console.log("✅ Auth token found. Proceeding with saved credentials.");
        setAuthStatus("authenticated");
        initializeEarthEngine();
      } else {
        console.log("⚠️ No auth token found. Sign-in required.");
        setAuthStatus("needs_auth");
      }
    } catch (err) {
      console.log("⚠️ Auth check failed, needs authentication");
      setAuthStatus("needs_auth");
    }
  };

  const initializeEarthEngine = () => {
    setAuthStatus("initializing");
    console.log("Starting Earth Engine initialization...");
    
    ee.initialize(
      null,
      null,
      () => {
        console.log("✅ Earth Engine initialized");
        loadMap();
      },
      (err) => {
        console.error("❌ EE Initialization error:", err);
        setError(`Initialization failed: ${err.message}`);
        setAuthStatus("error");
      }
    );
  };

  const handleAuthenticate = () => {
    if (!CLIENT_ID) {
      setError("CLIENT_ID is missing!");
      return;
    }

    setAuthStatus("authenticating");
    setError(null);

    console.log("🔐 Starting authentication with CLIENT_ID:", CLIENT_ID);

    ee.data.authenticateViaOauth(
      CLIENT_ID,
      () => {
        console.log("✅ OAuth authentication successful");
        setAuthStatus("authenticated");
        initializeEarthEngine();
      },
      (err) => {
        console.error("❌ OAuth authentication failed:", err);
        setError(`Authentication failed: ${err}`);
        setAuthStatus("error");
      }
    );
  };

  // --- Map Loading Logic with MapLibre ---

  const loadMap = () => {
    const el = mapContainerRef.current;
    if (!el) {
      setError("Map container not found");
      setAuthStatus("error");
      return;
    }

    try {
      setAuthStatus("loading_map");
      
      // Create MapLibre map with free OpenStreetMap tiles
      const map = new maplibregl.Map({
        container: el,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "&copy; OpenStreetMap Contributors",
              maxzoom: 19
            }
          },
          layers: [
            {
              id: "osm",
              type: "raster",
              source: "osm"
            }
          ]
        },
        center: [-98.5, 38.5],
        zoom: 4
      });

      // Add navigation controls
      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      mapInstanceRef.current = map;

      // Wait for map to load before adding Earth Engine layer
      map.on('load', () => {
        console.log("✅ MapLibre map loaded");
        
        // Load Landsat 1984 False Color
        const image = ee.ImageCollection('LANDSAT/LT5_L1T_TOA')
          .filterDate('1984-01-01', '1984-12-31')
          .median();

        const falseColorVis = {
          min: 0.0,
          max: 0.4,
          bands: ['B4', 'B3', 'B2'],
        };

        console.log("📊 Getting Earth Engine map ID for Landsat 1984...");

        image.getMap(falseColorVis, (mapInfo) => {
          if (!mapInfo || mapInfo.error) {
            console.error("❌ GEE getMap error:", mapInfo.error);
            setError(`Error from GEE: ${mapInfo.error?.message || 'Check browser console for details.'}`);
            setAuthStatus("error");
            return;
          }

          const eeTileUrl = mapInfo.urlTemplate;
          
          // Add Earth Engine layer as a raster source
          map.addSource('ee-landsat', {
            type: 'raster',
            tiles: [eeTileUrl],
            tileSize: 256
          });

          map.addLayer({
            id: 'ee-landsat-layer',
            type: 'raster',
            source: 'ee-landsat',
            paint: {
              'raster-opacity': 0.8
            }
          });

          setAuthStatus("ready");
          console.log("✅ Map loaded successfully with Earth Engine layer");
          
          if (onReady) onReady(map);
        });
      });

    } catch (err) {
      console.error("❌ Map creation/loading error:", err);
      setError(`Map error: ${err.message}`);
      setAuthStatus("error");
    }
  };

  // --- Styling and Overlay Rendering ---
  const containerStyle = {
    width: "100%",
    height: "400px",
    position: "relative",
    backgroundColor: "#e8e8e8",
    ...style
  };

  const overlayStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    zIndex: 1000,
    padding: "20px"
  };

  const buttonStyle = {
    marginTop: "16px",
    padding: "12px 24px",
    backgroundColor: "#4285f4",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "500",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
  };

  const renderOverlay = () => {
    switch (authStatus) {
      case "loading":
      case "checking":
        return (
          <div style={overlayStyle}>
            <p style={{ fontSize: "18px", margin: 0 }}>Checking status...</p>
          </div>
        );
      
      case "needs_auth":
        return (
          <div style={overlayStyle}>
            <p style={{ fontSize: "18px", marginBottom: "8px" }}>🔐 Authentication Required</p>
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "16px" }}>
              Sign in with Google to access Earth Engine
            </p>
            <button onClick={handleAuthenticate} style={buttonStyle}>
              Sign in with Google
            </button>
          </div>
        );
      
      case "authenticating":
      case "initializing":
        return (
          <div style={overlayStyle}>
            <p style={{ fontSize: "18px", margin: 0 }}>Processing authentication...</p>
          </div>
        );
      
      case "loading_map":
        return (
          <div style={overlayStyle}>
            <p style={{ fontSize: "18px", margin: 0 }}>Loading map data...</p>
          </div>
        );
      
      case "error":
        return (
          <div style={overlayStyle}>
            <p style={{ fontSize: "18px", color: "#c4281b", marginBottom: "8px" }}>⚠️ Error</p>
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "16px", maxWidth: "400px", textAlign: "center" }}>
              {error}
            </p>
            <button 
              onClick={() => {
                setError(null);
                checkAuthentication();
              }} 
              style={buttonStyle}
            >
              Retry
            </button>
          </div>
        );
      
      case "ready":
        return null;
      
      default:
        return null;
    }
  };

  return (
    <div style={containerStyle}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      {renderOverlay()}
    </div>
  );
}

GeeWebMap.propTypes = {
  id: PropTypes.string,
  style: PropTypes.object,
  onReady: PropTypes.func,
};

export default GeeWebMap;