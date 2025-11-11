# Google Earth Engine Backend Server

This Node.js backend handles Google Earth Engine authentication and provides tile URLs to your React frontend.

## Setup Instructions

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Get Your Service Account Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Enable the **Earth Engine API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Earth Engine API"
   - Click "Enable"

4. Create a Service Account:
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Name it (e.g., "earth-engine-service")
   - Click "Create and Continue"
   - Skip granting roles (optional)
   - Click "Done"

5. Generate Key:
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose **JSON** format
   - Download the key file

6. Save the key:
   - Rename the downloaded file to `private-key.json`
   - Move it to the `server/` folder
   - **IMPORTANT**: Add `private-key.json` to `.gitignore`!

### 3. Register Service Account with Earth Engine

Run this command in your terminal (replace with your service account email):

```bash
earthengine authenticate --service_account YOUR-SERVICE-ACCOUNT@PROJECT.iam.gserviceaccount.com
```

Or visit: https://signup.earthengine.google.com/#!/service_accounts

Register your service account email (found in the private-key.json file as "client_email").

### 4. Start the Server

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

Server will run on http://localhost:5000

## API Endpoints

### Health Check
```
GET /api/health
```

### Landsat Tiles
```
POST /api/gee/landsat-tiles
Content-Type: application/json

{
  "startDate": "2020-01-01",
  "endDate": "2020-12-31"
}
```

### NDVI Tiles
```
POST /api/gee/ndvi-tiles
Content-Type: application/json

{
  "startDate": "2020-06-01",
  "endDate": "2020-09-01",
  "bounds": [-122.5, 37.4, -122.3, 37.6]
}
```

### Elevation Tiles
```
POST /api/gee/elevation-tiles
Content-Type: application/json
```

### Custom Image Collection
```
POST /api/gee/custom-tiles
Content-Type: application/json

{
  "collectionId": "LANDSAT/LC08/C02/T1_L2",
  "startDate": "2020-01-01",
  "endDate": "2020-12-31",
  "bands": ["SR_B4", "SR_B3", "SR_B2"],
  "min": 7000,
  "max": 12000
}
```

## Security Notes

- **Never commit `private-key.json` to Git!**
- Add to `.gitignore`:
  ```
  server/private-key.json
  ```
- Use environment variables for production
- Consider rate limiting for public APIs

## Troubleshooting

### "Authentication error"
- Make sure your service account is registered with Earth Engine
- Check that `private-key.json` is in the correct location
- Verify the service account has Earth Engine access

### "Earth Engine not initialized yet"
- Wait a few seconds after server starts
- Check console logs for initialization status

### CORS errors
- The server has CORS enabled for all origins
- Modify `cors()` options in server.js if needed
