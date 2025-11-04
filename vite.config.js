import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const cesiumSource = 'node_modules/cesium/Build/Cesium/';
const cesiumBaseUrl = 'cesiumStatic'; // Directory name for the assets

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl },
      ],
    }),
  ],
  // Define CESIUM_BASE_URL to tell Cesium where to find the copied assets
  define: {
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}/`),
  },
  server: {
    port: 3000,
  }
});