import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const API_BASE_URL = 'http://localhost:5000/api';

// Enhanced color palette matching LULC classes
const LULC_COLORS = {
  water: '#419bdf',
  trees: '#397d49',
  grass: '#88b053',
  flooded_vegetation: '#7a87c6',
  crops: '#e49635',
  shrub_and_scrub: '#dfc35a',
  built: '#c4281b',
  bare: '#a59b8f',
  snow_and_ice: '#b39fe1'
};

function GeeWebMap({ style = {}, onReady }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [isBackendReady, setIsBackendReady] = useState(false);

  // Stats state
  const [lulcStats, setLulcStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Current boundary geometry
  const [currentBoundary, setCurrentBoundary] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('');

  // Road network toggle
  const [showRoads, setShowRoads] = useState(false);
  const [isLoadingRoads, setIsLoadingRoads] = useState(false);

  // Analytics panel visibility
  const [showAnalytics, setShowAnalytics] = useState(true);

  // Chart refs
  const pieChartRef = useRef(null);
  const barChartRef = useRef(null);
  const [plotlyLoaded, setPlotlyLoaded] = useState(false);

  // Load Plotly from CDN if not available
  useEffect(() => {
    if (window.Plotly) {
      setPlotlyLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.27.0/plotly.min.js';
    script.async = true;
    script.onload = () => {
      console.log('✅ Plotly loaded from CDN');
      setPlotlyLoaded(true);
    };
    script.onerror = () => {
      console.error('❌ Failed to load Plotly from CDN');
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Render charts when stats change
  useEffect(() => {
    if (!lulcStats || !pieChartRef.current || !barChartRef.current || !plotlyLoaded || !window.Plotly) return;

    const plotlyLib = window.Plotly;

    const chartData = lulcStats.classes.map(cls => ({
      ...cls,
      name: cls.class.replace(/_/g, ' '),
      value: cls.percentage
    }));

    // Prepare data for 3D Pie Chart
    const pieLabels = chartData.map(cls => cls.name);
    const pieValues = chartData.map(cls => cls.percentage);
    const pieColors = chartData.map(cls => `#${cls.color}`);
    const pieText = chartData.map(cls => 
      `${cls.name}<br>${cls.percentage.toFixed(1)}%<br>${cls.areaInSqKm.toFixed(2)} km²`
    );

    // Render Pie Chart with connector lines
    plotlyLib.newPlot(pieChartRef.current, [{
      type: 'pie',
      labels: pieLabels,
      values: pieValues,
      marker: {
        colors: pieColors,
        line: {
          color: '#1a1a1a',
          width: 2
        }
      },
      text: pieText,
      textposition: 'outside',
      textfont: {
        color: '#ffffff',
        size: 11
      },
      hoverinfo: 'label+percent+text',
      hole: 0.3,
      pull: 0.05,
      direction: 'clockwise',
      sort: false,
      automargin: true,
      texttemplate: '%{label}<br>%{percent}',
      insidetextorientation: 'radial'
    }], {
      height: 300,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 10, b: 10, l: 10, r: 10 },
      showlegend: false,
      font: {
        color: '#ffffff',
        family: 'system-ui, -apple-system, sans-serif'
      },
      hoverlabel: {
        bgcolor: 'rgba(20, 20, 20, 0.95)',
        bordercolor: '#4285f4',
        font: { color: '#ffffff', size: 12 }
      }
    }, {
      displayModeBar: false,
      responsive: true
    });

    // Render 3D Bar Chart
    plotlyLib.newPlot(barChartRef.current, [{
      type: 'bar',
      x: chartData.map(cls => cls.name),
      y: chartData.map(cls => cls.areaInSqKm),
      marker: {
        color: chartData.map(cls => `#${cls.color}`),
        line: {
          color: '#1a1a1a',
          width: 1.5
        },
        opacity: 0.9
      },
      text: chartData.map(cls => `${cls.areaInSqKm.toFixed(2)} km²`),
      textposition: 'auto',
      textfont: {
        color: '#ffffff',
        size: 10
      },
      hovertemplate: '<b>%{x}</b><br>' +
        'Area: %{y:.2f} km²<br>' +
        '<extra></extra>'
    }], {
      height: 250,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 20, b: 80, l: 50, r: 20 },
      xaxis: {
        tickangle: -45,
        color: '#999',
        gridcolor: 'rgba(255,255,255,0.1)',
        tickfont: { size: 10 }
      },
      yaxis: {
        title: 'Area (km²)',
        color: '#999',
        gridcolor: 'rgba(255,255,255,0.1)',
        tickfont: { size: 10 }
      },
      font: {
        color: '#ffffff',
        family: 'system-ui, -apple-system, sans-serif'
      },
      hoverlabel: {
        bgcolor: 'rgba(20, 20, 20, 0.95)',
        bordercolor: '#4285f4',
        font: { color: '#ffffff', size: 12 }
      }
    }, {
      displayModeBar: false,
      responsive: true
    });

  }, [lulcStats, plotlyLoaded]);

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
        setError("Backend server not available");
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
      fadeDuration: 0,
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

  // Search handling
  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

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

    setSearchQuery(result.display_name);
    setSelectedLocation(result.display_name.split(',')[0]);
    setShowResults(false);

    try {
      console.log('🗺️ Fetching boundary for:', result.display_name);

      const boundaryResponse = await fetch(
        `https://nominatim.openstreetmap.org/lookup?osm_ids=${result.osm_type[0].toUpperCase()}${result.osm_id}&format=json&polygon_geojson=1`
      );
      const boundaryData = await boundaryResponse.json();

      // Remove previous boundary
      if (map.getLayer('location-boundary-fill')) map.removeLayer('location-boundary-fill');
      if (map.getLayer('location-boundary-outline')) map.removeLayer('location-boundary-outline');
      if (map.getSource('location-boundary')) map.removeSource('location-boundary');

      if (boundaryData.length > 0 && boundaryData[0].geojson) {
        const geojson = boundaryData[0].geojson;
        console.log('✅ Got boundary GeoJSON');

        map.addSource('location-boundary', {
          type: 'geojson',
          data: geojson
        });

        map.addLayer({
          id: 'location-boundary-fill',
          type: 'fill',
          source: 'location-boundary',
          paint: {
            'fill-color': '#4285f4',
            'fill-opacity': 0.1
          }
        });

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

        setCurrentBoundary(geojson);

        // Load LULC tiles first (fast)
        await loadLULCLayer(geojson);

        // Then load statistics (slower)
        loadLULCStats(geojson);

        // Fit bounds
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

        map.fitBounds(bounds, {
          padding: 50,
          duration: 2000,
          maxZoom: 15
        });
      } else {
        map.flyTo({
          center: [lon, lat],
          zoom: 12,
          duration: 2000,
          essential: true
        });
      }
    } catch (err) {
      console.error('❌ Error fetching boundary:', err);
      map.flyTo({
        center: [lon, lat],
        zoom: 12,
        duration: 2000,
        essential: true
      });
    }
  };

  const loadLULCLayer = async (geometry) => {
    console.log("🌍 Loading LULC layer");
    const map = mapInstanceRef.current;
    if (!map) return;

    setStatus("loading_layer");
    setError(null);

    try {
      if (map.getLayer('gee-layer')) map.removeLayer('gee-layer');
      if (map.getSource('gee-source')) map.removeSource('gee-source');

      const response = await fetch(`${API_BASE_URL}/gee/lulc-tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2020-01-01',
          endDate: '2025-12-31',
          geometry: geometry
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get tiles');
      }

      console.log('✅ Got LULC tile URL');

      map.addSource('gee-source', {
        type: 'raster',
        tiles: [data.tileUrl],
        tileSize: 256,
        maxzoom: 18,
        minzoom: 0,
        scheme: 'xyz'
      });

      map.addLayer({
        id: 'gee-layer',
        type: 'raster',
        source: 'gee-source',
        paint: {
          'raster-opacity': 0.85,
          'raster-fade-duration': 0
        }
      });

      setStatus("ready");
      console.log('✅ LULC layer loaded successfully');

    } catch (err) {
      console.error('❌ Failed to load LULC layer:', err);
      setError(`Failed to load LULC: ${err.message}`);
      setStatus("error");
    }
  };

  const loadLULCStats = async (geometry) => {
    console.log("📊 Loading LULC statistics");
    setIsLoadingStats(true);
    setStatsError(null);
    setLulcStats(null);

    try {
      const response = await fetch(`${API_BASE_URL}/gee/lulc-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2020-01-01',
          endDate: '2020-12-31',
          geometry: geometry
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get statistics');
      }

      console.log('✅ LULC statistics loaded');
      setLulcStats(data.statistics);
      setIsLoadingStats(false);

    } catch (err) {
      console.error('❌ Failed to load LULC statistics:', err);
      setStatsError(err.message);
      setIsLoadingStats(false);
    }
  };

  const toggleRoadNetwork = async () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (showRoads) {
      // Remove road layers
      if (map.getLayer('roads-outline')) map.removeLayer('roads-outline');
      if (map.getLayer('roads-line')) map.removeLayer('roads-line');
      if (map.getSource('roads')) map.removeSource('roads');
      setShowRoads(false);
      return;
    }

    // Add road network
    setIsLoadingRoads(true);
    try {
      const bounds = map.getBounds();
      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ].join(',');

      console.log('🛣️ Fetching road network...');
      
      // Fetch roads from Overpass API
      const query = `
        [out:json][timeout:25];
        (
          way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
        );
        out geom;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });

      const data = await response.json();
      
      // Convert Overpass data to GeoJSON
      const features = data.elements
        .filter(element => element.type === 'way' && element.geometry)
        .map(way => ({
          type: 'Feature',
          properties: {
            highway: way.tags.highway,
            name: way.tags.name || 'Unnamed Road'
          },
          geometry: {
            type: 'LineString',
            coordinates: way.geometry.map(node => [node.lon, node.lat])
          }
        }));

      const geojson = {
        type: 'FeatureCollection',
        features: features
      };

      console.log(`✅ Loaded ${features.length} road segments`);

      // Add source
      map.addSource('roads', {
        type: 'geojson',
        data: geojson
      });

      // Add outline layer
      map.addLayer({
        id: 'roads-outline',
        type: 'line',
        source: 'roads',
        paint: {
          'line-color': '#000',
          'line-width': [
            'match',
            ['get', 'highway'],
            ['motorway', 'trunk'], 5,
            ['primary'], 4,
            ['secondary'], 3.5,
            ['tertiary'], 3,
            2.5
          ],
          'line-opacity': 0.8
        }
      });

      // Add main road layer
      map.addLayer({
        id: 'roads-line',
        type: 'line',
        source: 'roads',
        paint: {
          'line-color': [
            'match',
            ['get', 'highway'],
            ['motorway', 'trunk'], '#f39c12',
            ['primary'], '#e74c3c',
            ['secondary'], '#3498db',
            ['tertiary'], '#2ecc71',
            '#95a5a6'
          ],
          'line-width': [
            'match',
            ['get', 'highway'],
            ['motorway', 'trunk'], 4,
            ['primary'], 3,
            ['secondary'], 2.5,
            ['tertiary'], 2,
            1.5
          ],
          'line-opacity': 0.9
        }
      });

      setShowRoads(true);
      setIsLoadingRoads(false);

    } catch (err) {
      console.error('❌ Failed to load road network:', err);
      setIsLoadingRoads(false);
      alert('Failed to load road network. Please try again.');
    }
  };

  // Render analytics panel
  const renderAnalyticsPanel = () => {
    if (!showAnalytics) return null;

    if (!selectedLocation) {
      return (
        <div style={analyticsPanelStyle}>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌍</div>
            <h3 style={{ color: '#fff', marginBottom: '8px' }}>Land Cover Analytics</h3>
            <p style={{ color: '#999', fontSize: '14px' }}>
              Search and select a location to view detailed land cover statistics
            </p>
          </div>
        </div>
      );
    }

    if (isLoadingStats) {
      return (
        <div style={analyticsPanelStyle}>
          <div style={{ padding: '20px' }}>
            <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '18px' }}>
              📊 {selectedLocation}
            </h3>
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div className="pulse" style={{
                width: '60px',
                height: '60px',
                margin: '0 auto 20px',
                borderRadius: '50%',
                border: '3px solid #4285f4',
                borderTopColor: 'transparent',
                animation: 'spin 1s linear infinite'
              }} />
              <p style={{ color: '#4285f4', fontSize: '16px', fontWeight: '500' }}>
                Calculating land cover statistics...
              </p>
              <p style={{ color: '#666', fontSize: '13px', marginTop: '8px' }}>
                This may take a few seconds
              </p>
            </div>
            
            {/* Skeleton charts */}
            <div style={{ opacity: 0.3, filter: 'blur(2px)' }}>
              <div style={{ height: '250px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '16px' }} />
              <div style={{ height: '200px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }} />
            </div>
          </div>
        </div>
      );
    }

    if (statsError) {
      return (
        <div style={analyticsPanelStyle}>
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ color: '#ea4335', marginBottom: '8px' }}>Error Loading Statistics</h3>
            <p style={{ color: '#999', fontSize: '14px' }}>{statsError}</p>
            <button
              onClick={() => loadLULCStats(currentBoundary)}
              style={{
                marginTop: '16px',
                padding: '10px 20px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (!lulcStats) return null;

    const chartData = lulcStats.classes.map(cls => ({
      ...cls,
      name: cls.class.replace(/_/g, ' '),
      value: cls.percentage
    }));

    return (
      <div style={analyticsPanelStyle}>
        <div style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ color: '#fff', margin: 0, fontSize: '18px', fontWeight: '600' }}>
                📊 {selectedLocation}
              </h3>
              <button
                onClick={toggleRoadNetwork}
                disabled={isLoadingRoads}
                style={{
                  backgroundColor: showRoads ? 'rgba(52, 168, 83, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: showRoads ? '#34a853' : '#999',
                  border: showRoads ? '1px solid rgba(52, 168, 83, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: isLoadingRoads ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  opacity: isLoadingRoads ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isLoadingRoads) {
                    e.currentTarget.style.backgroundColor = showRoads ? 'rgba(52, 168, 83, 0.25)' : 'rgba(255, 255, 255, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoadingRoads) {
                    e.currentTarget.style.backgroundColor = showRoads ? 'rgba(52, 168, 83, 0.15)' : 'rgba(255, 255, 255, 0.05)';
                  }
                }}
              >
                <span style={{ fontSize: '14px' }}>
                  {isLoadingRoads ? '⏳' : '🛣️'}
                </span>
                <span>
                  {isLoadingRoads ? 'Loading...' : showRoads ? 'Roads' : 'Roads'}
                </span>
              </button>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={statCardStyle}>
                <div style={{ color: '#4285f4', fontSize: '24px', fontWeight: 'bold' }}>
                  {lulcStats.totalAreaSqKm.toFixed(2)}
                </div>
                <div style={{ color: '#999', fontSize: '12px' }}>km² Total Area</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ color: '#34a853', fontSize: '24px', fontWeight: 'bold' }}>
                  {chartData.length}
                </div>
                <div style={{ color: '#999', fontSize: '12px' }}>Land Types</div>
              </div>
            </div>
          </div>

          {/* 3D Pie Chart */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '12px', fontWeight: '500' }}>
              Distribution Overview (3D)
            </h4>
            <div ref={pieChartRef} style={{ width: '100%' }} />
          </div>

          {/* 3D Bar Chart */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '12px', fontWeight: '500' }}>
              Area Comparison (3D)
            </h4>
            <div ref={barChartRef} style={{ width: '100%' }} />
          </div>

          {/* Detailed List */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '12px', fontWeight: '500' }}>
              Detailed Breakdown
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {chartData.map((cls, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    animation: `slideIn 0.3s ease ${idx * 0.1}s both`
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      backgroundColor: `#${cls.color}`,
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500', textTransform: 'capitalize' }}>
                      {cls.name}
                    </div>
                    <div style={{ color: '#999', fontSize: '11px' }}>
                      {cls.areaInHectares.toFixed(0)} ha
                    </div>
                  </div>
                  <div style={{ color: `#${cls.color}`, fontSize: '16px', fontWeight: 'bold' }}>
                    {cls.percentage.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}</style>
      </div>
    );
  };

  // Styles
  const containerStyle = {
    width: "100%",
    height: "100vh",
    position: "relative",
    backgroundColor: "#0a0a0a",
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
    backgroundColor: "rgba(10, 10, 10, 0.95)",
    zIndex: 1000,
    padding: "20px"
  };

  const analyticsPanelStyle = {
    position: "absolute",
    top: "10px",
    left: "10px",
    width: "420px",
    maxHeight: "calc(100vh - 20px)",
    backgroundColor: "rgba(20, 20, 20, 0.95)",
    borderRadius: "16px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    zIndex: 999,
    overflow: "hidden"
  };

  const statCardStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '12px 16px',
    flex: '1',
    minWidth: '120px'
  };

  const searchContainerStyle = {
    position: "absolute",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "90%",
    maxWidth: "500px",
    zIndex: 1000
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
    backdropFilter: "blur(10px)"
  };

  const searchIconStyle = {
    position: "absolute",
    right: "16px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#888",
    fontSize: "18px"
  };

  const resultsContainerStyle = {
    marginTop: "8px",
    backgroundColor: "rgba(30, 30, 30, 0.98)",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
    maxHeight: "400px",
    overflowY: "auto",
    backdropFilter: "blur(10px)"
  };

  const resultItemStyle = {
    padding: "14px 18px",
    cursor: "pointer",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
    color: "#e0e0e0",
    fontSize: "14px"
  };

  const statusStyle = {
    position: "absolute",
    bottom: "10px",
    right: "10px",
    zIndex: 999,
    backgroundColor: "rgba(20, 20, 20, 0.95)",
    padding: "8px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#fff"
  };

  const renderOverlay = () => {
    if (status === "loading" || status === "initializing") {
      return (
        <div style={overlayStyle}>
          <div className="pulse" style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            border: '4px solid #4285f4',
            borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ fontSize: "18px", color: "#fff", marginBottom: "10px" }}>
            {status === "loading" ? "Connecting to Earth Engine..." : "Initializing..."}
          </p>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div style={overlayStyle}>
          <p style={{ fontSize: "18px", color: "#ea4335", marginBottom: "10px" }}>
            ⚠️ Connection Error
          </p>
          <p style={{ fontSize: "14px", color: "#999" }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "16px",
              padding: "12px 24px",
              backgroundColor: "#4285f4",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer"
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

      {/* Analytics Panel */}
      {isBackendReady && renderAnalyticsPanel()}

      {/* Search Bar */}
      {isBackendReady && (
        <div style={searchContainerStyle}>
          <div style={{ position: 'relative' }}>
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

          {showResults && searchResults.length > 0 && (
            <div style={resultsContainerStyle}>
              {searchResults.map((result, index) => (
                <div
                  key={result.place_id || index}
                  style={resultItemStyle}
                  onClick={() => handleSelectLocation(result)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(66, 133, 244, 0.15)';
                    e.currentTarget.style.borderLeft = '3px solid #4285f4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderLeft = 'none';
                  }}
                >
                  <div style={{ fontWeight: '500', marginBottom: '4px', color: '#ffffff' }}>
                    {result.display_name.split(',')[0]}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {result.display_name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status Indicator */}
      {isBackendReady && (
        <div style={statusStyle}>
          {status === "loading_layer" && <span>⏳ Loading imagery...</span>}
          {status === "ready" && <span style={{ color: '#34a853' }}>✅ Ready</span>}
          {status === "error" && <span style={{ color: '#ea4335' }}>❌ Error</span>}
        </div>
      )}

      {/* Analytics Panel Toggle */}
      {isBackendReady && (
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          style={{
            position: "absolute",
            top: "10px",
            left: showAnalytics ? "440px" : "10px",
            zIndex: 1000,
            backgroundColor: "rgba(20, 20, 20, 0.95)",
            color: "#fff",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "18px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            transition: "all 0.3s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.backgroundColor = "rgba(30, 30, 30, 0.95)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.backgroundColor = "rgba(20, 20, 20, 0.95)";
          }}
          title={showAnalytics ? "Hide Analytics" : "Show Analytics"}
        >
          {showAnalytics ? "◀" : "📊"}
        </button>
      )}
    </div>
  );
}

export default GeeWebMap;