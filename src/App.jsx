import React, { useState } from 'react';
import AIChatBox from './components/AIChatBox';
import CesiumGlobe from './components/CesiumGlobe';
import MapLibreMap from './components/maplibre.jsx';
import GeeWebMap from './components/gee-webmap.jsx';
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
            {/* <div style={{ flex: 1, display: 'none'}}>
                <CesiumGlobe markers={markers} />
            </div> */}
            
            {/* Chat box as a sidebar on the right */}
            {/* <div style={{ width: '420px', height: '100%', display: 'none'}}>
                <AIChatBox addMarker={addMarker}/>
            </div> */}

            {/* <div style={{ width: '100%', height: '100%'}}>
                <MapLibreMap/>
            </div> */}

            {/* i don't understand shit */}
            <div style={{ width: '100%', height: '100%'}}>
                <GeeWebMap/>
            </div> 
        </div>
    );
}

export default App;