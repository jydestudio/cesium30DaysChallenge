# Air Animation Component - Weather Visualization with Cesium

A comprehensive animated weather visualization component using Cesium.js that displays real-time wind, temperature, pressure, and air quality data with multiple visualization modes.

## Features

### Visualization Types
1. **Particle Animation** - Flowing particles that move with wind patterns, colored by selected weather parameter
2. **Wind Arrows** - Directional arrows showing wind speed and direction (or colored points for other parameters)
3. **Streamlines** - Curved lines showing wind flow patterns across the globe

### Weather Parameters
- **Wind Speed & Direction** - Real-time wind data with directional visualization
- **Temperature** - Temperature distribution across regions
- **Atmospheric Pressure** - Pressure systems visualization
- **Air Quality** - Air quality index (AQI) display

## Setup Instructions

### 1. Get OpenWeatherMap API Key

To use real-time weather data, you need a free API key from OpenWeatherMap:

1. Go to [OpenWeatherMap](https://openweathermap.org/api)
2. Sign up for a free account
3. Navigate to API Keys section
4. Copy your API key

### 2. Configure the Component

Open `airAnimation.jsx` and replace the placeholder with your API key:

```javascript
const OPENWEATHER_API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your actual API key
```

**Note:** Without an API key, the component will use sample/simulated data for demonstration purposes.

### 3. Usage in Your App

Import and use the component:

```jsx
import AirAnimation from './components/airAnimation';

function App() {
  return (
    <div>
      <AirAnimation />
    </div>
  );
}
```

## How It Works

### Data Fetching
- Automatically fetches weather data every **6 hours** (configurable via `UPDATE_INTERVAL`)
- Fetches data for a grid of points within the current camera view
- Rate-limited API calls to respect OpenWeatherMap's free tier limits

### Particle System
- **5,000 particles** (configurable via `PARTICLE_COUNT`) that follow wind flow
- Particles are color-coded based on the selected weather parameter
- Particles fade out over their lifetime for smooth animation
- Automatically respawns particles when they leave the view or exceed lifetime

### Wind Data Interpolation
- Uses **Inverse Distance Weighting (IDW)** to interpolate wind data between grid points
- Provides smooth, continuous wind fields for realistic particle motion

### Color Coding

#### Wind Speed (m/s)
- 🔵 Light Blue: < 5 m/s (Light breeze)
- 🟢 Green: 5-10 m/s (Moderate breeze)
- 🟡 Yellow: 10-15 m/s (Fresh breeze)
- 🟠 Orange: 15-20 m/s (Strong breeze)
- 🔴 Red: > 20 m/s (Gale)

#### Temperature (°C)
- 🔵 Dark Blue: < 0°C (Freezing)
- 🔵 Light Blue: 0-10°C (Cold)
- 🟢 Green: 10-20°C (Mild)
- 🟡 Yellow: 20-30°C (Warm)
- 🔴 Red: > 30°C (Hot)

#### Pressure (hPa)
- 🟣 Purple: < 980 hPa (Low pressure)
- 🔵 Blue: 980-1000 hPa (Below normal)
- 🟢 Green: 1000-1020 hPa (Normal)
- 🟠 Orange: > 1020 hPa (High pressure)

#### Air Quality Index (AQI)
- 🟢 Green: 0-50 (Good)
- 🟡 Yellow: 50-100 (Moderate)
- 🟠 Orange: 100-150 (Unhealthy for sensitive groups)
- 🔴 Red: > 150 (Unhealthy)

## Configuration

### Adjustable Parameters

```javascript
// Update interval (default: 6 hours)
const UPDATE_INTERVAL = 6 * 60 * 60 * 1000;

// Particle system settings
const PARTICLE_COUNT = 5000;        // Number of particles
const PARTICLE_SPEED = 0.1;         // Speed multiplier
const PARTICLE_LIFETIME = 100;      // Frames before respawn
```

### Grid Resolution

In `fetchWeatherData()` or `generateSampleData()`:

```javascript
const latStep = (north - south) / 20;  // Increase denominator for more data points
const lonStep = (east - west) / 20;
```

Higher values = more data points but slower loading

## Controls

The component includes an overlay control panel with:

- **Weather Parameter Selector** - Choose which parameter to visualize
- **Visualization Type Toggles** - Enable/disable each visualization type
  - ☑️ Particle Animation
  - ☐ Wind Arrows
  - ☐ Streamlines
- **Status Information** - Shows loading state and last update time

## Performance Tips

1. **Reduce particle count** for slower devices (try 2000-3000)
2. **Disable multiple visualizations** if experiencing lag
3. **Decrease grid resolution** to reduce API calls
4. **Use sample data mode** for testing without API limits

## API Limitations

OpenWeatherMap free tier:
- **60 calls/minute**
- **1,000,000 calls/month**

The component implements:
- Rate limiting (100ms delay between requests)
- Grid-based fetching (20x20 = 400 points per update)
- 6-hour update intervals to minimize API usage

## Future Enhancements

Potential improvements:
- [ ] Add heatmap visualization layer
- [ ] Implement 3D wind visualization at different altitudes
- [ ] Add historical data playback
- [ ] Support for additional weather APIs (NOAA, Weather.gov)
- [ ] Add legend/scale for color mappings
- [ ] Export visualization as video/GIF
- [ ] Add click-to-view detailed weather data at point

## Troubleshooting

### Particles not moving
- Check that wind data is being fetched successfully
- Verify sample data is being generated if no API key is set
- Check browser console for errors

### Performance issues
- Reduce `PARTICLE_COUNT`
- Disable streamlines visualization
- Reduce grid resolution

### No data displayed
- Verify Cesium Ion token is configured
- Check browser console for API errors
- Ensure API key is valid (if using real data)

## Credits

- **Cesium.js** - 3D globe visualization
- **OpenWeatherMap** - Weather data API
- Wind visualization techniques inspired by [earth.nullschool.net](https://earth.nullschool.net/)
