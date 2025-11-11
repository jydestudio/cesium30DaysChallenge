import React, { useRef, useEffect, useState } from "react";
import { Viewer, Entity } from "resium";
import { Math, PolylineOutlineMaterialProperty, LabelStyle, VerticalOrigin, Cartesian3, Cartesian2, Color, UrlTemplateImageryProvider, WebMercatorTilingScheme, CatmullRomSpline } from "cesium";

const CesiumGlobe = () => {
  const viewerRef = useRef(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const viewer = viewerRef.current?.cesiumElement;

      if (!viewer) {
        console.log("❌ Still no viewer");
        return;
      }

      console.log("✅ Viewer is ready!");

      // PASTE YOUR NEW URL FROM COLAB HERE
      //const eeUrl = "https://earthengine.googleapis.com/v1/projects/ee-fatokilawrencefuta/maps/33d84504edee7667ea9d2d226d10105d-7742e8b0c3b2e79bb9a7a667ebd9262d/tiles/{z}/{x}/{y}";

     // const alphaEarthProvider = new UrlTemplateImageryProvider({
      //  url: eeUrl,
     //   credit: "Google Earth Engine - AlphaEarth",
     //   tilingScheme: new WebMercatorTilingScheme(),
     //   maximumLevel: 18,
     //   minimumLevel: 0,
     //   tileWidth: 256,
     //   tileHeight: 256,
     // });, 

      // Add Alpha Earth layer on top
    //  const eeLayer = viewer.imageryLayers.addImageryProvider(alphaEarthProvider);
    //  eeLayer.alpha = 1.0;

      // Add terrain exaggeration like Leafmap
      viewer.scene.globe.terrainExaggeration = 2.0;

      console.log("✅ Alpha Earth layer added on top");

      // // Listen for basemap changes and ensure Alpha Earth stays on top
      // viewer.imageryLayers.layerAdded.addEventListener((layer, index) => {
      //   // Find the Alpha Earth layer
      //   const alphaEarthLayer = viewer.imageryLayers._layers.find(
      //     l => l.imageryProvider === alphaEarthProvider
      //   );

      //   if (alphaEarthLayer) {
      //     // Move Alpha Earth to the top
      //     viewer.imageryLayers.raise(alphaEarthLayer);
      //     console.log("✅ Alpha Earth moved to top after basemap change");
      //   }
      // });

      // ---------------------------
      // 🌍 Amazon Rainforest Fly Animation
      // ---------------------------

      // Amazon Rainforest coordinates (visually stunning with Alpha Earth): -3.4653° S, -62.2159° W
      const targetLon = 55.2744;
      const targetLat = 25.1972;

      // Store the animation function in window so button can access it
      window.startFlyAnimation = () => {
        if (isAnimating) return;
        setIsAnimating(true);
        
        console.log("🚀 Starting fly animation");
        
        // Smooth continuous zoom from space to ground
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(targetLon, targetLat, 3000),
          duration: 3, // Slow descent for proper tile loading
          complete: () => {
            console.log("✅ Zoomed into Amazon Rainforest");
            
            // Hold position for a moment
            // setTimeout(() => {
            //   // Fly back out to space
            //   viewer.camera.flyTo({
            //     destination: Cartesian3.fromDegrees(targetLon, targetLat+1, 15000000),
            //     duration: 8, // Smooth ascent back to space
            //     complete: () => {
            //       console.log("✅ Returned to outer space");
            //       setIsAnimating(false);
            //     }
            //   });
            // }, 200); // Hold for 2.5 seconds at ground level
          }
        });
      };

      // Initial position in space above the target
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(targetLon, targetLat, 15000000)
      });

      window.startFlyAnimation();

    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleStartAnimation = () => {
    if (window.startFlyAnimation) {
      window.startFlyAnimation();
    }
  };



  const showZeroDinTwoDSpace = () => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    viewer.entities.removeAll();
    
    const targetLon = 55.2744;
    const targetLat = 25.1972;

    viewer.entities.add({
      name: "Zero-Dimensional Point",
      position: Cartesian3.fromDegrees(targetLon, targetLat, 3000),
      point: {
        pixelSize: 60,
        color: Color.fromCssColorString("rgba(223, 43, 43, 1)"), // red point
        outlineColor: Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: "0D Point in 2D Space",
        font: "24px sans-serif",
        style: LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -45)
      }
    });

    viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(targetLon, targetLat, 6000),
        duration: 3, // Slow descent for proper tile loading
        complete: () => {
          console.log("✅ Zoomed into Amazon Rainforest");
        }
    })
  }


