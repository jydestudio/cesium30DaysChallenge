import React, { useRef, useEffect, useState } from "react";
import { Viewer } from "resium";
import { 
  Cartesian3, 
  Color, 
  SingleTileImageryProvider, 
  IonImageryProvider,
  EasingFunction,
  JulianDate // <--- 1. Import JulianDate
} from "cesium";

const Planets = () => {
  const viewerRef = useRef(null);
  const [currentPlanetIndex, setCurrentPlanetIndex] = useState(2); // Start with Earth

  const planets = [
    {
      name: "Mercury",
      texture: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Mercury_in_color_-_Prockter07_centered.jpg/1024px-Mercury_in_color_-_Prockter07_centered.jpg",
      color: Color.fromCssColorString("#8C7853"),
      radius: 2439700,
      height: 18000000 
    },
    {
      name: "Venus",
      texture: "https://upload.wikimedia.org/wikipedia/commons/1/19/Cylindrical_Map_of_Venus.jpg",
      color: Color.fromCssColorString("#FFC649"),
      radius: 6051800,
      height: 40000000 
    },
    {
      name: "Earth",
      texture: "default", 
      color: Color.fromCssColorString("#4169E1"),
      radius: 6371000,
      height: 45000000 
    },
    {
      name: "Moon",
      texture: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/1200px-FullMoon2010.jpg",
      color: Color.fromCssColorString("#C0C0C0"),
      radius: 1737400,
      height: 18000000 
    },
    {
      name: "Mars",
      texture: "https://upload.wikimedia.org/wikipedia/commons/0/02/OSIRIS_Mars_true_color.jpg",
      color: Color.fromCssColorString("#CD5C5C"),
      radius: 3389500,
      height: 25000000 
    },
    {
      name: "Jupiter",
      texture: "https://upload.wikimedia.org/wikipedia/commons/e/e2/Jupiter.jpg",
      color: Color.fromCssColorString("#DAA520"),
      radius: 69911000,
      height: 45000000 // Fixed height to be larger for Jupiter
    },
    {
      name: "Saturn",
      texture: null,
      color: Color.fromCssColorString("#F4A460"),
      radius: 58232000,
      height: 400000000 
    },
    {
      name: "Uranus",
      texture: null,
      color: Color.fromCssColorString("#4FD0E0"),
      radius: 25362000,
      height: 180000000
    },
    {
      name: "Neptune",
      texture: null,
      color: Color.fromCssColorString("#4166F5"),
      radius: 24622000,
      height: 180000000
    }
  ];

  // Initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      const viewer = viewerRef.current?.cesiumElement;
      if (!viewer) return;
      
      // Initial view
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(0, 0, planets[2].height)
      });
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Handle planet changes
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    const planet = planets[currentPlanetIndex];
    let isMounted = true;

    const changePlanet = async () => {
      try {
        // 1. Prepare Texture
        let imageryProvider;
        if (planet.name === "Earth") {
          imageryProvider = await IonImageryProvider.fromAssetId(2);
        } else if (planet.texture) {
          imageryProvider = await SingleTileImageryProvider.fromUrl(planet.texture);
        }

        if (!isMounted) return;

        // 2. Swap Layers
        viewer.imageryLayers.removeAll();
        if (imageryProvider) {
          viewer.imageryLayers.addImageryProvider(imageryProvider);
          viewer.scene.globe.baseColor = Color.WHITE;
        } else {
          viewer.scene.globe.baseColor = planet.color;
        }

        // 3. Lighting & Atmosphere Configuration
        if (planet.name === "Earth") {
          viewer.scene.skyAtmosphere.show = true;
          viewer.scene.globe.enableLighting = true;

          // --- FIX FOR DARK AFRICA ---
          // Set time to 12:00 UTC (Noon in London/Africa)
          // This forces the sun to be directly over Africa
          const noonTime = JulianDate.fromIso8601("2024-06-01T12:00:00Z");
          viewer.clock.currentTime = noonTime;
          viewer.clock.shouldAnimate = false; // Freeze time so it stays bright

        } else {
          viewer.scene.skyAtmosphere.show = false;
          viewer.scene.globe.enableLighting = false; // Other planets are fully lit
        }

        // 4. Camera Movement
        const currentPos = viewer.camera.positionCartographic;
        
        const destination = Cartesian3.fromRadians(
          currentPos.longitude,
          currentPos.latitude,
          planet.height
        );

        viewer.camera.flyTo({
          destination: destination,
          duration: 2.5, // Adjusted to be smooth but not too slow
          easingFunction: EasingFunction.QUADRATIC_IN_OUT
        });

      } catch (error) {
        console.error("Error changing planet:", error);
        if (isMounted) viewer.scene.globe.baseColor = planet.color;
      }
    };

    changePlanet();

    return () => { isMounted = false; };
  }, [currentPlanetIndex]);

  const handlePrevious = () => {
    setCurrentPlanetIndex((prev) => (prev === 0 ? planets.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentPlanetIndex((prev) => (prev === planets.length - 1 ? 0 : prev + 1));
  };

  return (
    <>
      <Viewer
        ref={viewerRef}
        full
        baseLayerPicker={false}
        timeline={false}
        animation={false}
        homeButton={false}
        navigationHelpButton={false}
        geocoder={false}
        sceneModePicker={false}
      />
      
      {/* Title */}
      <div style={{
        position: 'absolute', top: '40px', left: '50%', transform: 'translateX(-50%)',
        padding: '20px 40px', backgroundColor: 'rgba(0, 0, 0, 0.8)', color: 'white',
        fontSize: '36px', fontWeight: 'bold', borderRadius: '12px', zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(10px)'
      }}>
        {planets[currentPlanetIndex].name}
      </div>

      <button onClick={handlePrevious} style={arrowStyle('left')}> ‹ </button>
      <button onClick={handleNext} style={arrowStyle('right')}> › </button>

      <div style={{
        position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
        padding: '12px 24px', backgroundColor: 'rgba(0, 0, 0, 0.7)', color: 'white',
        fontSize: '18px', fontWeight: 'bold', borderRadius: '20px', zIndex: 1000,
        backdropFilter: 'blur(10px)'
      }}>
        {currentPlanetIndex + 1} / {planets.length}
      </div>
    </>
  );
};

const arrowStyle = (side) => ({
  position: 'absolute',
  [side]: '40px',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '70px',
  height: '70px',
  fontSize: '32px',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  color: 'white',
  border: '3px solid white',
  borderRadius: '50%',
  cursor: 'pointer',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(10px)'
});

export default Planets;