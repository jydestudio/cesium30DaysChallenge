import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { PieChart, Pie, BarChart, Bar, Cell, ResponsiveContainer, Legend, Tooltip, XAxis, YAxis, LineChart, Line } from 'recharts';
import "maplibre-gl/dist/maplibre-gl.css";

const API_BASE_URL = 'http://localhost:5000/api';

// Analysis types configuration
const ANALYSIS_TYPES = {
  LULC: {
    id: 'lulc',
    name: 'Land Cover',
    icon: '🌍',
    tilesEndpoint: '/gee/lulc-tiles',
    statsEndpoint: '/gee/lulc-stats',
    description: 'Analyze land use and land cover patterns',
    hasStats: true
  },
  BURN: {
    id: 'burn',
    name: 'Burn Severity',
    icon: '🔥',
    tilesEndpoint: '/gee/burn-severity-tiles',
    statsEndpoint: '/gee/burn-severity-stats',
    description: 'Analyze wildfire burn severity using dNBR',
    hasStats: true
  },
  NDVI: {
    id: 'ndvi',
    name: 'Vegetation (NDVI)',
    icon: '🌱',
    tilesEndpoint: '/gee/ndvi-tiles',
    statsEndpoint: null,
    description: 'Normalized Difference Vegetation Index',
    hasStats: false
  },
  ELEVATION: {
    id: 'elevation',
    name: 'Elevation',
    icon: '⛰️',
    tilesEndpoint: '/gee/elevation-tiles',
    statsEndpoint: null,
    description: 'Digital elevation model',
    hasStats: false
  },
  LANDSAT: {
    id: 'landsat',
    name: 'Landsat RGB',
    icon: '🛰️',
    tilesEndpoint: '/gee/landsat-tiles',
    statsEndpoint: null,
    description: 'True color satellite imagery',
    hasStats: false
  }
};