const showOneDinTwoDSpace = () => {
  const viewer = viewerRef.current?.cesiumElement;
  if (!viewer) return;

  // Remove all previous entities
  viewer.entities.removeAll();


  // Base coordinates same as 0D point
  const baseLon = 55.2744;
  const baseLat = 25.1972;

  const start = Cartesian3.fromDegrees(baseLon - 0.01, baseLat, 0);
  const end = Cartesian3.fromDegrees(baseLon + 0.01, baseLat, 0);
  const centerLon = (baseLon - 0.01 + baseLon + 0.01) / 2;
  const centerLat = baseLat;

  const center = Cartesian3.fromDegrees(centerLon, centerLat, 3000); // slightly above line

  viewer.entities.add({
    name: "1D Line in 2D Space",
    polyline: {
      positions: [start, end],
      width: 15,
      material: new PolylineOutlineMaterialProperty({
        color: Color.fromCssColorString("rgba(44, 212, 170, 1)"), // green line
        outlineColor: Color.WHITE, // white border
        outlineWidth: 6
      }),
      clampToGround: false
    }
  });

  viewer.entities.add({
    name: "Label for 1D Line",
    position: center,
    label: {
      text: "1D Line in a 2D Space",
      font: "26px sans-serif",
      style: LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      verticalOrigin: VerticalOrigin.BOTTOM,
      pixelOffset: new Cartesian2(0, -15),
      fillColor: Color.WHITE
    }
  });  

  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(centerLon, centerLat, 7000), // fly in
    duration: 1,
    complete: () => {
      console.log("✅ Zoomed to 1D line with green color and white border");

      // Hold for a moment (optional)
      setTimeout(() => {
        // Fly back out to a higher altitude
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(centerLon, centerLat, 5000), // fly out
          duration: 2,
          complete: () => {
            console.log("✅ Returned to outer space");
          }
        });
      }, 0); // 1 second pause at the line
    }
  });

};



const showTwoDinThreeDSpace = () => {
  const viewer = viewerRef.current?.cesiumElement;
  if (!viewer) return;

  // Remove all previous entities
  viewer.entities.removeAll();

  // Base coordinates same as 0D point
  const baseLon = 55.2744;
  const baseLat = 25.1972;

  // Define polygon corners around the base point
  const polygonCoords = [
    baseLon - 0.005, baseLat - 0.003,
    baseLon + 0.005, baseLat - 0.003,
    baseLon + 0.005, baseLat + 0.003,
    baseLon - 0.005, baseLat + 0.003
  ];

  // Calculate polygon center for camera fly
  const centerLon = baseLon;
  const centerLat = baseLat;
  const center = Cartesian3.fromDegrees(centerLon, centerLat, 100); // slightly above polygon

  // Add polygon entity
  viewer.entities.add({
    name: "2D Polygon in 3D Space",
    polygon: {
      hierarchy: Cartesian3.fromDegreesArray(polygonCoords),
      material: Color.fromCssColorString("rgba(60, 100, 168, 0.6)"),
      outline: true,
      outlineColor: Color.WHITE,
      height: 0, // flat on the ground
      perPositionHeight: false
    }
  });

  // Add a separate label entity
  viewer.entities.add({
    name: "Label for 2D Polygon",
    position: center,
    label: {
      text: "2D Polygon in 3D Space",
      font: "26px sans-serif",
      style: LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      verticalOrigin: VerticalOrigin.BOTTOM,
      pixelOffset: new Cartesian2(0, -80),
      fillColor: Color.WHITE
    },
  });

  // Fly camera to polygon with tilt
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(centerLon, centerLat-0.015, 3000), // initial fly in
    orientation: {
      heading: 0.0,
      pitch: Math.toRadians(-45), // tilt camera down 45 degrees
      roll: 0.0
    },
    duration: 2,
    complete: () => {
      console.log("✅ Zoomed to 2D polygon with tilt");
    }
  });
};



