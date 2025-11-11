import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { circle, booleanPointInPolygon, bbox, length } from "@turf/turf";
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const MapLibreMap = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const buffer = useRef(null);
  const currentCursor = useRef("crosshair");
  const fetchTimeoutRef = useRef(null);
  const barChartRef = useRef(null);
  const pieChartRef = useRef(null);
  const barChartInstance = useRef(null);
  const pieChartInstance = useRef(null);
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [bufferRadius, setBufferRadius] = useState(500);
  const [bufferColor, setBufferColor] = useState("#38A169");
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [roadStats, setRoadStats] = useState(null);

  const radiusRef = useRef(bufferRadius);
  const colorRef = useRef(bufferColor);

  const allHighwayTypes = [".*"];

  const osmWaytoGeoJSON = (way) => {
    if (!way.geometry || way.geometry.length < 2) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: way.geometry.map((node) => [node.lon, node.lat]),
      },
      properties: {
        id: way.id,
        highway: way.tags?.highway || "unknown",
      },
    };
  };

  const createBufferCircle = (center, radiusInMeters, points = 64) => {
    const bufferPolygon = circle(center, radiusInMeters / 1000, {
      steps: points,
      units: "kilometers",
    });
    buffer.current = bufferPolygon;
    return bufferPolygon;
  };

  const clipRoadNetwork = (roads, bufferPolygon) => {
    return roads
      .map((road) => {
        if (!road.geometry || !road.geometry.coordinates) return null;
        try {
          const coords = road.geometry.coordinates;
          let segments = [];
          let currentSegment = [];

          coords.forEach(([lng, lat]) => {
            const inside = booleanPointInPolygon([lng, lat], bufferPolygon);
            if (inside) {
              currentSegment.push([lng, lat]);
            } else {
              if (currentSegment.length >= 2) {
                segments.push([...currentSegment]);
              }
              currentSegment = [];
            }
          });

          if (currentSegment.length >= 2) segments.push(currentSegment);

          if (segments.length === 0) return null;

          return {
            ...road,
            geometry:
              segments.length === 1
                ? { type: "LineString", coordinates: segments[0] }
                : { type: "MultiLineString", coordinates: segments },
          };
        } catch (err) {
          console.warn("Failed to clip road:", road.properties.id, err);
          return null;
        }
      })
      .filter(Boolean);
  };

  const calculateRoadStats = (clippedRoads) => {
    const stats = {
      totalLength: 0,
      roadCount: clippedRoads.length,
      byType: {}
    };

    clippedRoads.forEach(road => {
      const roadLength = length(road, { units: 'meters' });
      stats.totalLength += roadLength;
      
      const type = road.properties.highway;
      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, length: 0 };
      }
      stats.byType[type].count += 1;
      stats.byType[type].length += roadLength;
    });

    return stats;
  };

  const fetchRoads = async (lat, lon, radius = 1000) => {
    const tempBuffer = circle([lon, lat], radius / 1000, {
      units: "kilometers",
    });
    const [minLng, minLat, maxLng, maxLat] = bbox(tempBuffer);

    const highwayFilter = `["highway"~"${allHighwayTypes.join("|")}"]`;
    const query = `
      [out:json][timeout:25];
      (
        way(bbox:${minLat},${minLng},${maxLat},${maxLng})${highwayFilter};
      );
      out geom;
    `;

    try {
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const validFeatures = data.elements
        .filter(
          (el) => el.type === "way" && el.geometry && el.geometry.length >= 2
        )
        .map(osmWaytoGeoJSON)
        .filter(Boolean);

      return validFeatures;
    } catch (error) {
      console.error("Error fetching roads:", error);
      return [];
    }
  };

  // Update charts when roadStats changes
  useEffect(() => {
    if (!roadStats || !barChartRef.current || !pieChartRef.current) return;

    const typeData = Object.entries(roadStats.byType)
      .map(([type, data]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        count: data.count,
        length: data.length / 1000 // Convert to km
      }))
      .sort((a, b) => b.length - a.length);

    const colors = [
      '#38A169', '#3182CE', '#805AD5', '#DD6B20', '#E53E3E', 
      '#38B2AC', '#D69E2E', '#ED64A6', '#48BB78', '#4299E1'
    ];

    // Destroy existing charts
    if (barChartInstance.current) {
      barChartInstance.current.destroy();
    }
    if (pieChartInstance.current) {
      pieChartInstance.current.destroy();
    }

    // Create Bar Chart
    const barCtx = barChartRef.current.getContext('2d');
    barChartInstance.current = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: typeData.map(d => d.name),
        datasets: [{
          label: 'Length (km)',
          data: typeData.map(d => d.length),
          backgroundColor: colors.slice(0, typeData.length),
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#2d3748',
            titleColor: '#fff',
            bodyColor: '#cbd5e0',
            borderColor: '#4a5568',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: (context) => {
                const index = context.dataIndex;
                return [
                  `Length: ${context.parsed.x.toFixed(2)} km`,
                  `Roads: ${typeData[index].count}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: '#4a5568',
              drawBorder: false
            },
            ticks: {
              color: '#cbd5e0',
              font: {
                size: 11
              }
            }
          },
          y: {
            grid: {
              display: false
            },
            ticks: {
              color: '#cbd5e0',
              font: {
                size: 12,
                weight: '600'
              }
            }
          }
        }
      }
    });

    // Create Pie Chart
    const pieCtx = pieChartRef.current.getContext('2d');
    pieChartInstance.current = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: typeData.map(d => d.name),
        datasets: [{
          data: typeData.map(d => d.length),
          backgroundColor: colors.slice(0, typeData.length),
          borderColor: '#1a202c',
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#cbd5e0',
              padding: 12,
              font: {
                size: 12,
                weight: '500'
              },
              generateLabels: (chart) => {
                const data = chart.data;
                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                return data.labels.map((label, i) => ({
                  text: `${label} (${((data.datasets[0].data[i] / total) * 100).toFixed(1)}%)`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  hidden: false,
                  index: i
                }));
              }
            }
          },
          tooltip: {
            backgroundColor: '#2d3748',
            titleColor: '#fff',
            bodyColor: '#cbd5e0',
            borderColor: '#4a5568',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => {
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return [
                  `${value.toFixed(2)} km`,
                  `${percentage}% of total`
                ];
              }
            }
          }
        }
      }
    });

    return () => {
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
      }
      if (pieChartInstance.current) {
        pieChartInstance.current.destroy();
      }
    };
  }, [roadStats]);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [7.0059, 4.8583],
      zoom: 15,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.getCanvas().style.cursor = "crosshair";

    map.on("mousemove", (e) => {
      if (!buffer.current) return;

      const inside = booleanPointInPolygon(
        [e.lngLat.lng, e.lngLat.lat],
        buffer.current
      );
      const newCursor = inside ? "pointer" : "crosshair";
      if (newCursor !== currentCursor.current) {
        map.getCanvas().style.cursor = newCursor;
        currentCursor.current = newCursor;
      }
    });

    map.on("contextmenu", (e) => {
      setMenuVisible(true);
    });

    map.on("click", async (e) => {
      const { lng, lat } = e.lngLat;
      setSelectedPoint([lng, lat]);
      setIsLoading(true);
      markerRef.current?.remove();

      const currentRadius = radiusRef.current;
      const currentColor = colorRef.current;

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
        "<b>Selected Point</b>"
      );
      const marker = new maplibregl.Marker({ color: currentColor })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map);
      markerRef.current = marker;
      popup.addTo(map);

      const bufferLayerId = "buffer-layer";
      const roadLayerId = "road-network";

      createBufferCircle([lng, lat], currentRadius);

      if (map.getLayer(bufferLayerId)) {
        map.removeLayer(bufferLayerId);
        map.removeSource(bufferLayerId);
      }

      map.addSource(bufferLayerId, { type: "geojson", data: buffer.current });
      map.addLayer({
        id: bufferLayerId,
        type: "fill",
        source: bufferLayerId,
        paint: {
          "fill-color": currentColor,
          "fill-opacity": 0.3,
          "fill-outline-color": "#FFFFFF",
        },
      });

      if (map.getLayer(roadLayerId)) {
        map.removeLayer(roadLayerId);
        map.removeSource(roadLayerId);
      }

      const roadNetwork = await fetchRoads(lat, lng, currentRadius);
      const clippedRoads = clipRoadNetwork(roadNetwork, buffer.current);
      
      const stats = calculateRoadStats(clippedRoads);
      setRoadStats(stats);
      setIsLoading(false);

      map.addSource(roadLayerId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: clippedRoads },
      });

      map.addLayer({
        id: roadLayerId,
        type: "line",
        source: roadLayerId,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "RED",
          "line-width": 4,
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      buffer.current = null;
    };
  }, []);

  useEffect(() => {
    radiusRef.current = bufferRadius;
    colorRef.current = bufferColor;

    const map = mapRef.current;
    if (!map || !selectedPoint) return;

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    const [lng, lat] = selectedPoint;
    const bufferLayerId = "buffer-layer";
    const roadLayerId = "road-network";

    const updatedBuffer = createBufferCircle([lng, lat], bufferRadius);
    buffer.current = updatedBuffer;

    if (map.getSource(bufferLayerId)) {
      map.getSource(bufferLayerId).setData(updatedBuffer);
      map.setPaintProperty(bufferLayerId, "fill-color", bufferColor);
    }

    if (markerRef.current) {
      const popup = markerRef.current.getPopup();
      markerRef.current.remove();
      markerRef.current = new maplibregl.Marker({ color: bufferColor })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map);
    }

    fetchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      const roadNetwork = await fetchRoads(lat, lng, bufferRadius);
      const clippedRoads = clipRoadNetwork(roadNetwork, updatedBuffer);
      
      const stats = calculateRoadStats(clippedRoads);
      setRoadStats(stats);
      setIsLoading(false);

      if (map.getSource(roadLayerId)) {
        map.getSource(roadLayerId).setData({
          type: "FeatureCollection",
          features: clippedRoads,
        });
        map.setPaintProperty(roadLayerId, "line-color", "RED");
      }
    }, 500);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [bufferRadius, bufferColor, selectedPoint]);

  return (
    <div
      ref={mapContainerRef}
      style={{ width: "100%", height: "100vh", position: "relative" }}
    >
      {menuVisible && (
        <div className="control-panel">
          <div className="controls-section">
            <div className="panel-header">
              <h2 className="panel-title">🗺️ Buffer Controls</h2>
            </div>

            <div className="control-group">
              <label htmlFor="radius-slider" className="control-label">
                Buffer Radius: <span className="value-display">{bufferRadius} m</span>
              </label>
              <input
                id="radius-slider"
                type="range"
                min="100"
                max="2000"
                step="50"
                value={bufferRadius}
                onChange={(e) => setBufferRadius(Number(e.target.value))}
                className="range-slider"
                style={{ accentColor: bufferColor }}
              />
            </div>

            <div className="control-group">
              <div className="control-label">Buffer Color:</div>
              <div className="color-picker-container">
                <input
                  type="color"
                  value={bufferColor}
                  onChange={(e) => setBufferColor(e.target.value)}
                  className="color-input"
                />
                <span className="color-hex-display">{bufferColor}</span>
              </div>
            </div>

            {isLoading && (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <span>Fetching road data...</span>
              </div>
            )}

            {roadStats && (
              <div className="stat-cards">
                <div className="stat-card">
                  <div className="stat-icon">🛣️</div>
                  <div className="stat-label">Total Roads</div>
                  <div className="stat-value">{roadStats.roadCount}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📏</div>
                  <div className="stat-label">Total Length</div>
                  <div className="stat-value">{(roadStats.totalLength / 1000).toFixed(2)} km</div>
                </div>
              </div>
            )}
          </div>

          {roadStats && (
            <div className="charts-container">
              <div className="chart-section">
                <h3 className="chart-title">📊 Road Length by Type</h3>
                <div className="chart-wrapper">
                  <canvas ref={barChartRef}></canvas>
                </div>
              </div>

              <div className="chart-section">
                <h3 className="chart-title">🥧 Distribution by Type</h3>
                <div className="chart-wrapper-pie">
                  <canvas ref={pieChartRef}></canvas>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

<style>{`
  .control-panel {
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(63, 64, 65, 0.96);
    padding: 24px;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    max-width: 950px;
    max-height: 90vh;
    overflow-y: auto;
    z-index: 1000;
    display: flex;
    gap: 24px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .panel-title {
    color: #f5f5f5;
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }

  .controls-section {
    min-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .control-label {
    color: #dcdcdc;
    font-size: 14px;
    font-weight: 600;
  }

  .value-display {
    color: #7dd3fc;
    font-weight: 600;
    font-size: 15px;
  }

  .range-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #353638ff;
    outline: none;
    cursor: pointer;
  }

  .range-slider::-webkit-slider-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #7dd3fc;
    border: none;
    cursor: pointer;
  }

  .color-picker-container {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #3f4246ff;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .color-input {
    width: 40px;
    height: 35px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    background: none;
  }

  .color-hex-display {
    color: #e2e2e2;
    font-family: monospace;
    font-size: 14px;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    color: #9ae6b4;
    font-size: 13px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(154, 230, 180, 0.3);
    border-top-color: #9ae6b4;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .stat-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .stat-card {
    background: rgba(64, 66, 70, 0.9);
    padding: 16px;
    border-radius: 12px;
    text-align: center;
    transition: transform 0.2s, box-shadow 0.2s;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .stat-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  .stat-icon {
    font-size: 26px;
    color: #7dd3fc;
  }

  .stat-label {
    color: #a0aec0;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .stat-value {
    color: #f7fafc;
    font-size: 20px;
    font-weight: 700;
  }

  .charts-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 500px;
  }

  .chart-section {
    background: rgba(219, 221, 224, 0.26);
    padding: 20px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .chart-title {
    color: #cbd5e0;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .chart-wrapper {
    height: 280px;
  }

  .chart-wrapper-pie {
    height: 300px;
  }

  /* ✅ Fix pie chart text color */
  .chart-wrapper-pie text,
  .recharts-layer text {
    fill: #e8e8e8 !important;
    font-weight: 500;
  }

  .control-panel::-webkit-scrollbar {
    width: 8px;
  }

  .control-panel::-webkit-scrollbar-track {
    background: #1f1f1f;
    border-radius: 4px;
  }

  .control-panel::-webkit-scrollbar-thumb {
    background: #2d2d2d;
    border-radius: 4px;
  }

  .control-panel::-webkit-scrollbar-thumb:hover {
    background: #3b3b3b;
  }

  @media (max-width: 1024px) {
    .control-panel {
      flex-direction: column;
      max-width: 500px;
    }

    .charts-container {
      min-width: auto;
    }
  }
`}</style>

    </div>
  );
};

export default MapLibreMap;