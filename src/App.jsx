import React, { useState } from 'react';
import AIChatBox from './components/AIChatBox';
import CesiumGlobe from './components/CesiumGlobe';
import MapLibreMap from './components/maplibre.jsx';
import GeeWebMap from './components/gee-webmap.jsx';
import { Cartesian3, Color } from 'cesium';

function App() {
    const [markers, setMarkers] = useState([]);
    const [showChat, setShowChat] = useState(false);
    
    const addMarker = (coordinates) => {
        const [lon, lat] = coordinates;
        console.log('Adding marker at:', lon, lat);
        
        const newMarker = {
            id: Date.now(),
            name: "User Marker",
            position: Cartesian3.fromDegrees(lon, lat, 1000),
            color: Color.YELLOW,
            clampToGround: true,
        };
        
        setMarkers(prevMarkers => [...prevMarkers, newMarker]);
    };

    const toggleChat = () => {
        setShowChat(prev => !prev);
    };

    return (
        <div style={{ 
            display: 'flex', 
            height: '100vh', 
            width: '100vw', 
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Toggle Button */}
            <button
                onClick={toggleChat}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: showChat ? '350px' : '0px',
                    transform: 'translateY(-50%)',
                    zIndex: 1001,
                    width: '48px',
                    height: '48px',
                    backgroundColor: 'rgba(30, 30, 30, 0.64)',
                    border: 'none',
                    borderRadius: '0 8px 8px 0',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '2px 0 20px rgba(0, 0, 0, 0.4)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    backdropFilter: 'blur(10px)',
                    borderLeft: showChat ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                    outline: 'none',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(50, 50, 50, 0.95)';
                    e.currentTarget.style.width = '52px';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(30, 30, 30, 0.95)';
                    e.currentTarget.style.width = '48px';
                }}
            >
                <div style={{
                    fontSize: '24px',
                    transition: 'transform 0.3s',
                    transform: showChat ? 'rotate(0deg)' : 'rotate(0deg)',
                }}>
                    {showChat ? '◀' : '💬'}
                </div>
                
                {!showChat && (
                    <div style={{
                        writingMode: 'vertical-rl',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: 'rgba(255, 255, 255, 0.45)',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                    }}>
                    </div>
                )}
            </button>

            {/* AI Chat Box */}
            <div style={{ 
                width: '350px', 
                height: '100%',
                transform: showChat ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: showChat ? '4px 0 20px rgba(0,0,0,0.3)' : 'none',
                zIndex: 1000,
                position: 'absolute',
                left: 0,
                top: 0,
            }}>
                <AIChatBox addMarker={addMarker} />
            </div>

            {/* Cesium Globe */}
            <div style={{ 
                width: '100%',
                height: '100%',
                transition: 'padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                paddingLeft: showChat ? '350px' : '0',
            }}>
                <CesiumGlobe markers={markers} />
            </div>
        </div>
    );
}

export default App;