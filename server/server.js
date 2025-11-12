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



// LULC with 3D hillshade effect (Fast - tiles only)
app.post('/api/gee/lulc-tiles', async (req, res) => {
  try {
    if (!isInitialized) {
      return res.status(503).json({
        error: 'Earth Engine not initialized yet'
      });
    }

    const { startDate, endDate, geometry } = req.body;


    // Build geometry if provided and valid
    let clipGeometry = null;
    if (geometry && geometry.coordinates) {
      clipGeometry = ee.Geometry(geometry);
    }

    // Define class names and palette
    const CLASS_NAMES = [
      'water', 'trees', 'grass', 'flooded_vegetation', 'crops',
      'shrub_and_scrub', 'built', 'bare', 'snow_and_ice'
    ];
    
    const VIS_PALETTE = [
      '419bdf', '397d49', '88b053', '7a87c6', 'e49635', 
      'dfc35a', 'c4281b', 'a59b8f', 'b39fe1'
    ];

    // Get Dynamic World LULC collection
    let lulcCollection = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
      .filterDate(startDate || '2025-01-01', endDate || '2020-12-31');

    // Filter by geometry if provided
    if (clipGeometry) {
      lulcCollection = lulcCollection.filterBounds(clipGeometry);
    }

    // Get Sentinel-2 collection
    let sentinelCollection = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
      .filterDate(startDate || '2020-01-01', endDate || '2020-12-31');

    if (clipGeometry) {
      sentinelCollection = sentinelCollection.filterBounds(clipGeometry);
    }

    // Get sample image with water band
    const sampleImg = lulcCollection.filter(ee.Filter.listContains('system:band_names', 'water')).mosaic();

    // Link Sentinel with LULC
    const linkedCol = sentinelCollection.linkCollection(lulcCollection, sampleImg.bandNames());

    // Get first linked image and clip
    let linkedImg = ee.Image(linkedCol.first());
    if (clipGeometry) {
      linkedImg = linkedImg.clip(clipGeometry);
    }

    // Create RGB visualization
    const dwRgb = linkedImg
      .select('label')
      .visualize({ min: 0, max: 8, palette: VIS_PALETTE })
      .divide(255);

    // Calculate top probability for hillshade
    const top1Prob = linkedImg.select(CLASS_NAMES).reduce(ee.Reducer.max());
    
    // Create hillshade effect
    const top1ProbHillshade = ee.Terrain.hillshade(top1Prob.multiply(100))
      .divide(255);

    // Apply hillshade to RGB
    const dwRgbHillshade = dwRgb.multiply(top1ProbHillshade);

    // Visualization parameters for the final image
    const visParams = {
      min: 0,
      max: 0.65
    };

    // Generate map tiles (fast response)
    dwRgbHillshade.getMap(visParams, (mapInfo) => {
      if (mapInfo && mapInfo.urlFormat) {
        console.log('✅ LULC tiles generated successfully');
        res.json({
          success: true,
          tileUrl: mapInfo.urlFormat,
          legend: {
            classes: CLASS_NAMES,
            palette: VIS_PALETTE
          }
        });
      } else {
        res.status(500).json({
          error: 'Failed to generate LULC tiles'
        });
      }
    });

  } catch (error) {
    console.error('❌ Error generating LULC tiles:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// LULC Area Statistics (Separate endpoint for detailed analysis)
app.post('/api/gee/lulc-stats', async (req, res) => {
  try {
    if (!isInitialized) {
      return res.status(503).json({
        error: 'Earth Engine not initialized yet'
      });
    }

    const { startDate, endDate, geometry } = req.body;


    // Build geometry if provided and valid
    let clipGeometry = null;
    if (geometry && geometry.coordinates) {
      clipGeometry = ee.Geometry(geometry);
    }

    if (!clipGeometry) {
      return res.status(400).json({
        error: 'Geometry is required for area statistics'
      });
    }

    // Define class names and palette
    const CLASS_NAMES = [
      'water', 'trees', 'grass', 'flooded_vegetation', 'crops',
      'shrub_and_scrub', 'built', 'bare', 'snow_and_ice'
    ];
    
    const VIS_PALETTE = [
      '419bdf', '397d49', '88b053', '7a87c6', 'e49635', 
      'dfc35a', 'c4281b', 'a59b8f', 'b39fe1'
    ];

    // Get Dynamic World LULC collection
    let lulcCollection = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
      .filterDate(startDate || '2020-01-01', endDate || '2020-12-31')
      .filterBounds(clipGeometry);

    // Get Sentinel-2 collection
    let sentinelCollection = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
      .filterDate(startDate || '2020-01-01', endDate || '2020-12-31')
      .filterBounds(clipGeometry);

    // Get sample image with water band
    const sampleImg = lulcCollection.filter(ee.Filter.listContains('system:band_names', 'water')).mosaic();

    // Link Sentinel with LULC
    const linkedCol = sentinelCollection.linkCollection(lulcCollection, sampleImg.bandNames());

    // Get first linked image and clip
    const linkedImg = ee.Image(linkedCol.first()).clip(clipGeometry);

    // Calculate area statistics for each land cover class
    const labelImg = linkedImg.select('label');
    const pixelArea = ee.Image.pixelArea();
    
    // Calculate area for each class (0-8)
    const areaCalculations = [];
    for (let i = 0; i < 9; i++) {
      const classArea = labelImg.eq(i).multiply(pixelArea).reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: clipGeometry,
        scale: 10, // 10m resolution for Dynamic World
        maxPixels: 1e13,
        bestEffort: true
      });
      areaCalculations.push(classArea);
    }

    // Calculate all areas
    Promise.all(areaCalculations.map(area => 
      new Promise((resolve, reject) => {
        area.evaluate((result, error) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      })
    )).then(results => {
      // Process area results
      const areaStats = CLASS_NAMES.map((className, index) => {
        const areaInSqMeters = results[index]?.label || 0;
        const areaInSqKm = areaInSqMeters / 1000000; // Convert to km²
        const areaInHectares = areaInSqMeters / 10000; // Convert to hectares
        
        return {
          class: className,
          label: index,
          color: VIS_PALETTE[index],
          areaInSqMeters: parseFloat(areaInSqMeters.toFixed(2)),
          areaInSqKm: parseFloat(areaInSqKm.toFixed(4)),
          areaInHectares: parseFloat(areaInHectares.toFixed(2))
        };
      });

      // Calculate total area
      const totalArea = areaStats.reduce((sum, stat) => sum + stat.areaInSqMeters, 0);

      // Add percentage to each class
      const areaStatsWithPercentage = areaStats.map(stat => ({
        ...stat,
        percentage: totalArea > 0 ? parseFloat(((stat.areaInSqMeters / totalArea) * 100).toFixed(2)) : 0
      }));

      // Filter out classes with 0 area for cleaner data
      const nonZeroStats = areaStatsWithPercentage.filter(stat => stat.areaInSqMeters > 0);


      res.json({
        success: true,
        statistics: {
          classes: nonZeroStats,
          allClasses: areaStatsWithPercentage, // Include all classes for reference
          totalAreaSqMeters: parseFloat(totalArea.toFixed(2)),
          totalAreaSqKm: parseFloat((totalArea / 1000000).toFixed(4)),
          totalAreaHectares: parseFloat((totalArea / 10000).toFixed(2)),
          dateRange: {
            startDate: startDate || '2020-01-01',
            endDate: endDate || '2020-12-31'
          }
        }
      });
    }).catch(error => {
      console.error('❌ Error calculating LULC statistics:', error);
      res.status(500).json({
        error: 'Failed to calculate area statistics',
        details: error.message
      });
    });

  } catch (error) {
    console.error('❌ Error in LULC statistics endpoint:', error);
    res.status(500).json({
      error: error.message
    });
  }
});





// Get NDVI tiles (updated to use same clipping as Landsat)
app.post('/api/gee/ndvi-tiles', async (req, res) => {
  try {
    if (!isInitialized) {
      return res.status(503).json({
        error: 'Earth Engine not initialized yet'
      });
    }

    const {startDate, endDate, geometry } = req.body;


    
    // Build geometry if provided and valid
    let clipGeometry = null;
    if (geometry && geometry.coordinates) {
      clipGeometry = ee.Geometry(geometry);
    }
    
    // Create Sentinel-2 image collection - EXACTLY like Landsat pattern
    const medianImage = ee.ImageCollection('COPERNICUS/S2_SR')
      .filterDate(startDate || '2020-01-01', endDate || '2020-12-31')
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .median()
      .clip(clipGeometry);

    // Calculate NDVI from clipped median
    const ndvi = medianImage.normalizedDifference(['B8', 'B4']).rename('NDVI');

    console.log('NDVI image prepared and clipped');

    // Visualization parameters
    const visParams = {
      min: -0.2,
      max: 0.8,
      palette: ['red', 'yellow', 'green']
    };

    // Get map ID
    ndvi.getMap(visParams, (mapInfo) => {
      if (mapInfo && mapInfo.urlFormat) {
        console.log('✅ NDVI tiles generated successfully');
        res.json({
          success: true,
          tileUrl: mapInfo.urlFormat
        });
      } else {
        console.log('❌ Failed to generate NDVI map info');
        res.status(500).json({
          error: 'Failed to generate NDVI tiles'
        });
      }
    });

  } catch (error) {
    console.error('❌ Error generating NDVI tiles:', error);
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

    const { geometry } = req.body;

    console.log('Received elevation tile request with params:', { geometry });

    // Build geometry if provided and valid
    let clipGeometry = null;
    if (geometry && geometry.coordinates) {
      clipGeometry = ee.Geometry(geometry);
    }

    // Load SRTM elevation data and clip (same pattern as Landsat)
    const elevation = ee.Image('USGS/SRTMGL1_003').clip(clipGeometry);

    // Visualization parameters
    const visParams = {
      min: 0,
      max: 4000,
      palette: ['blue', 'green', 'yellow', 'brown', 'white']
    };

    // Get map ID
    elevation.getMap(visParams, (mapInfo) => {
      if (mapInfo && mapInfo.urlFormat) {
        console.log('✅ Elevation tiles generated successfully');
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