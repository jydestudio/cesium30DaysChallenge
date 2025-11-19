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

// Burn Severity Analysis (dNBR) endpoint
app.post('/api/gee/burn-severity-tiles', async (req, res) => {
  try {
    if (!isInitialized) {
      return res.status(503).json({
        error: 'Earth Engine not initialized yet'
      });
    }

    const { 
      preFireStartDate, 
      preFireEndDate,
      postFireStartDate,
      postFireEndDate,
      layer // 'pre', 'post', or 'dnbr'
    } = req.body;

    let geometry;

    console.log('Received burn severity request:', { 
      geometry, 
      preFireStartDate, 
      preFireEndDate,
      postFireStartDate,
      postFireEndDate,
      layer 
    });

    // Build geometry if provided, otherwise use default point and buffer
    let clipGeometry = null;
    if (geometry && geometry.coordinates) {
      clipGeometry = ee.Geometry(geometry);
    } else {
      console.log("no geometry provided, using default Mount Adams area");
      // Default: Point at Mount Adams, Washington with 17km buffer
      const defaultPoint = ee.Geometry.Point([-121.4517, 46.2047]);
      clipGeometry = defaultPoint.buffer(17000).bounds();
      console.log('Using default geometry: Mount Adams area');
    }

    // Scale surface reflectance function
    const scaleSR = (image) => {
      return image.select(['SR_B4', 'SR_B5', 'SR_B7'])  // Red, NIR, SWIR2
                  .multiply(0.0000275).add(-0.2);
    };

    // Get DEM and hillshade
    const dem = ee.Image('USGS/SRTMGL1_003').clip(clipGeometry);
    const hillshade = ee.Terrain.hillshade(dem).unitScale(0, 255);

    // Visualization parameters for RGB
    const visParams = {
      bands: ['SR_B7', 'SR_B5', 'SR_B4'],
      min: 0.05,
      max: 0.35,
      gamma: 1.2
    };

    // Function to blend with hillshade
    const blendWithHillshade = (image, params) => {
      const vis = image.visualize(params);
      const hsv = vis.unitScale(0, 255).rgbToHsv();
      const shadedValue = hsv.select('value').multiply(hillshade.pow(1.8));
      return ee.Image.cat([
        hsv.select('hue'), 
        hsv.select('saturation'), 
        shadedValue
      ]).hsvToRgb();
    };

    // Get pre-fire image
    const preImage = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
      .filterBounds(clipGeometry)
      .filterDate(preFireStartDate || '2014-08-07', preFireEndDate || '2014-08-08')
      .sort('CLOUD_COVER')
      .first()
      .clip(clipGeometry);


    console.log("befofre")
    // Get post-fire image
    const postImage = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
      .filterBounds(clipGeometry)
      .filterDate(postFireStartDate || '2015-09-11', postFireEndDate || '2015-09-12')
      .sort('CLOUD_COVER')
      .first()
      .clip(clipGeometry);

    console.log("after")
    // Scale images
    const preScaled = scaleSR(preImage);
    const postScaled = scaleSR(postImage);

    // Compute NBR function
    const computeNBR = (image) => {
      return image.expression(
        '(NIR - SWIR) / (NIR + SWIR)',
        {
          NIR: image.select('SR_B5'),
          SWIR: image.select('SR_B7')
        }
      ).rename('NBR');
    };

    // Compute NBR for both images
    const preNBR = computeNBR(preImage);
    const postNBR = computeNBR(postImage);
    const dNBR = preNBR.subtract(postNBR).rename('dNBR');

    // High contrast palette for dNBR
    const highContrastPalette = [
      '#005a32', // Dark forest green - Unburned
      '#1c9099', // Strong teal - Low severity
      '#ffff33', // Neon yellow - Moderate severity
      '#ff7f00', // Bright orange - High severity
      '#b10026'  // Intense deep red - Extreme severity
    ];

    let finalImage;
    let finalVisParams;

    // Choose which layer to return
    if (layer === 'pre') {
      finalImage = blendWithHillshade(preScaled, visParams);
      finalVisParams = { min: 0, max: 1 };
    } else if (layer === 'post') {
      finalImage = blendWithHillshade(postScaled, visParams);
      finalVisParams = { min: 0, max: 1 };
    } else {
      // Default: dNBR with hillshade
      const dNBRvis = dNBR.visualize({
        min: 0,
        max: 0.4,
        palette: highContrastPalette
      });
      const dNBRhsv = dNBRvis.unitScale(0, 255).rgbToHsv();
      const dNBRvalue = dNBRhsv.select('value').multiply(hillshade.pow(1.5));
      finalImage = ee.Image.cat([
        dNBRhsv.select('hue'),
        dNBRhsv.select('saturation'),
        dNBRvalue
      ]).hsvToRgb();
      finalVisParams = { min: 0, max: 1 };
    }

    // Get map tiles
    finalImage.getMap(finalVisParams, (mapInfo) => {
      if (mapInfo && mapInfo.urlFormat) {
        console.log('✅ Burn severity tiles generated successfully');
        res.json({
          success: true,
          tileUrl: mapInfo.urlFormat,
          legend: {
            title: 'Burn Severity (dNBR)',
            classes: [
              { label: 'Unburned', color: '#005a32', value: 0 },
              { label: 'Low Severity', color: '#1c9099', value: 1 },
              { label: 'Moderate Severity', color: '#ffff33', value: 2 },
              { label: 'High Severity', color: '#ff7f00', value: 3 },
              { label: 'Extreme Severity', color: '#b10026', value: 4 }
            ]
          },
          metadata: {
            layer: layer || 'dnbr',
            preFireDate: `${preFireStartDate || '2014-08-07'} to ${preFireEndDate || '2014-08-08'}`,
            postFireDate: `${postFireStartDate || '2015-09-11'} to ${postFireEndDate || '2015-09-12'}`,
            geometryProvided: !!geometry
          }
        });
      } else {
        res.status(500).json({
          error: 'Failed to generate burn severity tiles'
        });
      }
    });

  } catch (error) {
    console.error('❌ Error generating burn severity tiles:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Burn Severity Statistics endpoint
app.post('/api/gee/burn-severity-stats', async (req, res) => {
  try {
    if (!isInitialized) {
      return res.status(503).json({
        error: 'Earth Engine not initialized yet'
      });
    }

    const { 
      geometry, 
      preFireStartDate, 
      preFireEndDate,
      postFireStartDate,
      postFireEndDate
    } = req.body;

    // Build geometry if provided, otherwise use default point and buffer
    let clipGeometry = null;
    if (geometry && geometry.coordinates) {
      clipGeometry = ee.Geometry(geometry);
    } else {
      // Default: Point at Mount Adams, Washington with 17km buffer
      const defaultPoint = ee.Geometry.Point([-121.4517, 46.2047]);
      clipGeometry = defaultPoint.buffer(17000).bounds();
      console.log('Using default geometry for stats: Mount Adams area');
    }

    // Scale surface reflectance function
    const scaleSR = (image) => {
      return image.select(['SR_B4', 'SR_B5', 'SR_B7'])
                  .multiply(0.0000275).add(-0.2);
    };

    // Get pre-fire image
    const preImage = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
      .filterBounds(clipGeometry)
      .filterDate(preFireStartDate || '2014-08-07', preFireEndDate || '2014-08-08')
      .sort('CLOUD_COVER')
      .first()
      .clip(clipGeometry);

    // Get post-fire image
    const postImage = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
      .filterBounds(clipGeometry)
      .filterDate(postFireStartDate || '2015-09-11', postFireEndDate || '2015-09-12')
      .sort('CLOUD_COVER')
      .first()
      .clip(clipGeometry);

    // Compute NBR function
    const computeNBR = (image) => {
      return image.expression(
        '(NIR - SWIR) / (NIR + SWIR)',
        {
          NIR: image.select('SR_B5'),
          SWIR: image.select('SR_B7')
        }
      ).rename('NBR');
    };

    // Compute NBR for both images
    const preNBR = computeNBR(preImage);
    const postNBR = computeNBR(postImage);
    const dNBR = preNBR.subtract(postNBR).rename('dNBR');

    // Define severity classes based on dNBR values
    // Unburned: dNBR < 0.1
    // Low: 0.1 - 0.27
    // Moderate: 0.27 - 0.44
    // High: 0.44 - 0.66
    // Extreme: > 0.66
    
    const pixelArea = ee.Image.pixelArea();
    
    // Calculate area for each severity class
    const unburned = dNBR.lt(0.1).multiply(pixelArea);
    const lowSeverity = dNBR.gte(0.1).and(dNBR.lt(0.27)).multiply(pixelArea);
    const moderateSeverity = dNBR.gte(0.27).and(dNBR.lt(0.44)).multiply(pixelArea);
    const highSeverity = dNBR.gte(0.44).and(dNBR.lt(0.66)).multiply(pixelArea);
    const extremeSeverity = dNBR.gte(0.66).multiply(pixelArea);

    // Reduce regions to calculate total area for each class
    const areaCalculations = [
      unburned.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: clipGeometry,
        scale: 30, // Landsat resolution
        maxPixels: 1e13,
        bestEffort: true
      }),
      lowSeverity.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: clipGeometry,
        scale: 30,
        maxPixels: 1e13,
        bestEffort: true
      }),
      moderateSeverity.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: clipGeometry,
        scale: 30,
        maxPixels: 1e13,
        bestEffort: true
      }),
      highSeverity.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: clipGeometry,
        scale: 30,
        maxPixels: 1e13,
        bestEffort: true
      }),
      extremeSeverity.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: clipGeometry,
        scale: 30,
        maxPixels: 1e13,
        bestEffort: true
      })
    ];

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
      const severityClasses = [
        { label: 'Unburned', color: '#005a32', value: 0 },
        { label: 'Low Severity', color: '#1c9099', value: 1 },
        { label: 'Moderate Severity', color: '#ffff33', value: 2 },
        { label: 'High Severity', color: '#ff7f00', value: 3 },
        { label: 'Extreme Severity', color: '#b10026', value: 4 }
      ];

      // Process area results
      const areaStats = severityClasses.map((severityClass, index) => {
        const areaInSqMeters = results[index]?.area || results[index]?.dNBR || 0;
        const areaInSqKm = areaInSqMeters / 1000000;
        const areaInHectares = areaInSqMeters / 10000;
        
        return {
          class: severityClass.label,
          value: severityClass.value,
          color: severityClass.color,
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
          allClasses: areaStatsWithPercentage,
          totalAreaSqMeters: parseFloat(totalArea.toFixed(2)),
          totalAreaSqKm: parseFloat((totalArea / 1000000).toFixed(4)),
          totalAreaHectares: parseFloat((totalArea / 10000).toFixed(2)),
          dateRange: {
            preFire: {
              startDate: preFireStartDate || '2014-08-07',
              endDate: preFireEndDate || '2014-08-08'
            },
            postFire: {
              startDate: postFireStartDate || '2015-09-11',
              endDate: postFireEndDate || '2015-09-12'
            }
          }
        }
      });
    }).catch(error => {
      console.error('❌ Error calculating burn severity statistics:', error);
      res.status(500).json({
        error: 'Failed to calculate burn severity statistics',
        details: error.message
      });
    });

  } catch (error) {
    console.error('❌ Error in burn severity statistics endpoint:', error);
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