import React, { useRef, useEffect, useState } from 'react';
import { Viewer, Entity } from 'resium';
import {
  Cartesian3,
  Color,
  EasingFunction,
  Ion,
  Cesium3DTileset,
  CesiumTerrainProvider,
  Cesium3DTileStyle,
  defined,
  Math as CesiumMath,
  HeadingPitchRange,
  BoundingSphere,
  ScreenSpaceEventType,
  ScreenSpaceEventHandler,
  Matrix4,
  HeightReference,
  Cartographic,
  GeoJsonDataSource
} from 'cesium';

// Your Cesium Ion token
Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwYmZhNTA4NC03OTMxLTQyOWUtYjhlNy0xMTUzODhjY2NhZmUiLCJpZCI6MzEwNTk1LCJpYXQiOjE3NDk0Nzg3Mzh9.zct22WQVPi45u2h1ynGt7zbvaHhltMLpbLAEUWWBqEA";

const globeStyle = {
  width: '100%',
  height: '100%',
};

const toolPaneStyle = {
  position: 'absolute',
  top: '50px',
  right: '500px',
  zIndex: 1000,
  backgroundColor: 'rgba(30, 30, 30, 0.95)',
  borderRadius: '10px',
  padding: '20px',
  minWidth: '280px',
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: 'white',
  /* hide scrollbar */
  scrollbarWidth: 'none', // Firefox
  msOverflowStyle: 'none', // IE 10+
};