function GeeWebMap({ style = {}, onReady }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [isBackendReady, setIsBackendReady] = useState(false);

  // Analysis selection
  const [selectedAnalysis, setSelectedAnalysis] = useState(ANALYSIS_TYPES.LULC);
  const [showAnalysisMenu, setShowAnalysisMenu] = useState(false);

  // Stats state
  const [analysisStats, setAnalysisStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [showChartsPanel, setShowChartsPanel] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Current boundary geometry
  const [currentBoundary, setCurrentBoundary] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('');

  // Burn severity specific dates
  const [preFireDates, setPreFireDates] = useState({
    start: '2014-08-07',
    end: '2014-08-08'
  });
  const [postFireDates, setPostFireDates] = useState({
    start: '2015-09-11',
    end: '2015-09-12'
  });

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

        // Load analysis layer based on selected type
        await loadAnalysisLayer(geojson);

        // Load statistics if available
        if (selectedAnalysis.hasStats) {
          loadAnalysisStats(geojson);
        }

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
        setCurrentBoundary(null);
        await loadAnalysisLayer(null);
        
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

  const loadAnalysisLayer = async (geometry) => {
    console.log(`🌍 Loading ${selectedAnalysis.name} layer`);
    const map = mapInstanceRef.current;
    if (!map) return;

    setStatus("loading_layer");
    setError(null);

    try {
      if (map.getLayer('gee-layer')) map.removeLayer('gee-layer');
      if (map.getSource('gee-source')) map.removeSource('gee-source');

      const requestBody = {
        geometry: geometry
      };

      // Add specific parameters based on analysis type
      if (selectedAnalysis.id === 'burn') {
        requestBody.preFireStartDate = preFireDates.start;
        requestBody.preFireEndDate = preFireDates.end;
        requestBody.postFireStartDate = postFireDates.start;
        requestBody.postFireEndDate = postFireDates.end;
        requestBody.layer = 'dnbr';
      } else if (selectedAnalysis.id === 'lulc') {
        requestBody.startDate = '2020-01-01';
        requestBody.endDate = '2025-12-31';
      } else {
        requestBody.startDate = '2020-01-01';
        requestBody.endDate = '2020-12-31';
      }

      const response = await fetch(`${API_BASE_URL}${selectedAnalysis.tilesEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get tiles');
      }

      console.log(`✅ Got ${selectedAnalysis.name} tile URL`);

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
      console.log(`✅ ${selectedAnalysis.name} layer loaded successfully`);

    } catch (err) {
      console.error(`❌ Failed to load ${selectedAnalysis.name} layer:`, err);
      setError(`Failed to load ${selectedAnalysis.name}: ${err.message}`);
      setStatus("error");
    }
  };

  const loadAnalysisStats = async (geometry) => {
    if (!selectedAnalysis.hasStats || !selectedAnalysis.statsEndpoint) {
      return;
    }

    console.log(`📊 Loading ${selectedAnalysis.name} statistics`);
    setIsLoadingStats(true);
    setStatsError(null);
    setAnalysisStats(null);

    try {
      const requestBody = {
        geometry: geometry
      };

      if (selectedAnalysis.id === 'burn') {
        requestBody.preFireStartDate = preFireDates.start;
        requestBody.preFireEndDate = preFireDates.end;
        requestBody.postFireStartDate = postFireDates.start;
        requestBody.postFireEndDate = postFireDates.end;
      } else if (selectedAnalysis.id === 'lulc') {
        requestBody.startDate = '2020-01-01';
        requestBody.endDate = '2020-12-31';
      }

      const response = await fetch(`${API_BASE_URL}${selectedAnalysis.statsEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get statistics');
      }

      console.log(`✅ ${selectedAnalysis.name} statistics loaded`);
      setAnalysisStats(data.statistics);
      setIsLoadingStats(false);

    } catch (err) {
      console.error(`❌ Failed to load ${selectedAnalysis.name} statistics:`, err);
      setStatsError(err.message);
      setIsLoadingStats(false);
    }
  };

  // Handle analysis type change
  const handleAnalysisChange = (analysis) => {
    setSelectedAnalysis(analysis);
    setShowAnalysisMenu(false);
    setAnalysisStats(null);
    
    // Reload current location with new analysis
    if (currentBoundary) {
      loadAnalysisLayer(currentBoundary);
      if (analysis.hasStats) {
        loadAnalysisStats(currentBoundary);
      }
    }
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'rgba(20, 20, 20, 0.95)',
          border: `2px solid ${data.color ? `#${data.color}` : '#4285f4'}`,
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
        }}>
          <p style={{ color: '#fff', fontWeight: 'bold', margin: '0 0 8px 0', textTransform: 'capitalize' }}>
            {data.class ? data.class.replace(/_/g, ' ') : data.name}
          </p>
          <p style={{ color: data.color ? `#${data.color}` : '#4285f4', margin: '4px 0', fontSize: '14px' }}>
            Area: {data.areaInSqKm?.toFixed(2)} km²
          </p>
          <p style={{ color: data.color ? `#${data.color}` : '#4285f4', margin: '4px 0', fontSize: '14px' }}>
            {data.areaInHectares?.toFixed(0)} hectares
          </p>
          <p style={{ color: data.color ? `#${data.color}` : '#4285f4', margin: '4px 0', fontSize: '16px', fontWeight: 'bold' }}>
            {data.percentage?.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  // Render charts based on analysis type
  const renderCharts = () => {
    if (!analysisStats || !analysisStats.classes) return null;

    const chartData = analysisStats.classes.map(cls => ({
      ...cls,
      name: cls.class.replace(/_/g, ' '),
      value: cls.percentage
    }));

    return (
      <>
        {/* Pie Chart */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '12px', fontWeight: '500' }}>
            Distribution Overview
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => percentage > 5 ? `${percentage.toFixed(1)}%` : ''}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                animationDuration={800}
                animationBegin={0}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`#${entry.color}`} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '12px', fontWeight: '500' }}>
            Area Comparison (km²)
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#999', fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fill: '#999', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="areaInSqKm" animationDuration={800} radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={`#${entry.color}`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
                    {cls.areaInHectares?.toFixed(0)} ha
                  </div>
                </div>
                <div style={{ color: `#${cls.color}`, fontSize: '16px', fontWeight: 'bold' }}>
                  {cls.percentage?.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  };

  // Render analytics panel
  const renderAnalyticsPanel = () => {
    if (!showChartsPanel) return null;

    if (!selectedLocation) {
      return (
        <div style={analyticsPanelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '600', margin: 0 }}>
              {selectedAnalysis.icon} Analytics
            </h3>
            <button
              onClick={() => setShowChartsPanel(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#999',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              ×
            </button>
          </div>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>{selectedAnalysis.icon}</div>
            <h3 style={{ color: '#fff', marginBottom: '8px' }}>{selectedAnalysis.name}</h3>
            <p style={{ color: '#999', fontSize: '14px' }}>
              {selectedAnalysis.description}
            </p>
            <p style={{ color: '#666', fontSize: '13px', marginTop: '16px' }}>
              Search and select a location to begin analysis
            </p>
          </div>
        </div>
      );
    }

    if (isLoadingStats) {
      return (
        <div style={analyticsPanelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '600', margin: 0 }}>
              {selectedAnalysis.icon} {selectedLocation}
            </h3>
            <button
              onClick={() => setShowChartsPanel(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#999',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: '20px' }}>
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
                Calculating statistics...
              </p>
              <p style={{ color: '#666', fontSize: '13px', marginTop: '8px' }}>
                This may take a few seconds
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (!selectedAnalysis.hasStats) {
      return (
        <div style={analyticsPanelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '600', margin: 0 }}>
              {selectedAnalysis.icon} {selectedLocation}
            </h3>
            <button
              onClick={() => setShowChartsPanel(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#999',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              ×
            </button>
          </div>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <h3 style={{ color: '#fff', marginBottom: '8px' }}>No Statistics Available</h3>
            <p style={{ color: '#999', fontSize: '14px' }}>
              This analysis type does not have statistical data available
            </p>
          </div>
        </div>
      );
    }

    if (statsError) {
      return (
        <div style={analyticsPanelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '600', margin: 0 }}>
              {selectedAnalysis.icon} {selectedLocation}
            </h3>
            <button
              onClick={() => setShowChartsPanel(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#999',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ color: '#ea4335', marginBottom: '8px' }}>Error Loading Statistics</h3>
            <p style={{ color: '#999', fontSize: '14px' }}>{statsError}</p>
            <button
              onClick={() => loadAnalysisStats(currentBoundary)}
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

    if (!analysisStats) return null;

    return (
      <div style={analyticsPanelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '600', margin: 0 }}>
            {selectedAnalysis.icon} {selectedLocation}
          </h3>
          <button
            onClick={() => setShowChartsPanel(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto', height: 'calc(100% - 57px)' }}>
          {/* Summary Stats */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={statCardStyle}>
                <div style={{ color: '#4285f4', fontSize: '24px', fontWeight: 'bold' }}>
                  {analysisStats.totalAreaSqKm?.toFixed(2)}
                </div>
                <div style={{ color: '#999', fontSize: '12px' }}>km² Total Area</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ color: '#34a853', fontSize: '24px', fontWeight: 'bold' }}>
                  {analysisStats.classes?.length || 0}
                </div>
                <div style={{ color: '#999', fontSize: '12px' }}>Categories</div>
              </div>
            </div>
          </div>

          {renderCharts()}
        </div>
      </div>
    );
  };

  // Render analysis menu
  const renderAnalysisMenu = () => {
    if (!showAnalysisMenu) return null;

    return (
      <div style={analysisMenuStyle}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '600', margin: 0 }}>
              Select Analysis
            </h3>
            <button
              onClick={() => setShowAnalysisMenu(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#999',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ padding: '12px' }}>
          {Object.values(ANALYSIS_TYPES).map((analysis) => (
            <div
              key={analysis.id}
              onClick={() => handleAnalysisChange(analysis)}
              style={{
                padding: '16px',
                marginBottom: '8px',
                backgroundColor: selectedAnalysis.id === analysis.id ? 'rgba(66, 133, 244, 0.2)' : 'rgba(255,255,255,0.05)',
                borderRadius: '12px',
                cursor: 'pointer',
                border: selectedAnalysis.id === analysis.id ? '2px solid #4285f4' : '2px solid transparent',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (selectedAnalysis.id !== analysis.id) {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedAnalysis.id !== analysis.id) {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '32px' }}>{analysis.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>
                    {analysis.name}
                  </div>
                  <div style={{ color: '#999', fontSize: '12px' }}>
                    {analysis.description}
                  </div>
                </div>
                {selectedAnalysis.id === analysis.id && (
                  <div style={{ color: '#4285f4', fontSize: '20px' }}>✓</div>
                )}
              </div>
            </div>
          ))}
        </div>
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
    overflow: "hidden",
    display: 'flex',
    flexDirection: 'column'
  };

  const analysisMenuStyle = {
    position: "absolute",
    top: "10px",
    right: "10px",
    width: "320px",
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

  const floatingButtonStyle = {
    position: "absolute",
    bottom: "80px",
    right: "10px",
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    backgroundColor: "rgba(20, 20, 20, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    zIndex: 999,
    transition: "all 0.2s ease"
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

      {/* Analysis Selection Menu */}
      {isBackendReady && renderAnalysisMenu()}

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

      {/* Floating Action Buttons */}
      {isBackendReady && (
        <>
          {/* Toggle Analysis Menu Button */}
          <button
            style={{
              ...floatingButtonStyle,
              bottom: '140px',
              backgroundColor: showAnalysisMenu ? 'rgba(66, 133, 244, 0.95)' : 'rgba(20, 20, 20, 0.95)'
            }}
            onClick={() => setShowAnalysisMenu(!showAnalysisMenu)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.backgroundColor = showAnalysisMenu ? 'rgba(66, 133, 244, 1)' : 'rgba(40, 40, 40, 0.95)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = showAnalysisMenu ? 'rgba(66, 133, 244, 0.95)' : 'rgba(20, 20, 20, 0.95)';
            }}
            title="Select Analysis Type"
          >
            {selectedAnalysis.icon}
          </button>

          {/* Toggle Charts Panel Button */}
          {selectedAnalysis.hasStats && selectedLocation && (
            <button
              style={{
                ...floatingButtonStyle,
                bottom: '80px',
                backgroundColor: showChartsPanel ? 'rgba(66, 133, 244, 0.95)' : 'rgba(20, 20, 20, 0.95)'
              }}
              onClick={() => setShowChartsPanel(!showChartsPanel)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.backgroundColor = showChartsPanel ? 'rgba(66, 133, 244, 1)' : 'rgba(40, 40, 40, 0.95)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = showChartsPanel ? 'rgba(66, 133, 244, 0.95)' : 'rgba(20, 20, 20, 0.95)';
              }}
              title={showChartsPanel ? "Hide Charts" : "Show Charts"}
            >
              📊
            </button>
          )}
        </>
      )}

      {/* Status Indicator */}
      {isBackendReady && (
        <div style={statusStyle}>
          {status === "loading_layer" && <span>⏳ Loading imagery...</span>}
          {status === "ready" && <span style={{ color: '#34a853' }}>✅ {selectedAnalysis.name}</span>}
          {status === "error" && <span style={{ color: '#ea4335' }}>❌ Error</span>}
        </div>
      )}

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
}

export default GeeWebMap;