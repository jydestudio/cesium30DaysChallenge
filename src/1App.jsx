import 'cesium/Build/Cesium/Widgets/widgets.css';
import CesiumGlobe from './CesiumGlobe.jsx';
import AIChatBox from './AIChatBox.jsx';

function App() {
  return (
    <div style={{ 
      height: '100vh', 
      width: '100vw', 
      padding: 0, margin: 0,
      position: 'relative'
      }}>
      <div style={{ height: '100%'}}>
        <CesiumGlobe />
      </div>

      <div style={{ 
        width: '400px', 
        height: '100%', 
        bordeRight: '1px solid #ccc', 
        backgroundColor: '#f9f9f979',
        position: 'absolute',
        top: 0,
        left: 0,
        }}>
        <AIChatBox />
      </div>
    </div>
  )
}

export default App