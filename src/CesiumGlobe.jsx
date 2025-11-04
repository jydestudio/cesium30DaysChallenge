import React, { useRef, useEffect } from 'react'; // Import useRef and useEffect
import { Viewer, Entity } from 'resium';
import { Cartesian3, Color, EasingFunction } from 'cesium';


const globeStyle = {
  width: '100%',
  height: '100%',
};
function CesiumGlobe({ markers = [] }) {
  // 1. Create a ref to hold the Viewer instance
  const viewerRef = useRef(null);

  useEffect(() => {
    if (markers.length > 0 && viewerRef.current) {
      const lastMarker = markers[markers.length - 1];
      const position = lastMarker.position;

      const viewer = viewerRef.current.cesiumElement;
      
      // Execute the flyTo
      viewer.camera.flyTo({
        destination: position,
        offset: new Cartesian3(0.0, 0.0, 1000), // Optional: offset height (500km)
        duration: 2.5, // Fly duration in seconds
        easingFunction: EasingFunction.QUADRATIC_OUT, // Optional: smoother motion
      });
    }
  }, [markers]); // Dependency array: Re-run when 'markers' changes

  return (
    <div style={globeStyle}>
      {/* 3. Attach the ref to the Viewer component */}
      <Viewer 
        full
        ref={viewerRef} // 👈 Attach the ref here
        timeline={false}
        baseLayerPicker={false}
        geocoder={false}
        homeButton={false}
        infoBox={false}
        sceneModePicker={false}
        navigationHelpButton={false}
      >

        {markers.map(marker => (
          <Entity
            key={marker.id}
            name={marker.name}
            position={marker.position} 
            point={{
              pixelSize: 15,
              color: marker.color || Color.BLUE, 
              outlineColor: Color.BLACK,
              outlineWidth: 2,
            }}
          />
        ))}
      </Viewer>
    </div>
  );
}

export default CesiumGlobe;