import React, { useState } from 'react';
import AIChatBox from './AIChatBox';
import CesiumGlobe from './CesiumGlobe';
import { Cartesian3, Color } from 'cesium';

function App() {
    const [markers, setMarkers] = useState([]);
    
    const addMarker = (coordinates) => {
        const [lon, lat] = coordinates;
        console.log('Adding marker at:', lon, lat);
        
        const newMarker = {
            id: Date.now(), // Unique ID for React keys
            name: "User Marker",
            position: Cartesian3.fromDegrees(lon, lat, 50000),
            color: Color.YELLOW,
        };
        
        // Add to markers array
        setMarkers(prevMarkers => [...prevMarkers, newMarker]);
    };

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
            <div style={{ flex: 1 }}>
                <CesiumGlobe markers={markers} />
            </div>
            
            {/* Chat box as a sidebar on the right */}
            <div style={{ width: '420px', height: '100%' }}>
                <AIChatBox addMarker={addMarker} />
            </div>
        </div>
    );
}

export default App;