const showThreeDinThreeDSpace = () => {
  const viewer = viewerRef.current?.cesiumElement;
  if (!viewer) return;

  // Remove all previous entities
  viewer.entities.removeAll();

  // Base coordinates (same as before)
  const baseLon = 55.2744;
  const baseLat = 25.1972;

  // Define polygon corners around the base point
  const polygonCoords = [
    baseLon - 0.005, baseLat - 0.003,
    baseLon + 0.005, baseLat - 0.003,
    baseLon + 0.005, baseLat + 0.003,
    baseLon - 0.005, baseLat + 0.003
  ];

  // Calculate polygon center
  const centerLon = baseLon;
  const centerLat = baseLat;
  const center = Cartesian3.fromDegrees(centerLon, centerLat, 2000); // label position above polygon

  // Add extruded polygon entity
  viewer.entities.add({
    name: "3D Polygon in 3D Space",
    polygon: {
      hierarchy: Cartesian3.fromDegreesArray(polygonCoords),
      extrudedHeight: 2000, // make it 3D
      material: Color.fromCssColorString("rgba(168, 168, 60, 1)"), // green color
      outline: true,
      outlineColor: Color.WHITE,
      perPositionHeight: false
    }
  });

  // Add label slightly above polygon
  viewer.entities.add({
    name: "Label for 3D Polygon",
    position: center,
    label: {
      text: "3D Polygon in 3D Space",
      font: "26px sans-serif",
      style: LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      verticalOrigin: VerticalOrigin.BOTTOM,
      pixelOffset: new Cartesian2(0, -80),
      fillColor: Color.WHITE
    },
  });

  // Fly camera to view the 3D object with a tilt
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(centerLon, centerLat - 0.05, 7000),
    orientation: {
      heading: 0.0,
      pitch: Math.toRadians(-45), // tilt down to see the height
      roll: 0.0
    },
    duration: 2,
    complete: () => {
      console.log("✅ Zoomed to 3D extruded polygon in 3D space");
    }
  });
};


  return (
    <>
      <Viewer
        ref={viewerRef}
        full
        baseLayerPicker={true}
        timeline={false}
        animation={false}
      >

      </Viewer>
      
      {/* Start Animation Button */}
      <button
        onClick={handleStartAnimation}
        disabled={isAnimating}
        style={{
          display: 'none',
          position: 'absolute',
          top: '20px',
          right: '20px',
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: 'bold',
          backgroundColor: isAnimating ? '#6c757d' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: isAnimating ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          transition: 'all 0.3s ease',
          opacity: isAnimating ? 0.6 : 1
        }}
        onMouseEnter={(e) => {
          if (!isAnimating) {
            e.target.style.backgroundColor = '#0056b3';
            e.target.style.transform = 'scale(1.05)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isAnimating) {
            e.target.style.backgroundColor = '#007bff';
            e.target.style.transform = 'scale(1)';
          }
        }}
      >
        {isAnimating ? '🌍 Flying...' : '🚀 Start Fly Tour'}
      </button>

      <div 
      onClick={showZeroDinTwoDSpace}
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        fontWeight: 'bold',
        padding: '10px 15px',
        backgroundColor: 'rgba(223, 43, 43, 1)',
        color: 'white',
        fontSize: '18px',
        borderRadius: '8px',
        zIndex: 1000,
        cursor: 'pointer',
      }}>
        0D/2D Space
      </div>

      <div 
      onClick={showOneDinTwoDSpace}
      style={{
        cursor: 'pointer',
        position: 'absolute',
        top: '80px',
        left: '20px',
        fontWeight: 'bold',
        padding: '10px 15px',
        backgroundColor: 'rgba(60, 168, 141, 1)',
        color: 'white',
        fontSize: '18px',
        borderRadius: '8px',
        zIndex: 1000,
      }}>
        1D/2D Space
      </div>

      <div 
        onClick={showTwoDinThreeDSpace}
        style={{
        cursor: 'pointer',
        position: 'absolute',
        top: '140px',
        left: '20px',
        fontWeight: 'bold',
        padding: '10px 15px',
        backgroundColor: 'rgba(60, 100, 168, 1)',
        color: 'white',
        fontSize: '18px',
        borderRadius: '8px',
        zIndex: 1000,
      }}>
        2D/3D Space
      </div>

      <div 
        onClick={showThreeDinThreeDSpace}
        style={{
        cursor: 'pointer',
        position: 'absolute',
        top: '200px',
        left: '20px',
        fontWeight: 'bold',
        padding: '10px 15px',
        backgroundColor: 'rgba(168, 168, 60, 1)',
        color: 'white',
        fontSize: '18px',
        borderRadius: '8px',
        zIndex: 1000,
      }}>
        3D/3D Space
      </div>

    </>
  );
};

export default CesiumGlobe;