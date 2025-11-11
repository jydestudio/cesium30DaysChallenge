import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useGeeBackend } from "../hooks/useGeeBackend";

function GeeMapBackend({ style = {} }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [layerType, setLayerType] = useState('landsat');
  const { isReady, loading, error, getLandsatTiles, getNdviTiles, getElevationTiles } = useGeeBackend();

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
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

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapInstanceRef.current = map;

    return () => map.remove();
  }, []);

  // Load GEE layer when ready
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Wait for map to load
    if (!map.loaded()) {
      map.on('load', () => loadGeeLayer(layerType));
    } else {
      loadGeeLayer(layerType);
    }
  }, [isReady, layerType]);

  const loadGeeLayer = async (type) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      // Remove existing GEE layer if present
      if (map.getLayer('gee-layer')) {
        map.removeLayer('gee-layer');
        map.removeSource('gee-source');
      }

      let tileUrl;

      switch (type) {
        case 'landsat':
          tileUrl = await getLandsatTiles('2020-01-01', '2020-12-31');
          break;
        case 'ndvi':
          tileUrl = await getNdviTiles('2020-06-01', '2020-09-01');
          break;
        case 'elevation':
          tileUrl = await getElevationTiles();
          break;
        default:
          return;
      }

      // Add GEE layer
      map.addSource('gee-source', {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256
      });

      map.addLayer({
        id: 'gee-layer',
        type: 'raster',
        source: 'gee-source',
        paint: {
          'raster-opacity': 0.8
        }
      });

      console.log(`✅ ${type} layer loaded successfully`);
    } catch (err) {
      console.error(`❌ Failed to load ${type} layer:`, err);
    }
  };

  const containerStyle = {
    width: "100%",
    height: "600px",
    position: "relative",
    backgroundColor: "#e8e8e8",
    ...style
  };

  const controlsStyle = {
    position: "absolute",
    top: "10px",
    left: "10px",
    zIndex: 1000,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: "15px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
  };

  const statusStyle = {
    position: "absolute",
    bottom: "10px",
    right: "10px",
    zIndex: 1000,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: "10px 15px",
    borderRadius: "8px",
    fontSize: "12px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
  };

  return (
    <div style={containerStyle}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Layer Controls */}
      <div style={controlsStyle}>
        <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>Earth Engine Layers</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            onClick={() => setLayerType('landsat')}
            disabled={!isReady || loading}
            style={{
              padding: "8px 16px",
              backgroundColor: layerType === 'landsat' ? '#4285f4' : '#fff',
              color: layerType === 'landsat' ? '#fff' : '#333',
              border: '1px solid #ddd',
              borderRadius: "4px",
              cursor: isReady && !loading ? 'pointer' : 'not-allowed',
              fontSize: "14px"
            }}
          >
            🛰️ Landsat Imagery
          </button>
          <button
            onClick={() => setLayerType('ndvi')}
            disabled={!isReady || loading}
            style={{
              padding: "8px 16px",
              backgroundColor: layerType === 'ndvi' ? '#34a853' : '#fff',
              color: layerType === 'ndvi' ? '#fff' : '#333',
              border: '1px solid #ddd',
              borderRadius: "4px",
              cursor: isReady && !loading ? 'pointer' : 'not-allowed',
              fontSize: "14px"
            }}
          >
            🌿 NDVI (Vegetation)
          </button>
          <button
            onClick={() => setLayerType('elevation')}
            disabled={!isReady || loading}
            style={{
              padding: "8px 16px",
              backgroundColor: layerType === 'elevation' ? '#fbbc04' : '#fff',
              color: layerType === 'elevation' ? '#333' : '#333',
              border: '1px solid #ddd',
              borderRadius: "4px",
              cursor: isReady && !loading ? 'pointer' : 'not-allowed',
              fontSize: "14px"
            }}
          >
            ⛰️ Elevation
          </button>
        </div>
      </div>

      {/* Status Indicator */}
      <div style={statusStyle}>
        {!isReady && <span>⏳ Connecting to backend...</span>}
        {isReady && !loading && <span style={{ color: '#34a853' }}>✅ Backend ready</span>}
        {loading && <span>⏳ Loading layer...</span>}
        {error && <span style={{ color: '#ea4335' }}>❌ {error}</span>}
      </div>
    </div>
  );
}

export default GeeMapBackend;
