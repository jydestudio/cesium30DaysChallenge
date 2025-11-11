const express = require('express');
const cors = require('cors');
const ee = require('@google/earthengine');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Store authentication status
let isInitialized = false;

// Initialize Earth Engine with service account
const initializeEarthEngine = () => {
  return new Promise((resolve, reject) => {
    // Option 1: Using service account key file (Recommended for production)
    const privateKey = require('./ee-fatokilawrencefuta-5feacb0fb793.json');

    ee.data.authenticateViaPrivateKey(
      privateKey,
      () => {
        console.log('✅ Authentication successful');
        ee.initialize(
          null,
          null,
          () => {
            console.log('✅ Earth Engine initialized');
            isInitialized = true;
            resolve();
          },
          (err) => {
            console.error('❌ Initialization error:', err);
            reject(err);
          }
        );
      },
      (err) => {
        console.error('❌ Authentication error:', err);
        reject(err);
      }
    );
  });
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    earthEngineReady: isInitialized
  });
});

// Get Landsat tile URL
app.post('/api/gee/landsat-tiles', async (req, res) => {
  try {
    if (!isInitialized) {
      return res.status(503).json({
        error: 'Earth Engine not initialized yet'
      });
    }

    const {startDate, endDate, geometry } = req.body;

    console.log('Received Landsat tile request with params:', { startDate, endDate, geometry });

    
    // Build geometry if provided and valid
    let clipGeometry = null;
    if (geometry && geometry.coordinates) {
      clipGeometry = ee.Geometry(geometry);
    }
    // Create Landsat image collection
    const image = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
      .filterDate(startDate || '2020-01-01', endDate || '2020-12-31')
      .median()
      .clip(clipGeometry);

    // Apply visualization parameters
    const visParams = {
      bands: ['SR_B4', 'SR_B3', 'SR_B2'],
      min: 7000,
      max: 12000,
      gamma: 1.4
    };

    // Get map ID
    image.getMap(visParams, (mapInfo) => {
      if (mapInfo && mapInfo.urlFormat) {
        res.json({
          success: true,
          tileUrl: mapInfo.urlFormat
        });
      } else {
        res.status(500).json({
          error: 'Failed to generate map tiles'
        });
      }
    });

  } catch (error) {
    console.error('Error generating tiles:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Get NDVI tiles
app.post('/api/gee/ndvi-tiles', async (req, res) => {
  try {
    if (!isInitialized) {
      return res.status(503).json({
        error: 'Earth Engine not initialized yet'
      });
    }

    const { startDate, endDate, bounds } = req.body;

    // Create Sentinel-2 image collection
    const collection = ee.ImageCollection('COPERNICUS/S2_SR')
      .filterDate(startDate || '2020-06-01', endDate || '2020-09-01')
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

    // If bounds provided, filter by location
    let filtered = collection;
    if (bounds) {
      const geometry = ee.Geometry.Rectangle(bounds);
      filtered = collection.filterBounds(geometry);
    }

    const median = filtered.median();

    // Calculate NDVI
    const ndvi = median.normalizedDifference(['B8', 'B4']).rename('NDVI');

    // Visualization parameters
    const visParams = {
      min: -0.2,
      max: 0.8,
      palette: ['red', 'yellow', 'green']
    };

    // Get map ID
    ndvi.getMap(visParams, (mapInfo) => {
      if (mapInfo && mapInfo.urlFormat) {
        res.json({
          success: true,
          tileUrl: mapInfo.urlFormat
        });
      } else {
        res.status(500).json({
          error: 'Failed to generate NDVI tiles'
        });
      }
    });

  } catch (error) {
    console.error('Error generating NDVI tiles:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Get elevation data
app.post('/api/gee/elevation-tiles', async (req, res) => {
  try {
    if (!isInitialized) {
      return res.status(503).json({
        error: 'Earth Engine not initialized yet'
      });
    }

    // Load SRTM elevation data
    const elevation = ee.Image('USGS/SRTMGL1_003');

    // Visualization parameters
    const visParams = {
      min: 0,
      max: 4000,
      palette: ['blue', 'green', 'yellow', 'brown', 'white']
    };

    // Get map ID
    elevation.getMap(visParams, (mapInfo) => {
      if (mapInfo && mapInfo.urlFormat) {
        res.json({
          success: true,
          tileUrl: mapInfo.urlFormat
        });
      } else {
        res.status(500).json({
          error: 'Failed to generate elevation tiles'
        });
      }
    });

  } catch (error) {
    console.error('Error generating elevation tiles:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Custom image collection endpoint
app.post('/api/gee/custom-tiles', async (req, res) => {
  try {
    if (!isInitialized) {
      return res.status(503).json({
        error: 'Earth Engine not initialized yet'
      });
    }

    const {
      collectionId,
      startDate,
      endDate,
      bands,
      min,
      max,
      palette
    } = req.body;

    if (!collectionId) {
      return res.status(400).json({
        error: 'collectionId is required'
      });
    }

    // Create image collection
    const image = ee.ImageCollection(collectionId)
      .filterDate(startDate || '2020-01-01', endDate || '2020-12-31')
      .median();

    // Build visualization parameters
    const visParams = {};
    if (bands) visParams.bands = bands;
    if (min !== undefined) visParams.min = min;
    if (max !== undefined) visParams.max = max;
    if (palette) visParams.palette = palette;

    // Get map ID
    image.getMap(visParams, (mapInfo) => {
      if (mapInfo && mapInfo.urlFormat) {
        res.json({
          success: true,
          tileUrl: mapInfo.urlFormat,
          collectionId
        });
      } else {
        res.status(500).json({
          error: 'Failed to generate tiles'
        });
      }
    });

  } catch (error) {
    console.error('Error generating custom tiles:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Starting Earth Engine backend...');

    // Initialize Earth Engine first
    await initializeEarthEngine();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ Earth Engine ready to serve requests`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
