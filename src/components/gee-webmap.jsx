import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const API_BASE_URL = 'http://localhost:5000/api';

function GeeWebMap({ style = {}, onReady }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [currentLayer, setCurrentLayer] = useState('lulc');
  const [isBackendReady, setIsBackendReady] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Current boundary geometry (for clipping GEE imagery)
  const [currentBoundary, setCurrentBoundary] = useState(null);

  // Check backend health
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();

        if (data.earthEngineReady) {
          setIsBackendReady(true);
          setStatus("ready");
          console.log("✅ Backend is ready");
        } else {
          setStatus("initializing");
          console.log("⏳ Backend is initializing...");
        }
      } catch (err) {
        console.error("❌ Backend not available:", err);
        setError("Backend server not available. Make sure to run: cd server && npm start");
        setStatus("error");
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 3000);

    return () => clearInterval(interval);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;


    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [7.0059, 4.8583],
      zoom: 15,
      maxZoom: 18,
      hash: false,
      preserveDrawingBuffer: false,
      fadeDuration: 0, // Disable fade animations for instant rendering
      refreshExpiredTiles: false
    });

    
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapInstanceRef.current = map;

    map.on('load', () => {
      console.log("✅ MapLibre map loaded");
      if (onReady) onReady(map);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [onReady]);

  // Load GEE layer when backend is ready and layer changes
  useEffect(() => {
    if (!isBackendReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    if (!map.loaded()) {
      // map.on('load', () => loadLayer(currentLayer));
    } else {
      // loadLayer(currentLayer);
    }
  }, [isBackendReady, currentLayer]);

  // Search for location
  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // Debounce search
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
        );
        const data = await response.json();
        setSearchResults(data);
        setShowResults(true);
        setIsSearching(false);
      } catch (err) {
        console.error('Search error:', err);
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectLocation = async (result) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    // Clear search UI
    setSearchQuery(result.display_name);
    setShowResults(false);

    try {
      // Fetch the boundary/shapefile for this location
      console.log('🗺️ Fetching boundary for:', result.display_name);

      const boundaryResponse = await fetch(
        `https://nominatim.openstreetmap.org/lookup?osm_ids=${result.osm_type[0].toUpperCase()}${result.osm_id}&format=json&polygon_geojson=1`
      );
      const boundaryData = await boundaryResponse.json();

      // Remove previous boundary layer if it exists
      if (map.getLayer('location-boundary-fill')) {
        map.removeLayer('location-boundary-fill');
      }
      if (map.getLayer('location-boundary-outline')) {
        map.removeLayer('location-boundary-outline');
      }
      if (map.getSource('location-boundary')) {
        map.removeSource('location-boundary');
      }

      // Add the boundary to the map if we got valid geometry
      if (boundaryData.length > 0 && boundaryData[0].geojson) {
        const geojson = boundaryData[0].geojson;
        console.log('✅ Got boundary GeoJSON', geojson);

        map.addSource('location-boundary', {
          type: 'geojson',
          data: geojson
        });

        // Add fill layer
        map.addLayer({
          id: 'location-boundary-fill',
          type: 'fill',
          source: 'location-boundary',
          paint: {
            'fill-color': '#4285f4',
            'fill-opacity': 0.2
          }
        });

        // Add outline layer
        map.addLayer({
          id: 'location-boundary-outline',
          type: 'line',
          source: 'location-boundary',
          paint: {
            'line-color': '#4285f4',
            'line-width': 3,
            'line-opacity': 0.8
          }
        });

        console.log('✅ Boundary added to map');

        // Store the boundary for clipping GEE imagery
        setCurrentBoundary(geojson);

        // Reload the current layer with the new boundary
        if (currentLayer) {
          loadLayer(currentLayer);
        }

        // Calculate bounds and fit map to boundary
        const bounds = new maplibregl.LngLatBounds();

        const addCoordinatesToBounds = (coords) => {
          if (Array.isArray(coords[0])) {
            coords.forEach(coord => addCoordinatesToBounds(coord));
          } else {
            bounds.extend(coords);
          }
        };

        if (geojson.type === 'Polygon') {
          addCoordinatesToBounds(geojson.coordinates[0]);
        } else if (geojson.type === 'MultiPolygon') {
          geojson.coordinates.forEach(polygon => {
            addCoordinatesToBounds(polygon[0]);
          });
        }

        // Fly to fit the boundary
        map.fitBounds(bounds, {
          padding: 50,
          duration: 2000,
          maxZoom: 15
        });
      } else {
        // If no boundary available, just fly to the point
        console.log('ℹ️ No boundary available, flying to point');
        map.flyTo({
          center: [lon, lat],
          zoom: 12,
          duration: 2000,
          essential: true
        });
      }
    } catch (err) {
      console.error('❌ Error fetching boundary:', err);
      // Fall back to simple flyTo
      map.flyTo({
        center: [lon, lat],
        zoom: 12,
        duration: 2000,
        essential: true
      });
    }
  };

  const loadLayer = async (layerType) => {
    console.log("🌍 Loading GEE layer:", layerType);
    const map = mapInstanceRef.current;
    if (!map) return;

    setStatus("loading_layer");
    setError(null);

    try {
      // Remove existing GEE layer if present
      if (map.getLayer('gee-layer')) {
        map.removeLayer('gee-layer');
      }
      if (map.getSource('gee-source')) {
        map.removeSource('gee-source');
      }

      let tileUrl;
      let endpoint;
      let body = {};

      switch (layerType) {
        case 'lulc':
          endpoint = `${API_BASE_URL}/gee/lulc-tiles`;
          body = {
            startDate: '2020-01-01',
            endDate: '2020-12-31',
            geometry: currentBoundary // Send boundary for clipping
          };
          break;
        case 'landsat':
          endpoint = `${API_BASE_URL}/gee/landsat-tiles`;
          body = {
            startDate: '2020-01-01',
            endDate: '2020-12-31',
            geometry: currentBoundary // Send boundary for clipping
          };
          break;
        case 'ndvi':
          endpoint = `${API_BASE_URL}/gee/ndvi-tiles`;
          body = {
            startDate: '2020-06-01',
            endDate: '2020-09-01',
            geometry: currentBoundary // Send boundary for clipping
          };
          break;
        case 'elevation':
          endpoint = `${API_BASE_URL}/gee/elevation-tiles`;
          body = {
            geometry: currentBoundary // Send boundary for clipping
          };
          break;
        default:
          return;
      }

      if (currentBoundary) {
        console.log(`🗺️ Loading ${layerType} clipped to boundary`);
      }

      console.log(`🌍 Fetching ${layerType} tiles from backend...`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get tiles');
      }

      tileUrl = data.tileUrl;
      console.log(`✅ Got tile URL for ${layerType}`);

      // Add GEE layer with performance optimizations
      map.addSource('gee-source', {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        maxzoom: 18,
        minzoom: 0,
        scheme: 'xyz' // Explicitly set scheme for GEE tiles
      });

      map.addLayer({
        id: 'gee-layer',
        type: 'raster',
        source: 'gee-source',
        paint: {
          'raster-opacity': 0.9, // Slightly higher opacity for better visibility
          'raster-fade-duration': 0 // Instant rendering, no fade
        }
      });

      setStatus("ready");
      console.log(`✅ ${layerType} layer loaded successfully`);

    } catch (err) {
      console.error(`❌ Failed to load ${layerType} layer:`, err);
      setError(`Failed to load ${layerType}: ${err.message}`);
      setStatus("error");
    }
  };

  // Styles
  const containerStyle = {
    width: "100%",
    height: "100vh",
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

  const controlsStyle = {
    // display: 'none',
    position: "absolute",
    top: "10px",
    left: "10px",
    zIndex: 999,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: "15px",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
  };

  const buttonStyle = {
    padding: "10px 20px",
    margin: "5px 0",
    width: "100%",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all 0.2s"
  };

  const statusStyle = {
    position: "absolute",
    bottom: "10px",
    right: "10px",
    zIndex: 999,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
  };

  // Search styles
  const searchContainerStyle = {
    position: "absolute",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "90%",
    maxWidth: "500px",
    zIndex: 1000
  };

  const searchBoxStyle = {
    position: "relative",
    width: "100%"
  };

  const searchInputStyle = {
    width: "100%",
    padding: "14px 45px 14px 18px",
    fontSize: "15px",
    border: "none",
    borderRadius: "12px",
    backgroundColor: "rgba(30, 30, 30, 0.95)",
    color: "#ffffff",
    outline: "none",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
    transition: "all 0.3s ease",
    backdropFilter: "blur(10px)"
  };

  const searchIconStyle = {
    position: "absolute",
    right: "16px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#888",
    pointerEvents: "none",
    fontSize: "18px"
  };

  const resultsContainerStyle = {
    marginTop: "8px",
    backgroundColor: "rgba(30, 30, 30, 0.98)",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
    maxHeight: "400px",
    overflowY: "auto",
    backdropFilter: "blur(10px)"
  };

  const resultItemStyle = {
    padding: "14px 18px",
    cursor: "pointer",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
    transition: "all 0.2s ease",
    color: "#e0e0e0",
    fontSize: "14px"
  };

  const resultItemHoverStyle = {
    backgroundColor: "rgba(66, 133, 244, 0.15)",
    borderLeft: "3px solid #4285f4"
  };

  const renderOverlay = () => {
    if (status === "loading" || status === "initializing") {
      return (
        <div style={overlayStyle}>
          <p style={{ fontSize: "18px", marginBottom: "10px" }}>
            {status === "loading" ? "⏳ Connecting to backend..." : "⏳ Initializing Earth Engine..."}
          </p>
          <p style={{ fontSize: "14px", color: "#666" }}>
            Make sure the backend server is running:<br />
            <code style={{
              backgroundColor: "#f5f5f5",
              padding: "4px 8px",
              borderRadius: "4px",
              marginTop: "8px",
              display: "inline-block"
            }}>
              cd server && npm start
            </code>
          </p>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div style={overlayStyle}>
          <p style={{ fontSize: "18px", color: "#ea4335", marginBottom: "10px" }}>
            ⚠️ Backend Connection Error
          </p>
          <p style={{ fontSize: "14px", color: "#666", maxWidth: "400px", textAlign: "center" }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              ...buttonStyle,
              backgroundColor: "#4285f4",
              color: "white",
              marginTop: "16px",
              width: "auto"
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={containerStyle}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {renderOverlay()}

      {/* Search Bar */}
      {isBackendReady && status !== "loading" && status !== "initializing" && (
        <div style={searchContainerStyle}>
          <div style={searchBoxStyle}>
            <input
              type="text"
              placeholder="Search for a location..."
              value={searchQuery}
              onChange={handleSearchInput}
              style={searchInputStyle}
              onFocus={() => searchQuery.length >= 3 && setShowResults(true)}
            />
            <span style={searchIconStyle}>
              {isSearching ? '⏳' : '🔍'}
            </span>
          </div>

          {/* Search Results */}
          {showResults && searchResults.length > 0 && (
            <div style={resultsContainerStyle}>
              {searchResults.map((result, index) => (
                <div
                  key={result.place_id || index}
                  style={resultItemStyle}
                  onClick={() => handleSelectLocation(result)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = resultItemHoverStyle.backgroundColor;
                    e.currentTarget.style.borderLeft = resultItemHoverStyle.borderLeft;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderLeft = 'none';
                  }}
                >
                  <div style={{ fontWeight: '500', marginBottom: '4px', color: '#ffffff' }}>
                    {result.display_name.split(',')[0]}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', lineHeight: '1.4' }}>
                    {result.display_name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Layer Controls */}
      {isBackendReady && status !== "loading" && status !== "initializing" && (
        <div style={controlsStyle}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600" }}>
            🌍 Earth Engine Layers
          </h3>

          <button
            onClick={() => setCurrentLayer('landsat')}
            disabled={status === "loading_layer"}
            style={{
              ...buttonStyle,
              backgroundColor: currentLayer === 'landsat' ? '#4285f4' : '#f8f9fa',
              color: currentLayer === 'landsat' ? 'white' : '#333',
              border: currentLayer === 'landsat' ? 'none' : '1px solid #ddd'
            }}
          >
            🛰️ Landsat Imagery
          </button>

          <button
            onClick={() => setCurrentLayer('ndvi')}
            disabled={status === "loading_layer"}
            style={{
              ...buttonStyle,
              backgroundColor: currentLayer === 'ndvi' ? '#34a853' : '#f8f9fa',
              color: currentLayer === 'ndvi' ? 'white' : '#333',
              border: currentLayer === 'ndvi' ? 'none' : '1px solid #ddd'
            }}
          >
            🌿 NDVI (Vegetation)
          </button>

          <button
            onClick={() => setCurrentLayer('elevation')}
            disabled={status === "loading_layer"}
            style={{
              ...buttonStyle,
              backgroundColor: currentLayer === 'elevation' ? '#fbbc04' : '#f8f9fa',
              color: currentLayer === 'elevation' ? '#333' : '#333',
              border: currentLayer === 'elevation' ? 'none' : '1px solid #ddd'
            }}
          >
            ⛰️ Elevation (SRTM)
          </button>

          <button
            onClick={() => setCurrentLayer('lulc')}
            disabled={status === "loading_layer"}
            style={{
              ...buttonStyle,
              backgroundColor: currentLayer === 'lulc' ? '#17acb1ff' : '#f8f9fa',
              color: currentLayer === 'lulc' ? '#333333ff' : '#333',
              border: currentLayer === 'lulc' ? 'none' : '1px solid #ddd'
            }}
          >
            ⛰️ LULC
          </button>
        </div>
      )}

      {/* Status Indicator */}
      {isBackendReady && (
        <div style={statusStyle}>
          {status === "loading_layer" && <span>⏳ Loading...</span>}
          {status === "ready" && <span style={{ color: '#34a853' }}>✅ Ready</span>}
          {status === "error" && error && <span style={{ color: '#ea4335' }}>❌ Error</span>}
        </div>
      )}
    </div>
  );
}

GeeWebMap.propTypes = {
  style: PropTypes.object,
  onReady: PropTypes.func,
};

export default GeeWebMap;