const toolboxHeaderStyle = {
  fontSize: '18px',
  fontWeight: '600',
  marginBottom: '16px',
  paddingBottom: '12px',
  borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const toolSectionStyle = {
  marginBottom: '16px',
};

const sectionTitleStyle = {
  fontSize: '12px',
  fontWeight: '600',
  color: 'rgba(255, 255, 255, 0.6)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '10px',
};

const toggleButtonStyle = {
  width: '100%',
  padding: '12px 16px',
  backgroundColor: 'rgba(60, 60, 60, 0.8)',
  color: 'white',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  transition: 'all 0.2s ease',
  marginBottom: '8px',
};

const buttonLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const dividerStyle = {
  height: '1px',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  margin: '16px 0',
};

// SETTINGS: Change these values to adjust the camera
const ORBIT_DISTANCE = 1500; 
const ORBIT_PITCH = -45; 
const ORBIT_HEADING = 0; 

function CesiumGlobe({ markers = [] }) {
  const viewerRef = useRef(null);
  const orbitIntervalRef = useRef(null);
  const tilesetRef = useRef(null);
  const [showBuildings, setShowBuildings] = useState(true);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [drawnPolygons, setDrawnPolygons] = useState([]);
  const drawHandlerRef = useRef(null);
  const [enableExtrusion, setEnableExtrusion] = useState(false);
  const [extrusionHeight, setExtrusionHeight] = useState(100);
  const [baseHeight, setBaseHeight] = useState(0);
  const [polygonColor, setPolygonColor] = useState('#00FFFF'); // Cyan default
  const [selectedPolygonId, setSelectedPolygonId] = useState(null);

  // File upload and path following state
  const [uploadedFeatures, setUploadedFeatures] = useState([]);
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [isFollowingPath, setIsFollowingPath] = useState(false);
  const pathAnimationRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stop orbit and unlock camera when drawing mode is activated
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    if (isDrawingPolygon) {
      // Stop orbit
      if (orbitIntervalRef.current) {
        clearInterval(orbitIntervalRef.current);
        orbitIntervalRef.current = null;
      }
      
      // Unlock the camera completely
      viewer.camera.lookAtTransform(Matrix4.IDENTITY);
      
      console.log('🖊️ Drawing mode activated - camera unlocked and ready');
    }
  }, [isDrawingPolygon]);

  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    const stopOrbit = () => {
        if (orbitIntervalRef.current) {
            clearInterval(orbitIntervalRef.current);
            orbitIntervalRef.current = null;
            
            // Unlock the camera to return full control to the user
            viewer.camera.lookAtTransform(Matrix4.IDENTITY);
            
            console.log("Orbit stopped and camera unlocked - user has full control.");
        }
    };
    
    // Set up event handler to stop orbit on user interaction
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas); 
    handler.setInputAction(stopOrbit, ScreenSpaceEventType.LEFT_DOWN);
    handler.setInputAction(stopOrbit, ScreenSpaceEventType.RIGHT_DOWN);
    handler.setInputAction(stopOrbit, ScreenSpaceEventType.MIDDLE_DOWN);
    handler.setInputAction(stopOrbit, ScreenSpaceEventType.WHEEL);

    const initializeViewer = async () => {
      // Load terrain once
      if (!viewer.terrainProvider._url) {
          try {
            const terrainProvider = await CesiumTerrainProvider.fromIonAssetId(1);
            viewer.terrainProvider = terrainProvider;
            viewer.scene.globe.depthTestAgainstTerrain = true;
          } catch (error) {
            console.error('❌ Failed to load terrain:', error);
          }
      }

      // Load OSM Buildings once (if not already loaded)
      if (!tilesetRef.current) {
        const osmTilesetId = 96188;
        try {
          const tileset = await Cesium3DTileset.fromIonAssetId(osmTilesetId);
          viewer.scene.primitives.add(tileset);
          const extras = tileset.asset.extras;
          if (defined(extras) && defined(extras.ion) && defined(extras.ion.defaultStyle)) {
            tileset.style = new Cesium3DTileStyle(extras.ion.defaultStyle);
          }
          tilesetRef.current = tileset;
          tileset.show = showBuildings;
          console.log('✅ OSM Buildings loaded!');
        } catch (error) {
          console.error('❌ Failed to load tileset (Buildings):', error);
        }
      }

      // Fly-to and orbit logic 
      if (markers.length > 0) {
        stopOrbit(); 

        const marker = markers[markers.length - 1]; 

        const startOrbit = (center) => {
          stopOrbit(); 
          
          // let heading = ORBIT_HEADING;
          // orbitIntervalRef.current = setInterval(() => {
          //   heading += 0.3; 
          //   if (heading >= 360) heading = 0;

          //   viewer.camera.lookAt(
          //     center,
          //     new HeadingPitchRange(
          //       CesiumMath.toRadians(heading),
          //       CesiumMath.toRadians(ORBIT_PITCH),
          //       ORBIT_DISTANCE
          //     )
          //   );
          // }, 30); 
        };

        const flyToAndOrbit = () => {
          // STAGE 1: Fly "down" (high angle, looking down)
          viewer.camera.flyToBoundingSphere(
            new BoundingSphere(marker.position, 0),
            {
              offset: new HeadingPitchRange(
                CesiumMath.toRadians(ORBIT_HEADING),
                CesiumMath.toRadians(-80.0), 
                ORBIT_DISTANCE * 3 
              ),
              duration: 3, 
              easingFunction: EasingFunction.CUBIC_OUT,
              
              complete: () => {
                // STAGE 2: Fly to the final orbit view
                viewer.camera.flyToBoundingSphere(
                  new BoundingSphere(marker.position, 0),
                  {
                    offset: new HeadingPitchRange(
                      CesiumMath.toRadians(ORBIT_HEADING),
                      CesiumMath.toRadians(ORBIT_PITCH),
                      ORBIT_DISTANCE
                    ),
                    duration: 3, 
                    easingFunction: EasingFunction.CUBIC_IN_OUT,
                    
                    // ORBIT: Start the continuous orbit
                    complete: () => {
                      startOrbit(marker.position);
                    }
                  }
                );
              }
            }
          );
        };
        
        // Start the new flight sequence
        // flyToAndOrbit();
      }
    };

    initializeViewer();

    // Cleanup: This runs when the component unmounts OR when 'markers' changes
    return () => {
      stopOrbit();
      handler.destroy(); 
    };
  }, [markers, showBuildings]);

  // Toggle buildings visibility
  useEffect(() => {
    if (tilesetRef.current) {
      tilesetRef.current.show = showBuildings;
      console.log(`Buildings ${showBuildings ? 'shown' : 'hidden'}`);
    }
  }, [showBuildings]);

  const toggleBuildings = () => {
    setShowBuildings(prev => !prev);
  };

  const startDrawingPolygon = () => {
    setIsDrawingPolygon(true);
    setPolygonPoints([]);
    setSelectedPolygonId(null); // Deselect any selected polygon
    console.log('🖊️ Polygon drawing mode activated. Click to add points. Right-click to finish.');
  };

  const stopDrawingPolygon = () => {
    if (polygonPoints.length >= 3) {
      // Save the completed polygon with extrusion settings
      setDrawnPolygons(prev => [...prev, {
        id: Date.now(),
        points: [...polygonPoints],
        extruded: enableExtrusion,
        height: enableExtrusion ? extrusionHeight : 0.5, // Save minimum height for fill visibility
        baseHeight: baseHeight,
        color: polygonColor
      }]);
      console.log('✅ Polygon saved with', polygonPoints.length, 'points',
        enableExtrusion ? `(base: ${baseHeight}m, extruded to: ${baseHeight + extrusionHeight}m)` : `(base: ${baseHeight}m, fill: 0.5m)`);
    }
    setIsDrawingPolygon(false);
    setPolygonPoints([]);
  };

  const updateSelectedPolygon = (updates) => {
    if (!selectedPolygonId) return;
    
    setDrawnPolygons(prev => prev.map(polygon => 
      polygon.id === selectedPolygonId 
        ? { ...polygon, ...updates }
        : polygon
    ));
  };

  const deleteSelectedPolygon = () => {
    if (!selectedPolygonId) return;
    
    setDrawnPolygons(prev => prev.filter(polygon => polygon.id !== selectedPolygonId));
    setSelectedPolygonId(null);
    console.log('🗑️ Polygon deleted');
  };

  const selectedPolygon = drawnPolygons.find(p => p.id === selectedPolygonId);

  const clearAllPolygons = () => {
    setDrawnPolygons([]);
    setPolygonPoints([]);
    setIsDrawingPolygon(false);
    setSelectedPolygonId(null);
    console.log('🗑️ All polygons cleared');
  };

  // File upload handlers
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        parseAndAddFeatures(jsonData);
      } catch (error) {
        console.error('❌ Error parsing JSON file:', error);
        alert('Invalid JSON file. Please upload a valid GeoJSON or JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const parseAndAddFeatures = (data) => {
    const features = [];

    // Check if it's GeoJSON format
    if (data.type === 'FeatureCollection' && data.features) {
      data.features.forEach((feature, index) => {
        const parsedFeature = parseGeoJSONFeature(feature, index);
        if (parsedFeature) features.push(parsedFeature);
      });
    } else if (data.type === 'Feature') {
      const parsedFeature = parseGeoJSONFeature(data, 0);
      if (parsedFeature) features.push(parsedFeature);
    } else if (data.coordinates) {
      // Simple coordinate array format
      const parsedFeature = parseSimpleCoordinates(data);
      if (parsedFeature) features.push(parsedFeature);
    }

    if (features.length > 0) {
      setUploadedFeatures(prev => [...prev, ...features]);
      console.log(`✅ Added ${features.length} feature(s) to the map`);
    } else {
      alert('No valid features found in the file.');
    }
  };

  const parseGeoJSONFeature = (feature, index) => {
    const geometry = feature.geometry;
    const id = Date.now() + index;

    if (!geometry || !geometry.coordinates) return null;

    let positions = [];
    let type = '';

    switch (geometry.type) {
      case 'Point':
        type = 'point';
        const [lon, lat, alt = 0] = geometry.coordinates;
        positions = [Cartesian3.fromDegrees(lon, lat, alt)];
        break;

      case 'LineString':
        type = 'polyline';
        positions = geometry.coordinates.map(coord =>
          Cartesian3.fromDegrees(coord[0], coord[1], coord[2] || 0)
        );
        break;

      case 'Polygon':
        type = 'polygon';
        // Use the outer ring (first array)
        positions = geometry.coordinates[0].map(coord =>
          Cartesian3.fromDegrees(coord[0], coord[1], coord[2] || 0)
        );
        break;

      case 'MultiLineString':
        type = 'multipolyline';
        positions = geometry.coordinates.map(lineCoords =>
          lineCoords.map(coord => Cartesian3.fromDegrees(coord[0], coord[1], coord[2] || 0))
        );
        break;

      default:
        console.warn(`Unsupported geometry type: ${geometry.type}`);
        return null;
    }

    return {
      id,
      type,
      positions,
      color: '#00FFFF', // Default cyan color
      name: feature.properties?.name || `Feature ${index + 1}`,
      properties: feature.properties || {}
    };
  };

  const parseSimpleCoordinates = (data) => {
    if (!data.coordinates || !Array.isArray(data.coordinates)) return null;

    const coords = data.coordinates;
    let positions = [];
    let type = '';

    // Detect type based on structure
    if (coords.length > 0 && Array.isArray(coords[0])) {
      // It's a line or polygon
      positions = coords.map(coord =>
        Cartesian3.fromDegrees(coord[0], coord[1], coord[2] || 0)
      );
      type = 'polyline'; // Assume polyline
    } else if (coords.length >= 2) {
      // Single point [lon, lat, alt?]
      type = 'point';
      positions = [Cartesian3.fromDegrees(coords[0], coords[1], coords[2] || 0)];
    }

    if (positions.length === 0) return null;

    return {
      id: Date.now(),
      type,
      positions,
      color: '#00FFFF',
      name: data.name || 'Uploaded Feature',
      properties: data.properties || {}
    };
  };

  const updateFeatureColor = (featureId, newColor) => {
    setUploadedFeatures(prev =>
      prev.map(feature =>
        feature.id === featureId ? { ...feature, color: newColor } : feature
      )
    );
  };

  const deleteFeature = (featureId) => {
    setUploadedFeatures(prev => prev.filter(f => f.id !== featureId));
    if (selectedFeatureId === featureId) {
      setSelectedFeatureId(null);
    }
    console.log('🗑️ Feature deleted');
  };

  const followPath = (feature) => {
    if (feature.type !== 'polyline' && feature.type !== 'multipolyline') {
      alert('Path following only works with polylines!');
      return;
    }

    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    // Stop any existing animation
    if (pathAnimationRef.current) {
      clearInterval(pathAnimationRef.current);
      pathAnimationRef.current = null;
    }

    setIsFollowingPath(true);
    viewer.camera.lookAtTransform(Matrix4.IDENTITY);

    const positions = feature.type === 'polyline' ? feature.positions : feature.positions[0];
    const totalPoints = positions.length;
    const duration = 30000; // 30 seconds total
    const fps = 60;
    const totalFrames = (duration / 1000) * fps;

    let currentFrame = 0;

    // Initial fly to start position
    viewer.camera.flyTo({
      destination: positions[0],
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-30),
        roll: 0.0
      },
      duration: 2,
      complete: () => {
        // Start smooth path animation with interpolation
        pathAnimationRef.current = setInterval(() => {
          currentFrame++;

          // Calculate smooth progress along the path (0 to 1)
          const progress = currentFrame / totalFrames;

          if (progress >= 1) {
            clearInterval(pathAnimationRef.current);
            pathAnimationRef.current = null;
            setIsFollowingPath(false);
            console.log('✅ Path following completed');
            return;
          }

          // Calculate exact position along path using smooth interpolation
          const exactPosition = progress * (totalPoints - 1);
          const lowerIndex = Math.floor(exactPosition);
          const upperIndex = Math.min(lowerIndex + 1, totalPoints - 1);
          const fraction = exactPosition - lowerIndex;

          // Interpolate between two points for smooth movement
          const currentPos = positions[lowerIndex];
          const nextPos = positions[upperIndex];

          // Linear interpolation between positions
          const interpolatedPos = new Cartesian3(
            currentPos.x + (nextPos.x - currentPos.x) * fraction,
            currentPos.y + (nextPos.y - currentPos.y) * fraction,
            currentPos.z + (nextPos.z - currentPos.z) * fraction
          );

          // Calculate heading towards next point for smooth camera orientation
          const cartographic1 = Cartographic.fromCartesian(currentPos);
          const cartographic2 = Cartographic.fromCartesian(nextPos);

          const deltaLon = cartographic2.longitude - cartographic1.longitude;
          const deltaLat = cartographic2.latitude - cartographic1.latitude;
          const heading = Math.atan2(deltaLon, deltaLat);

          // Position camera slightly above and behind the current point
          const offset = new HeadingPitchRange(
            heading,
            CesiumMath.toRadians(-25),
            400
          );

          viewer.camera.lookAt(interpolatedPos, offset);
        }, 1000 / fps);
      }
    });
  };

  const stopFollowingPath = () => {
    if (pathAnimationRef.current) {
      clearInterval(pathAnimationRef.current);
      pathAnimationRef.current = null;
    }
    setIsFollowingPath(false);

    const viewer = viewerRef.current?.cesiumElement;
    if (viewer) {
      viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    }
    console.log('⏹️ Path following stopped');
  };

  const selectedFeature = uploadedFeatures.find(f => f.id === selectedFeatureId);

  // Handle polygon drawing
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) {
      if (drawHandlerRef.current) {
        drawHandlerRef.current.destroy();
        drawHandlerRef.current = null;
      }
      return;
    }

    // If drawing mode is active, use drawing handler
    if (isDrawingPolygon) {
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      drawHandlerRef.current = handler;

      // Left click to add point
      handler.setInputAction((click) => {
        // Always use globe picking for consistent terrain heights
        const ray = viewer.camera.getPickRay(click.position);
        let cartesian = viewer.scene.globe.pick(ray, viewer.scene);

        // If globe picking fails (e.g., looking at horizon), fall back to ellipsoid
        if (!defined(cartesian)) {
          cartesian = viewer.camera.pickEllipsoid(
            click.position,
            viewer.scene.globe.ellipsoid
          );
        }

        if (cartesian) {
          setPolygonPoints(prev => {
            const newPoints = [...prev, cartesian];
            console.log('✅ Point added at terrain surface. Total points:', newPoints.length);
            return newPoints;
          });
        } else {
          console.warn('⚠️ Could not pick position at this location');
        }
      }, ScreenSpaceEventType.LEFT_CLICK);

      // Right click to finish polygon
      handler.setInputAction(() => {
        stopDrawingPolygon();
      }, ScreenSpaceEventType.RIGHT_CLICK);

      return () => {
        if (drawHandlerRef.current) {
          drawHandlerRef.current.destroy();
          drawHandlerRef.current = null;
        }
      };
    } else {
      // If not drawing, enable polygon selection
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      drawHandlerRef.current = handler;

      handler.setInputAction((click) => {
        const pickedObject = viewer.scene.pick(click.position);
        
        if (pickedObject && pickedObject.id && pickedObject.id.polygon) {
          // Extract polygon ID from entity name or id
          const entityId = pickedObject.id.id;
          if (entityId && entityId.startsWith('polygon-')) {
            const polygonId = parseInt(entityId.split('-')[1]);
            setSelectedPolygonId(polygonId);
            console.log('📌 Polygon selected:', polygonId);
          }
        } else {
          // Clicked on empty space, deselect
          setSelectedPolygonId(null);
        }
      }, ScreenSpaceEventType.LEFT_CLICK);

      return () => {
        if (drawHandlerRef.current) {
          drawHandlerRef.current.destroy();
          drawHandlerRef.current = null;
        }
      };
    }
  }, [isDrawingPolygon, polygonPoints, drawnPolygons]);

  return (
    <div style={globeStyle}>
      {/* TOOLBOX - Contains all the buttons */}
      <div style={toolPaneStyle}>
        {/* Header */}
        <div style={toolboxHeaderStyle}>
          <span>🛠️</span>
          <span>Map Tools</span>
        </div>

        {/* Visualization Section */}
        <div style={toolSectionStyle}>
          <div style={sectionTitleStyle}>Visualization</div>
          <button 
            style={toggleButtonStyle}
            onClick={toggleBuildings}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(80, 80, 80, 0.9)';
              e.currentTarget.style.transform = 'translateX(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(60, 60, 60, 0.8)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            <div style={buttonLabelStyle}>
              <span>{showBuildings ? '🏢' : '🌐'}</span>
              <span>3D Buildings</span>
            </div>
            <span style={{ 
              fontSize: '11px', 
              padding: '2px 8px', 
              borderRadius: '12px',
              backgroundColor: showBuildings ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: showBuildings ? '#86efac' : '#fca5a5',
              border: `1px solid ${showBuildings ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}>
              {showBuildings ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Divider */}
        <div style={dividerStyle}></div>

        {/* Edit Selected Polygon Section */}
        {selectedPolygon && (
          <div style={toolSectionStyle}>
            <div style={sectionTitleStyle}>Edit Selected Polygon</div>
            
            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '6px',
              marginBottom: '12px',
            }}>
              <div style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: '#93c5fd',
                marginBottom: '8px'
              }}>
                ✏️ Editing Polygon #{selectedPolygon.id}
              </div>
              
              {/* Edit Color */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  display: 'block',
                  marginBottom: '6px',
                }}>
                  Color
                </label>
                <input
                  type="color"
                  value={selectedPolygon.color}
                  onChange={(e) => updateSelectedPolygon({ color: e.target.value })}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '4px',
                    backgroundColor: 'rgba(40, 40, 40, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                />
              </div>

              {/* Edit Base Height */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  display: 'block',
                  marginBottom: '6px',
                }}>
                  Base Height (meters)
                </label>
                <input
                  type="number"
                  value={selectedPolygon.baseHeight}
                  onChange={(e) => updateSelectedPolygon({ baseHeight: Number(e.target.value) })}
                  min="0"
                  max="10000"
                  step="10"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(40, 40, 40, 0.8)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Edit Extrusion */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                marginBottom: '10px',
              }}>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                  3D Extrusion
                </span>
                <input
                  type="checkbox"
                  checked={selectedPolygon.extruded}
                  onChange={(e) => updateSelectedPolygon({ extruded: e.target.checked })}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                  }}
                />
              </label>

              {/* Edit Extrusion Height */}
              {selectedPolygon.extruded && (
                <div style={{ marginBottom: '10px' }}>
                  <label style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    display: 'block',
                    marginBottom: '6px',
                  }}>
                    Extrusion Height (meters)
                  </label>
                  <input
                    type="number"
                    value={selectedPolygon.height}
                    onChange={(e) => updateSelectedPolygon({ height: Number(e.target.value) })}
                    min="1"
                    max="10000"
                    step="10"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(40, 40, 40, 0.8)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                    }}
                  />
                  <div style={{
                    fontSize: '11px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginTop: '4px',
                  }}>
                    Top elevation: {selectedPolygon.baseHeight + selectedPolygon.height}m
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => setSelectedPolygonId(null)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: 'rgba(100, 100, 100, 0.8)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Done
                </button>
                <button
                  onClick={deleteSelectedPolygon}
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Divider */}
        <div style={dividerStyle}></div>

        {/* Drawing Tools Section */}
        <div style={toolSectionStyle}>
          <div style={sectionTitleStyle}>Drawing Tools</div>
          
          {/* Drawing Instructions */}
          {isDrawingPolygon ? (
            <div style={{
              padding: '10px',
              marginBottom: '10px',
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '6px',
              fontSize: '12px',
              lineHeight: '1.5',
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px', color: '#86efac' }}>
                ✏️ Drawing Mode Active
              </div>
              <div style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                • <strong>Left-click</strong> to add points<br/>
                • <strong>Right-click</strong> to finish<br/>
                • Min. 3 points required
              </div>
            </div>
          ) : drawnPolygons.length > 0 && (
            <div style={{
              padding: '10px',
              marginBottom: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '6px',
              fontSize: '12px',
              lineHeight: '1.5',
              color: 'rgba(255, 255, 255, 0.8)',
            }}>
              💡 Click any polygon on the map to edit it
            </div>
          )}
          
          <button 
            style={{
              ...toggleButtonStyle,
              backgroundColor: isDrawingPolygon ? 'rgba(34, 197, 94, 0.3)' : 'rgba(60, 60, 60, 0.8)',
              borderColor: isDrawingPolygon ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.2)',
            }}
            onClick={isDrawingPolygon ? stopDrawingPolygon : startDrawingPolygon}
            onMouseEnter={(e) => {
              if (!isDrawingPolygon) {
                e.currentTarget.style.backgroundColor = 'rgba(80, 80, 80, 0.9)';
                e.currentTarget.style.transform = 'translateX(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isDrawingPolygon) {
                e.currentTarget.style.backgroundColor = 'rgba(60, 60, 60, 0.8)';
                e.currentTarget.style.transform = 'translateX(0)';
              }
            }}
          >
            <div style={buttonLabelStyle}>
              <span>🖊️</span>
              <span>{isDrawingPolygon ? 'Finish Polygon' : 'Draw Polygon'}</span>
            </div>
            {isDrawingPolygon && (
              <span style={{ 
                fontSize: '11px', 
                padding: '2px 8px', 
                borderRadius: '12px',
                backgroundColor: 'rgba(34, 197, 94, 0.3)',
                color: '#86efac',
                border: '1px solid rgba(34, 197, 94, 0.5)',
              }}>
                {polygonPoints.length} pts
              </span>
            )}
          </button>

          {/* Extrusion Controls */}
          <div style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: 'rgba(50, 50, 50, 0.5)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            {/* Color Picker */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.7)',
                display: 'block',
                marginBottom: '6px',
              }}>
                Polygon Color
              </label>
              <input
                type="color"
                value={polygonColor}
                onChange={(e) => setPolygonColor(e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '4px',
                  backgroundColor: 'rgba(40, 40, 40, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Extrusion Toggle */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              marginBottom: '10px',
            }}>
              <div style={buttonLabelStyle}>
                <span>📦</span>
                <span style={{ fontSize: '13px' }}>Extrusion (3D)</span>
              </div>
              <input
                type="checkbox"
                checked={enableExtrusion}
                onChange={(e) => setEnableExtrusion(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                }}
              />
            </label>

            {/* Base Height Input */}
            <div style={{ marginTop: '10px' }}>
              <label style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.7)',
                display: 'block',
                marginBottom: '6px',
              }}>
                Base Height (meters)
              </label>
              <input
                type="number"
                value={baseHeight}
                onChange={(e) => setBaseHeight(Number(e.target.value))}
                min="0"
                max="10000"
                step="10"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(40, 40, 40, 0.8)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '4px',
              }}>
                Elevation from ground: {baseHeight}m
              </div>
            </div>

            {/* Extrusion Height Input */}
            {enableExtrusion && (
              <div style={{ marginTop: '10px' }}>
                <label style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  display: 'block',
                  marginBottom: '6px',
                }}>
                  Extrusion Height (meters)
                </label>
                <input
                  type="number"
                  value={extrusionHeight}
                  onChange={(e) => setExtrusionHeight(Number(e.target.value))}
                  min="1"
                  max="10000"
                  step="10"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(40, 40, 40, 0.8)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginTop: '4px',
                }}>
                  Top elevation: {baseHeight + extrusionHeight}m
                </div>
              </div>
            )}
          </div>

          {drawnPolygons.length > 0 && (
            <button 
              style={{...toggleButtonStyle, marginTop: '12px'}}
              onClick={clearAllPolygons}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
                e.currentTarget.style.transform = 'translateX(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(60, 60, 60, 0.8)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <div style={buttonLabelStyle}>
                <span>🗑️</span>
                <span>Clear Polygons</span>
              </div>
              <span style={{ 
                fontSize: '11px', 
                padding: '2px 8px', 
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}>
                {drawnPolygons.length}
              </span>
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={dividerStyle}></div>

        {/* Camera Controls Section */}
        <div style={toolSectionStyle}>
          <div style={sectionTitleStyle}>Camera Controls</div>
          <button 
            style={{...toggleButtonStyle, opacity: 0.5, cursor: 'not-allowed'}}
            disabled
          >
            <div style={buttonLabelStyle}>
              <span>📹</span>
              <span>Reset View</span>
            </div>
          </button>
          <button 
            style={{...toggleButtonStyle, opacity: 0.5, cursor: 'not-allowed'}}
            disabled
          >
            <div style={buttonLabelStyle}>
              <span>🎥</span>
              <span>Camera Path</span>
            </div>
          </button>
        </div>

        {/* Divider */}
        <div style={dividerStyle}></div>

        {/* File Upload Section */}
        <div style={toolSectionStyle}>
          <div style={sectionTitleStyle}>Import Features</div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.geojson"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          <button
            style={toggleButtonStyle}
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(80, 80, 80, 0.9)';
              e.currentTarget.style.transform = 'translateX(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(60, 60, 60, 0.8)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            <div style={buttonLabelStyle}>
              <span>📁</span>
              <span>Upload GeoJSON</span>
            </div>
          </button>

          {/* Uploaded Features List */}
          {uploadedFeatures.length > 0 && (
            <div style={{
              marginTop: '12px',
              maxHeight: '300px',
              overflowY: 'auto',
            }}>
              {uploadedFeatures.map(feature => (
                <div
                  key={feature.id}
                  style={{
                    padding: '10px',
                    marginBottom: '8px',
                    backgroundColor: selectedFeatureId === feature.id
                      ? 'rgba(59, 130, 246, 0.2)'
                      : 'rgba(50, 50, 50, 0.5)',
                    border: `1px solid ${
                      selectedFeatureId === feature.id
                        ? 'rgba(59, 130, 246, 0.4)'
                        : 'rgba(255, 255, 255, 0.1)'
                    }`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedFeatureId(feature.id)}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: '600' }}>
                      {feature.type === 'point' && '📍'}
                      {feature.type === 'polyline' && '📏'}
                      {feature.type === 'polygon' && '⬡'}
                      {feature.type === 'multipolyline' && '🗺️'}
                      {' '}{feature.name}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFeature(feature.id);
                      }}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '10px',
                      }}
                    >
                      Delete
                    </button>
                  </div>

                  {/* Color Picker */}
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{
                      fontSize: '10px',
                      color: 'rgba(255, 255, 255, 0.6)',
                      display: 'block',
                      marginBottom: '4px',
                    }}>
                      Color
                    </label>
                    <input
                      type="color"
                      value={feature.color}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateFeatureColor(feature.id, e.target.value);
                      }}
                      style={{
                        width: '100%',
                        height: '30px',
                        padding: '2px',
                        backgroundColor: 'rgba(40, 40, 40, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    />
                  </div>

                  {/* Follow Path Button (only for polylines) */}
                  {(feature.type === 'polyline' || feature.type === 'multipolyline') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        followPath(feature);
                      }}
                      disabled={isFollowingPath}
                      style={{
                        width: '100%',
                        padding: '6px',
                        backgroundColor: isFollowingPath
                          ? 'rgba(100, 100, 100, 0.5)'
                          : 'rgba(34, 197, 94, 0.3)',
                        color: isFollowingPath ? '#999' : '#86efac',
                        border: `1px solid ${
                          isFollowingPath
                            ? 'rgba(100, 100, 100, 0.3)'
                            : 'rgba(34, 197, 94, 0.4)'
                        }`,
                        borderRadius: '4px',
                        cursor: isFollowingPath ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                      }}
                    >
                      {isFollowingPath ? '⏸️ Following...' : '🎬 Follow Path'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Stop Following Button */}
          {isFollowingPath && (
            <button
              onClick={stopFollowingPath}
              style={{
                ...toggleButtonStyle,
                marginTop: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.3)',
                borderColor: 'rgba(239, 68, 68, 0.4)',
              }}
            >
              <div style={buttonLabelStyle}>
                <span>⏹️</span>
                <span>Stop Following</span>
              </div>
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={dividerStyle}></div>

        {/* Measurements Section */}
        <div style={toolSectionStyle}>
          <div style={sectionTitleStyle}>Measurements</div>
          <button 
            style={{...toggleButtonStyle, opacity: 0.5, cursor: 'not-allowed'}}
            disabled
          >
            <div style={buttonLabelStyle}>
              <span>📏</span>
              <span>Distance</span>
            </div>
          </button>
          <button 
            style={{...toggleButtonStyle, opacity: 0.5, cursor: 'not-allowed'}}
            disabled
          >
            <div style={buttonLabelStyle}>
              <span>📐</span>
              <span>Area</span>
            </div>
          </button>
        </div>

        {/* Info Footer */}
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.4)',
          textAlign: 'center',
          lineHeight: '1.4',
        }}>
          {drawnPolygons.length > 0 
            ? `${drawnPolygons.length} polygon${drawnPolygons.length > 1 ? 's' : ''} drawn • Click to edit`
            : 'Start by drawing a polygon on the map'}
        </div>
      </div>
      {/* END OF TOOLBOX */}

      <Viewer
        full
        ref={viewerRef}
        timeline={false}
        baseLayerPicker={true}
        geocoder={false}
        homeButton={false}
        infoBox={false}
        sceneModePicker={false}
        navigationHelpButton={false}
        animation={false}
        fullscreenButton={false}
        vrButton={false}
      >
        {/* Render active polygon being drawn */}
        {isDrawingPolygon && polygonPoints.length > 0 && (
          <>
            {/* Draw Points */}
            {polygonPoints.map((point, idx) => (
              <Entity
                key={`draw-point-${idx}`}
                position={point}
                point={{
                  pixelSize: 12,
                  color: Color.YELLOW,
                  outlineColor: Color.BLACK,
                  outlineWidth: 2,
                  heightReference: HeightReference.NONE,
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                }}
              />
            ))}
            
            {/* Preview filled polygon - shows once we have 3+ points */}
            {polygonPoints.length >= 3 && (
              <Entity
                key="draw-polygon-preview"
                polygon={{
                  hierarchy: polygonPoints,
                  material: Color.fromCssColorString(polygonColor).withAlpha(0.7),
                  fill: true,
                  outline: true,
                  outlineColor: Color.YELLOW,
                  outlineWidth: 3,
                  height: baseHeight,
                  extrudedHeight: enableExtrusion ? baseHeight + extrusionHeight : baseHeight + 0.5,
                  closeTop: enableExtrusion,
                  closeBottom: enableExtrusion,
                  perPositionHeight: false,
                  heightReference: HeightReference.RELATIVE_TO_GROUND,
                  extrudedHeightReference: HeightReference.RELATIVE_TO_GROUND,
                }}
              />
            )}

            {/* Polyline connecting points - only show when less than 3 points */}
            {polygonPoints.length === 2 && (
              <Entity
                key="draw-line-preview"
                polyline={{
                  positions: [...polygonPoints, polygonPoints[0]], // Close the loop
                  width: 3,
                  material: Color.YELLOW,
                  clampToGround: false,
                  arcType: 0, // NONE - straight lines
                  depthFailMaterial: Color.YELLOW.withAlpha(0.5),
                }}
              />
            )}
          </>
        )}

        {/* Render completed polygons */}
        {drawnPolygons.map(polygon => {
          const isSelected = polygon.id === selectedPolygonId;
          const polygonColorObj = Color.fromCssColorString(polygon.color);

          return (
            <Entity
              key={`polygon-${polygon.id}`}
              id={`polygon-${polygon.id}`}
              polygon={{
                hierarchy: polygon.points,
                material: isSelected
                  ? polygonColorObj.withAlpha(0.7)
                  : polygonColorObj.withAlpha(0.6),
                fill: true,
                outline: true,
                outlineColor: isSelected ? Color.YELLOW : polygonColorObj,
                outlineWidth: isSelected ? 4 : 2,
                height: polygon.baseHeight,
                extrudedHeight: polygon.baseHeight + polygon.height,
                closeTop: polygon.extruded,
                closeBottom: polygon.extruded,
                perPositionHeight: false,
                heightReference: HeightReference.RELATIVE_TO_GROUND,
                extrudedHeightReference: HeightReference.RELATIVE_TO_GROUND,
              }}
            />
          );
        })}

        {/* Render uploaded features */}
        {uploadedFeatures.map(feature => {
          const featureColor = Color.fromCssColorString(feature.color);
          const isSelected = feature.id === selectedFeatureId;

          // Render Point
          if (feature.type === 'point') {
            return (
              <Entity
                key={`feature-${feature.id}`}
                position={feature.positions[0]}
                point={{
                  pixelSize: 15,
                  color: featureColor,
                  outlineColor: isSelected ? Color.YELLOW : Color.WHITE,
                  outlineWidth: isSelected ? 3 : 2,
                  heightReference: HeightReference.RELATIVE_TO_GROUND,
                }}
                label={{
                  text: feature.name,
                  font: '14px sans-serif',
                  fillColor: Color.WHITE,
                  outlineColor: Color.BLACK,
                  outlineWidth: 2,
                  style: 0, // FILL
                  pixelOffset: new Cartesian3(0, -20, 0),
                  heightReference: HeightReference.RELATIVE_TO_GROUND,
                }}
              />
            );
          }

          // Render Polyline
          if (feature.type === 'polyline') {
            return (
              <Entity
                key={`feature-${feature.id}`}
                polyline={{
                  positions: feature.positions,
                  width: isSelected ? 32 : 24,
                  material: Color.YELLOW,
                  clampToGround: true,
                }}
              />
            );
          }

          // Render MultiPolyline
          if (feature.type === 'multipolyline') {
            return (
              <React.Fragment key={`feature-${feature.id}`}>
                {feature.positions.map((linePositions, idx) => (
                  <Entity
                    key={`feature-${feature.id}-line-${idx}`}
                    polyline={{
                      positions: linePositions,
                      width: isSelected ? 32 : 24,
                      material: Color.YELLOW,
                      clampToGround: true,
                    }}
                  />
                ))}
              </React.Fragment>
            );
          }

          // Render Polygon
          if (feature.type === 'polygon') {
            return (
              <Entity
                key={`feature-${feature.id}`}
                polygon={{
                  hierarchy: feature.positions,
                  material: featureColor.withAlpha(0.6),
                  fill: true,
                  outline: true,
                  outlineColor: isSelected ? Color.YELLOW : featureColor,
                  outlineWidth: isSelected ? 4 : 2,
                  height: 0,
                  extrudedHeight: 0.5,
                  heightReference: HeightReference.RELATIVE_TO_GROUND,
                  extrudedHeightReference: HeightReference.RELATIVE_TO_GROUND,
                }}
              />
            );
          }

          return null;
        })}
      </Viewer>
    </div>
  );
}

export default CesiumGlobe;