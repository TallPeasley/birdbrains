# BirdBrains Chrome Extension

Manifest V3 extension for capturing a math worksheet page from the active browser tab or picking an image file and uploading it to BirdBrains via the signed-URL upload flow (`POST /uploads` → `PUT {uploadUrl}` → `POST /submissions/{id}/process`).

## Load in Chrome (Developer Mode)
1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Click the **⚙** icon in the popup to set your **Firebase Web API Key** (or click **Try Demo Mode** to test without credentials).
