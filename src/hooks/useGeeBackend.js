import { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Custom hook to interact with GEE backend
 */
export const useGeeBackend = () => {
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check backend health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        setIsReady(data.earthEngineReady);
      } catch (err) {
        console.error('Backend health check failed:', err);
        setError('Backend server not available');
      }
    };

    checkHealth();
    // Check every 5 seconds until ready
    const interval = setInterval(checkHealth, 5000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Get Landsat tile URL
   */
  const getLandsatTiles = async (startDate = '2020-01-01', endDate = '2020-12-31') => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/gee/landsat-tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate })
      });

      const data = await response.json();

      if (data.success) {
        setLoading(false);
        return data.tileUrl;
      } else {
        throw new Error(data.error || 'Failed to get tiles');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Get NDVI tile URL
   */
  const getNdviTiles = async (startDate, endDate, bounds = null) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/gee/ndvi-tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, bounds })
      });

      const data = await response.json();

      if (data.success) {
        setLoading(false);
        return data.tileUrl;
      } else {
        throw new Error(data.error || 'Failed to get NDVI tiles');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Get elevation tile URL
   */
  const getElevationTiles = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/gee/elevation-tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        setLoading(false);
        return data.tileUrl;
      } else {
        throw new Error(data.error || 'Failed to get elevation tiles');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Get custom image collection tiles
   */
  const getCustomTiles = async (config) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/gee/custom-tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (data.success) {
        setLoading(false);
        return data.tileUrl;
      } else {
        throw new Error(data.error || 'Failed to get custom tiles');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  return {
    isReady,
    loading,
    error,
    getLandsatTiles,
    getNdviTiles,
    getElevationTiles,
    getCustomTiles
  };
};

export default useGeeBackend;
