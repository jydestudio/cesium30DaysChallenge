import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'


import { Ion } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

const accessToken = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN;

if (accessToken) {
  Ion.defaultAccessToken = accessToken;
} else {
  console.warn('Cesium Ion access token is not defined. Please set VITE_CESIUM_ION_ACCESS_TOKEN in your .env file.');
}


createRoot(document.getElementById('root')).render(
    <App />
)
