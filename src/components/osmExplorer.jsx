import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Search, Building, Navigation, Trees, MapPin, Layers, ChevronRight, ChevronLeft, X } from "lucide-react";

const OSMExplorer = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  
  // Panel state
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('layers');
  
  // OSM layers state
  const [layers, setLayers] = useState({
    buildings: { 
      enabled: false, 
      extruded: false, 
      classifyBy: 'none',
      loading: false 
    },
    roads: { 
      enabled: false, 
      classifyBy: 'type',
      loading: false 
    },
    trees: { 
      enabled: false,
      style: '3d',
      loading: false 
    },
    water: { 
      enabled: false,
      loading: false 
    },
    landuse: { 
      enabled: false,
      loading: false 
    },
    amenities: { 
      enabled: false,
      loading: false 
    }
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [7.0059, 4.8583],
      zoom: 15,
      pitch: 45,
      bearing: 0,
      antialias: true
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      console.log("✅ Map loaded");
      
      // Add 3D terrain effect
      map.addSource('mapbox-dem', {
        'type': 'raster-dem',
        'url': 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
        'tileSize': 256
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

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
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&polygon_geojson=1`
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
    const map = mapRef.current;
    if (!map) return;

    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    setSearchQuery(result.display_name);
    setSelectedLocation(result);
    setShowResults(false);

    try {
      // Fetch full boundary data
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
            'fill-opacity': 0.08
          }
        });

        map.addLayer({
          id: 'location-boundary-outline',
          type: 'line',
          source: 'location-boundary',
          paint: {
            'line-color': '#4285f4',
            'line-width': 3,
            'line-opacity': 0.6
          }
        });

        // Calculate bounds
        const bounds = new maplibregl.LngLatBounds();
        const addCoords = (coords) => {
          if (Array.isArray(coords[0])) {
            coords.forEach(coord => addCoords(coord));
          } else {
            bounds.extend(coords);
          }
        };

        if (geojson.type === 'Polygon') {
          addCoords(geojson.coordinates[0]);
        } else if (geojson.type === 'MultiPolygon') {
          geojson.coordinates.forEach(polygon => addCoords(polygon[0]));
        }

        map.fitBounds(bounds, {
          padding: 100,
          duration: 1500,
          maxZoom: 16
        });
      } else {
        map.flyTo({
          center: [lon, lat],
          zoom: 15,
          duration: 1500
        });
      }
    } catch (err) {
      console.error('Error fetching boundary:', err);
      map.flyTo({
        center: [lon, lat],
        zoom: 15,
        duration: 1500
      });
    }
  };

  // Fetch and display buildings
  const loadBuildings = async () => {
    const map = mapRef.current;
    if (!map || !selectedLocation) return;

    setLayers(prev => ({
      ...prev,
      buildings: { ...prev.buildings, loading: true }
    }));

    try {
      const bounds = map.getBounds();
      const query = `
        [out:json][timeout:25];
        (
          way["building"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
          relation["building"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
        );
        out geom;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });

      const data = await response.json();

      const features = data.elements
        .filter(el => el.type === 'way' && el.geometry)
        .map(way => ({
          type: 'Feature',
          properties: {
            height: parseFloat(way.tags?.height) || parseFloat(way.tags?.['building:levels']) * 3.5 || 10,
            type: way.tags?.building || 'yes',
            name: way.tags?.name || 'Building'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [way.geometry.map(node => [node.lon, node.lat])]
          }
        }));

      const geojson = {
        type: 'FeatureCollection',
        features: features
      };

      if (map.getSource('buildings')) {
        map.getSource('buildings').setData(geojson);
      } else {
        map.addSource('buildings', {
          type: 'geojson',
          data: geojson
        });

        map.addLayer({
          id: 'buildings-fill',
          type: 'fill',
          source: 'buildings',
          paint: {
            'fill-color': layers.buildings.classifyBy === 'height' 
              ? [
                  'interpolate',
                  ['linear'],
                  ['get', 'height'],
                  5, '#fef3c7',
                  15, '#fcd34d',
                  30, '#f59e0b',
                  50, '#dc2626'
                ]
              : '#fbbf24',
            'fill-opacity': 0.7
          }
        });

        map.addLayer({
          id: 'buildings-outline',
          type: 'line',
          source: 'buildings',
          paint: {
            'line-color': '#78350f',
            'line-width': 1
          }
        });
      }

      if (layers.buildings.extruded) {
        if (!map.getLayer('buildings-3d')) {
          map.addLayer({
            id: 'buildings-3d',
            type: 'fill-extrusion',
            source: 'buildings',
            paint: {
              'fill-extrusion-color': layers.buildings.classifyBy === 'height'
                ? [
                    'interpolate',
                    ['linear'],
                    ['get', 'height'],
                    5, '#fef3c7',
                    15, '#fcd34d',
                    30, '#f59e0b',
                    50, '#dc2626'
                  ]
                : '#fbbf24',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.8
            }
          });
        }
        
        if (map.getLayer('buildings-fill')) map.setLayoutProperty('buildings-fill', 'visibility', 'none');
        if (map.getLayer('buildings-outline')) map.setLayoutProperty('buildings-outline', 'visibility', 'none');
      } else {
        if (map.getLayer('buildings-3d')) map.removeLayer('buildings-3d');
        if (map.getLayer('buildings-fill')) map.setLayoutProperty('buildings-fill', 'visibility', 'visible');
        if (map.getLayer('buildings-outline')) map.setLayoutProperty('buildings-outline', 'visibility', 'visible');
      }

      console.log(`✅ Loaded ${features.length} buildings`);

      setLayers(prev => ({
        ...prev,
        buildings: { ...prev.buildings, loading: false }
      }));

    } catch (err) {
      console.error('Failed to load buildings:', err);
      setLayers(prev => ({
        ...prev,
        buildings: { ...prev.buildings, loading: false }
      }));
    }
  };

  // Fetch and display roads
  const loadRoads = async () => {
    const map = mapRef.current;
    if (!map || !selectedLocation) return;

    setLayers(prev => ({
      ...prev,
      roads: { ...prev.roads, loading: true }
    }));

    try {
      const bounds = map.getBounds();
      const query = `
        [out:json][timeout:25];
        (
          way["highway"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
        );
        out geom;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });

      const data = await response.json();

      const features = data.elements
        .filter(el => el.type === 'way' && el.geometry)
        .map(way => ({
          type: 'Feature',
          properties: {
            highway: way.tags?.highway || 'unknown',
            maxspeed: parseInt(way.tags?.maxspeed) || 50,
            name: way.tags?.name || 'Unnamed Road'
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

      if (map.getSource('roads')) {
        map.getSource('roads').setData(geojson);
      } else {
        map.addSource('roads', {
          type: 'geojson',
          data: geojson
        });

        // Outline layer
        map.addLayer({
          id: 'roads-outline',
          type: 'line',
          source: 'roads',
          paint: {
            'line-color': '#000',
            'line-width': [
              'match',
              ['get', 'highway'],
              ['motorway', 'trunk'], 6,
              ['primary'], 5,
              ['secondary'], 4.5,
              ['tertiary'], 4,
              3
            ],
            'line-opacity': 0.6
          }
        });

        // Main road layer
        map.addLayer({
          id: 'roads-line',
          type: 'line',
          source: 'roads',
          paint: {
            'line-color': layers.roads.classifyBy === 'speed'
              ? [
                  'interpolate',
                  ['linear'],
                  ['get', 'maxspeed'],
                  20, '#10b981',
                  40, '#fbbf24',
                  60, '#f59e0b',
                  80, '#ef4444'
                ]
              : [
                  'match',
                  ['get', 'highway'],
                  ['motorway', 'trunk'], '#f97316',
                  ['primary'], '#3b82f6',
                  ['secondary'], '#8b5cf6',
                  ['tertiary'], '#10b981',
                  '#6b7280'
                ],
            'line-width': [
              'match',
              ['get', 'highway'],
              ['motorway', 'trunk'], 5,
              ['primary'], 4,
              ['secondary'], 3.5,
              ['tertiary'], 3,
              2
            ],
            'line-opacity': 0.9
          }
        });
      }

      console.log(`✅ Loaded ${features.length} roads`);

      setLayers(prev => ({
        ...prev,
        roads: { ...prev.roads, loading: false }
      }));

    } catch (err) {
      console.error('Failed to load roads:', err);
      setLayers(prev => ({
        ...prev,
        roads: { ...prev.roads, loading: false }
      }));
    }
  };

  // Fetch and display trees
  const loadTrees = async () => {
    const map = mapRef.current;
    if (!map || !selectedLocation) return;

    setLayers(prev => ({
      ...prev,
      trees: { ...prev.trees, loading: true }
    }));

    try {
      const bounds = map.getBounds();
      const query = `
        [out:json][timeout:25];
        (
          node["natural"="tree"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
          way["natural"="tree_row"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
        );
        out geom;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });

      const data = await response.json();

      const features = data.elements
        .filter(el => el.type === 'node' || (el.type === 'way' && el.geometry))
        .map(el => ({
          type: 'Feature',
          properties: {
            type: el.tags?.leaf_type || 'unknown',
            height: parseFloat(el.tags?.height) || 8
          },
          geometry: el.type === 'node' 
            ? {
                type: 'Point',
                coordinates: [el.lon, el.lat]
              }
            : {
                type: 'LineString',
                coordinates: el.geometry.map(node => [node.lon, node.lat])
              }
        }));

      const geojson = {
        type: 'FeatureCollection',
        features: features
      };

      if (map.getSource('trees')) {
        map.getSource('trees').setData(geojson);
      } else {
        map.addSource('trees', {
          type: 'geojson',
          data: geojson
        });

        // Load tree icon
        if (!map.hasImage('tree-icon')) {
          const treeIcon = createTreeIcon();
          map.addImage('tree-icon', treeIcon);
        }

        map.addLayer({
          id: 'trees-layer',
          type: 'symbol',
          source: 'trees',
          layout: {
            'icon-image': 'tree-icon',
            'icon-size': 0.8,
            'icon-allow-overlap': false,
            'icon-ignore-placement': false
          },
          paint: {
            'icon-opacity': 0.85
          }
        });
      }

      console.log(`✅ Loaded ${features.length} trees`);

      setLayers(prev => ({
        ...prev,
        trees: { ...prev.trees, loading: false }
      }));

    } catch (err) {
      console.error('Failed to load trees:', err);
      setLayers(prev => ({
        ...prev,
        trees: { ...prev.trees, loading: false }
      }));
    }
  };

  // Create tree icon
  const createTreeIcon = () => {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Draw tree
    ctx.fillStyle = '#78350f';
    ctx.fillRect(size/2 - 2, size/2, 4, size/3);

    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(size/2, size/3, size/4, 0, Math.PI * 2);
    ctx.fill();

    return {
      width: size,
      height: size,
      data: ctx.getImageData(0, 0, size, size).data
    };
  };

  // Load water features
  const loadWater = async () => {
    const map = mapRef.current;
    if (!map || !selectedLocation) return;

    setLayers(prev => ({
      ...prev,
      water: { ...prev.water, loading: true }
    }));

    try {
      const bounds = map.getBounds();
      const query = `
        [out:json][timeout:25];
        (
          way["natural"="water"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
          way["waterway"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
        );
        out geom;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });

      const data = await response.json();

      const features = data.elements
        .filter(el => el.type === 'way' && el.geometry)
        .map(way => ({
          type: 'Feature',
          properties: {
            waterway: way.tags?.waterway || way.tags?.natural || 'water'
          },
          geometry: way.tags?.waterway ? {
            type: 'LineString',
            coordinates: way.geometry.map(node => [node.lon, node.lat])
          } : {
            type: 'Polygon',
            coordinates: [way.geometry.map(node => [node.lon, node.lat])]
          }
        }));

      const geojson = {
        type: 'FeatureCollection',
        features: features
      };

      if (map.getSource('water')) {
        map.getSource('water').setData(geojson);
      } else {
        map.addSource('water', {
          type: 'geojson',
          data: geojson
        });

        map.addLayer({
          id: 'water-fill',
          type: 'fill',
          source: 'water',
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.5
          }
        });

        map.addLayer({
          id: 'water-line',
          type: 'line',
          source: 'water',
          paint: {
            'line-color': '#2563eb',
            'line-width': 2
          }
        });
      }

      console.log(`✅ Loaded ${features.length} water features`);

      setLayers(prev => ({
        ...prev,
        water: { ...prev.water, loading: false }
      }));

    } catch (err) {
      console.error('Failed to load water:', err);
      setLayers(prev => ({
        ...prev,
        water: { ...prev.water, loading: false }
      }));
    }
  };

  // Toggle layer
  const toggleLayer = async (layerName) => {
    const map = mapRef.current;
    if (!map || !selectedLocation) return;

    const newEnabled = !layers[layerName].enabled;

    setLayers(prev => ({
      ...prev,
      [layerName]: { ...prev[layerName], enabled: newEnabled }
    }));

    if (newEnabled) {
      // Load the layer
      switch(layerName) {
        case 'buildings':
          await loadBuildings();
          break;
        case 'roads':
          await loadRoads();
          break;
        case 'trees':
          await loadTrees();
          break;
        case 'water':
          await loadWater();
          break;
      }
    } else {
      // Remove the layer
      const layerIds = {
        buildings: ['buildings-fill', 'buildings-outline', 'buildings-3d'],
        roads: ['roads-line', 'roads-outline'],
        trees: ['trees-layer'],
        water: ['water-fill', 'water-line']
      };

      layerIds[layerName].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
      });

      if (map.getSource(layerName)) map.removeSource(layerName);
    }
  };

  // Update layer visualization
  useEffect(() => {
    if (layers.buildings.enabled) {
      loadBuildings();
    }
  }, [layers.buildings.extruded, layers.buildings.classifyBy]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layers.roads.enabled) return;

    if (map.getLayer('roads-line')) {
      map.setPaintProperty('roads-line', 'line-color', 
        layers.roads.classifyBy === 'speed'
          ? [
              'interpolate',
              ['linear'],
              ['get', 'maxspeed'],
              20, '#10b981',
              40, '#fbbf24',
              60, '#f59e0b',
              80, '#ef4444'
            ]
          : [
              'match',
              ['get', 'highway'],
              ['motorway', 'trunk'], '#f97316',
              ['primary'], '#3b82f6',
              ['secondary'], '#8b5cf6',
              ['tertiary'], '#10b981',
              '#6b7280'
            ]
      );
    }
  }, [layers.roads.classifyBy]);

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", backgroundColor: "#0a0a0a" }}>
      {/* Map Container */}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Search Bar */}
      <div style={{
        position: "absolute",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "90%",
        maxWidth: "500px",
        zIndex: 1000
      }}>
        <div style={{ position: 'relative' }}>
          <Search 
            size={18} 
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#888"
            }} 
          />
          <input
            type="text"
            placeholder="Search for a location..."
            value={searchQuery}
            onChange={handleSearchInput}
            style={{
              width: "100%",
              padding: "14px 18px 14px 45px",
              fontSize: "15px",
              border: "none",
              borderRadius: "12px",
              backgroundColor: "rgba(30, 30, 30, 0.95)",
              color: "#ffffff",
              outline: "none",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(10px)"
            }}
            onFocus={() => searchQuery.length >= 3 && setShowResults(true)}
          />
          {isSearching && (
            <div style={{
              position: "absolute",
              right: "16px",
              top: "50%",
              transform: "translateY(-50%)"
            }}>
              <div style={{
                width: "18px",
                height: "18px",
                border: "2px solid rgba(66, 133, 244, 0.3)",
                borderTopColor: "#4285f4",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite"
              }} />
            </div>
          )}
        </div>

        {/* Search Results */}
        {showResults && searchResults.length > 0 && (
          <div style={{
            marginTop: "8px",
            backgroundColor: "rgba(30, 30, 30, 0.98)",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
            maxHeight: "400px",
            overflowY: "auto",
            backdropFilter: "blur(10px)"
          }}>
            {searchResults.map((result, index) => (
              <div
                key={result.place_id || index}
                onClick={() => handleSelectLocation(result)}
                style={{
                  padding: "14px 18px",
                  cursor: "pointer",
                  borderBottom: index < searchResults.length - 1 ? "1px solid rgba(255, 255, 255, 0.05)" : "none",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(66, 133, 244, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ fontWeight: '500', marginBottom: '4px', color: '#ffffff', fontSize: '14px' }}>
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

      {/* Side Panel Toggle */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        style={{
          position: "absolute",
          left: panelOpen ? "360px" : "10px",
          top: "50%",
          transform: "translateY(-50%)",
          backgroundColor: "rgba(20, 20, 20, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "8px",
          padding: "12px 8px",
          cursor: "pointer",
          zIndex: 999,
          transition: "all 0.3s ease",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
        }}
      >
        {panelOpen ? <ChevronLeft size={20} color="#fff" /> : <ChevronRight size={20} color="#fff" />}
      </button>

      {/* Side Panel */}
      <div style={{
        position: "absolute",
        left: panelOpen ? "0" : "-370px",
        top: "0",
        width: "350px",
        height: "100vh",
        backgroundColor: "rgba(20, 20, 20, 0.98)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255, 255, 255, 0.1)",
        transition: "left 0.3s ease",
        zIndex: 998,
        display: "flex",
        flexDirection: "column",
        boxShadow: "4px 0 24px rgba(0, 0, 0, 0.5)"
      }}>
        {/* Panel Header */}
        <div style={{
          padding: "24px 20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
        }}>
          <h2 style={{
            margin: 0,
            color: "#fff",
            fontSize: "20px",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}>
            <Layers size={24} color="#4285f4" />
            OSM Data Layers
          </h2>
          {selectedLocation && (
            <p style={{
              margin: "8px 0 0 0",
              color: "#888",
              fontSize: "13px"
            }}>
              {selectedLocation.display_name.split(',')[0]}
            </p>
          )}
        </div>

        {/* Panel Content */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px"
        }}>
          {!selectedLocation ? (
            <div style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "#888"
            }}>
              <MapPin size={48} color="#4285f4" style={{ marginBottom: "16px" }} />
              <p style={{ fontSize: "14px", lineHeight: "1.6" }}>
                Search and select a location to start exploring OSM data layers
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Buildings Layer */}
              <div style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                padding: "16px",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Building size={20} color="#fbbf24" />
                    <span style={{ color: "#fff", fontWeight: "500", fontSize: "15px" }}>
                      Buildings
                    </span>
                  </div>
                  <label style={{ position: "relative", display: "inline-block", width: "48px", height: "24px" }}>
                    <input
                      type="checkbox"
                      checked={layers.buildings.enabled}
                      onChange={() => toggleLayer('buildings')}
                      disabled={layers.buildings.loading}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: "absolute",
                      cursor: layers.buildings.loading ? "not-allowed" : "pointer",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: layers.buildings.enabled ? "#4285f4" : "#374151",
                      transition: "0.3s",
                      borderRadius: "24px",
                      opacity: layers.buildings.loading ? 0.5 : 1
                    }}>
                      <span style={{
                        position: "absolute",
                        content: "",
                        height: "18px",
                        width: "18px",
                        left: layers.buildings.enabled ? "27px" : "3px",
                        bottom: "3px",
                        backgroundColor: "white",
                        transition: "0.3s",
                        borderRadius: "50%"
                      }} />
                    </span>
                  </label>
                </div>

                {layers.buildings.enabled && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      backgroundColor: "rgba(0, 0, 0, 0.2)",
                      borderRadius: "8px"
                    }}>
                      <span style={{ color: "#cbd5e0", fontSize: "13px" }}>3D Extrusion</span>
                      <label style={{ position: "relative", display: "inline-block", width: "40px", height: "20px" }}>
                        <input
                          type="checkbox"
                          checked={layers.buildings.extruded}
                          onChange={(e) => setLayers(prev => ({
                            ...prev,
                            buildings: { ...prev.buildings, extruded: e.target.checked }
                          }))}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: "absolute",
                          cursor: "pointer",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: layers.buildings.extruded ? "#10b981" : "#374151",
                          transition: "0.3s",
                          borderRadius: "20px"
                        }}>
                          <span style={{
                            position: "absolute",
                            content: "",
                            height: "14px",
                            width: "14px",
                            left: layers.buildings.extruded ? "23px" : "3px",
                            bottom: "3px",
                            backgroundColor: "white",
                            transition: "0.3s",
                            borderRadius: "50%"
                          }} />
                        </span>
                      </label>
                    </div>

                    <div style={{
                      padding: "8px 12px",
                      backgroundColor: "rgba(0, 0, 0, 0.2)",
                      borderRadius: "8px"
                    }}>
                      <label style={{ color: "#cbd5e0", fontSize: "13px", display: "block", marginBottom: "8px" }}>
                        Classify by:
                      </label>
                      <select
                        value={layers.buildings.classifyBy}
                        onChange={(e) => setLayers(prev => ({
                          ...prev,
                          buildings: { ...prev.buildings, classifyBy: e.target.value }
                        }))}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          backgroundColor: "#1f2937",
                          color: "#fff",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          borderRadius: "6px",
                          fontSize: "13px",
                          cursor: "pointer"
                        }}
                      >
                        <option value="none">None</option>
                        <option value="height">Height</option>
                      </select>
                    </div>
                  </div>
                )}

                {layers.buildings.loading && (
                  <div style={{
                    marginTop: "12px",
                    padding: "8px",
                    backgroundColor: "rgba(66, 133, 244, 0.1)",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    color: "#4285f4"
                  }}>
                    <div style={{
                      width: "14px",
                      height: "14px",
                      border: "2px solid rgba(66, 133, 244, 0.3)",
                      borderTopColor: "#4285f4",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite"
                    }} />
                    Loading buildings...
                  </div>
                )}
              </div>

              {/* Roads Layer */}
              <div style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                padding: "16px",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Navigation size={20} color="#3b82f6" />
                    <span style={{ color: "#fff", fontWeight: "500", fontSize: "15px" }}>
                      Road Network
                    </span>
                  </div>
                  <label style={{ position: "relative", display: "inline-block", width: "48px", height: "24px" }}>
                    <input
                      type="checkbox"
                      checked={layers.roads.enabled}
                      onChange={() => toggleLayer('roads')}
                      disabled={layers.roads.loading}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: "absolute",
                      cursor: layers.roads.loading ? "not-allowed" : "pointer",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: layers.roads.enabled ? "#4285f4" : "#374151",
                      transition: "0.3s",
                      borderRadius: "24px",
                      opacity: layers.roads.loading ? 0.5 : 1
                    }}>
                      <span style={{
                        position: "absolute",
                        content: "",
                        height: "18px",
                        width: "18px",
                        left: layers.roads.enabled ? "27px" : "3px",
                        bottom: "3px",
                        backgroundColor: "white",
                        transition: "0.3s",
                        borderRadius: "50%"
                      }} />
                    </span>
                  </label>
                </div>

                {layers.roads.enabled && (
                  <div style={{
                    padding: "8px 12px",
                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                    borderRadius: "8px",
                    marginTop: "12px"
                  }}>
                    <label style={{ color: "#cbd5e0", fontSize: "13px", display: "block", marginBottom: "8px" }}>
                      Classify by:
                    </label>
                    <select
                      value={layers.roads.classifyBy}
                      onChange={(e) => setLayers(prev => ({
                        ...prev,
                        roads: { ...prev.roads, classifyBy: e.target.value }
                      }))}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        backgroundColor: "#1f2937",
                        color: "#fff",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "6px",
                        fontSize: "13px",
                        cursor: "pointer"
                      }}
                    >
                      <option value="type">Road Type</option>
                      <option value="speed">Speed Limit</option>
                    </select>
                  </div>
                )}

                {layers.roads.loading && (
                  <div style={{
                    marginTop: "12px",
                    padding: "8px",
                    backgroundColor: "rgba(66, 133, 244, 0.1)",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    color: "#4285f4"
                  }}>
                    <div style={{
                      width: "14px",
                      height: "14px",
                      border: "2px solid rgba(66, 133, 244, 0.3)",
                      borderTopColor: "#4285f4",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite"
                    }} />
                    Loading roads...
                  </div>
                )}
              </div>

              {/* Trees Layer */}
              <div style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                padding: "16px",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Trees size={20} color="#16a34a" />
                    <span style={{ color: "#fff", fontWeight: "500", fontSize: "15px" }}>
                      Trees
                    </span>
                  </div>
                  <label style={{ position: "relative", display: "inline-block", width: "48px", height: "24px" }}>
                    <input
                      type="checkbox"
                      checked={layers.trees.enabled}
                      onChange={() => toggleLayer('trees')}
                      disabled={layers.trees.loading}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: "absolute",
                      cursor: layers.trees.loading ? "not-allowed" : "pointer",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: layers.trees.enabled ? "#4285f4" : "#374151",
                      transition: "0.3s",
                      borderRadius: "24px",
                      opacity: layers.trees.loading ? 0.5 : 1
                    }}>
                      <span style={{
                        position: "absolute",
                        content: "",
                        height: "18px",
                        width: "18px",
                        left: layers.trees.enabled ? "27px" : "3px",
                        bottom: "3px",
                        backgroundColor: "white",
                        transition: "0.3s",
                        borderRadius: "50%"
                      }} />
                    </span>
                  </label>
                </div>

                {layers.trees.loading && (
                  <div style={{
                    marginTop: "12px",
                    padding: "8px",
                    backgroundColor: "rgba(66, 133, 244, 0.1)",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    color: "#4285f4"
                  }}>
                    <div style={{
                      width: "14px",
                      height: "14px",
                      border: "2px solid rgba(66, 133, 244, 0.3)",
                      borderTopColor: "#4285f4",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite"
                    }} />
                    Loading trees...
                  </div>
                )}
              </div>

              {/* Water Layer */}
              <div style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                padding: "16px",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>💧</span>
                    <span style={{ color: "#fff", fontWeight: "500", fontSize: "15px" }}>
                      Water Features
                    </span>
                  </div>
                  <label style={{ position: "relative", display: "inline-block", width: "48px", height: "24px" }}>
                    <input
                      type="checkbox"
                      checked={layers.water.enabled}
                      onChange={() => toggleLayer('water')}
                      disabled={layers.water.loading}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: "absolute",
                      cursor: layers.water.loading ? "not-allowed" : "pointer",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: layers.water.enabled ? "#4285f4" : "#374151",
                      transition: "0.3s",
                      borderRadius: "24px",
                      opacity: layers.water.loading ? 0.5 : 1
                    }}>
                      <span style={{
                        position: "absolute",
                        content: "",
                        height: "18px",
                        width: "18px",
                        left: layers.water.enabled ? "27px" : "3px",
                        bottom: "3px",
                        backgroundColor: "white",
                        transition: "0.3s",
                        borderRadius: "50%"
                      }} />
                    </span>
                  </label>
                </div>

                {layers.water.loading && (
                  <div style={{
                    marginTop: "12px",
                    padding: "8px",
                    backgroundColor: "rgba(66, 133, 244, 0.1)",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    color: "#4285f4"
                  }}>
                    <div style={{
                      width: "14px",
                      height: "14px",
                      border: "2px solid rgba(66, 133, 244, 0.3)",
                      borderTopColor: "#4285f4",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite"
                    }} />
                    Loading water features...
                  </div>
                )}
              </div>

              {/* Legend */}
              {(layers.buildings.enabled || layers.roads.enabled) && (
                <div style={{
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "12px",
                  padding: "16px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  marginTop: "8px"
                }}>
                  <h4 style={{
                    margin: "0 0 12px 0",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: "500"
                  }}>
                    Legend
                  </h4>

                  {layers.roads.enabled && (
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ color: "#cbd5e0", fontSize: "12px", marginBottom: "8px" }}>
                        {layers.roads.classifyBy === 'type' ? 'Road Types:' : 'Speed Limits:'}
                      </div>
                      {layers.roads.classifyBy === 'type' ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {[
                            { color: '#f97316', label: 'Motorway/Trunk' },
                            { color: '#3b82f6', label: 'Primary' },
                            { color: '#8b5cf6', label: 'Secondary' },
                            { color: '#10b981', label: 'Tertiary' },
                            { color: '#6b7280', label: 'Other' }
                          ].map((item, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{
                                width: "20px",
                                height: "3px",
                                backgroundColor: item.color,
                                borderRadius: "2px"
                              }} />
                              <span style={{ color: "#9ca3af", fontSize: "11px" }}>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {[
                            { color: '#10b981', label: '≤ 20 km/h' },
                            { color: '#fbbf24', label: '40 km/h' },
                            { color: '#f59e0b', label: '60 km/h' },
                            { color: '#ef4444', label: '≥ 80 km/h' }
                          ].map((item, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{
                                width: "20px",
                                height: "3px",
                                backgroundColor: item.color,
                                borderRadius: "2px"
                              }} />
                              <span style={{ color: "#9ca3af", fontSize: "11px" }}>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {layers.buildings.enabled && layers.buildings.classifyBy === 'height' && (
                    <div>
                      <div style={{ color: "#cbd5e0", fontSize: "12px", marginBottom: "8px" }}>
                        Building Heights:
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {[
                          { color: '#fef3c7', label: '≤ 5m' },
                          { color: '#fcd34d', label: '15m' },
                          { color: '#f59e0b', label: '30m' },
                          { color: '#dc2626', label: '≥ 50m' }
                        ].map((item, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{
                              width: "16px",
                              height: "16px",
                              backgroundColor: item.color,
                              borderRadius: "4px"
                            }} />
                            <span style={{ color: "#9ca3af", fontSize: "11px" }}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel Footer */}
        <div style={{
          padding: "16px 20px",
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          backgroundColor: "rgba(0, 0, 0, 0.2)"
        }}>
          <div style={{
            fontSize: "11px",
            color: "#666",
            textAlign: "center"
          }}>
            Data © OpenStreetMap contributors
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* Custom scrollbar */
        div::-webkit-scrollbar {
          width: 6px;
        }
        
        div::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
        
        div::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        
        div::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
};

export default OSMExplorer;