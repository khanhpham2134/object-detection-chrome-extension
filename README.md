
# YOLO Object Detection Chrome Extension

## Overview
This Chrome extension uses TensorFlow.js and a lightweight YOLO11n model to perform real-time object detection on shared screen content. Users can search for specific objects by keyword, and the system will visually highlight them using bounding boxes.

## Features
- **Real-time Object Detection**: Uses YOLO11n model for fast and accurate detection.
- **Search Functionality**: Enter keywords to highlight specific object classes.
- **Visual Highlighting**: Bounding boxes and labels are overlaid on detected objects.
- **Performance Optimization**: Adaptive frame rate and efficient DOM updates.
- **Object Tracking**: Maintains object identity across frames.

## Technical Architecture

### Core Components

#### Detection System
- Built with TensorFlow.js and WebGL acceleration
- Utilizes a pre-trained YOLO11n model
- Includes object tracking for temporal consistency

#### UI Elements
- Renders bounding boxes and class labels in real time
- Displays detection statistics
- Provides start/stop controls for detection

#### Extension Integration
- Popup interface for keyword search
- Background service worker for tab control
- Chrome storage used to persist user preferences

### Project Structure
```
chrome-extension/
├── detection/              # Object detection logic
│   ├── detection.js        # Entry point for detection page
│   ├── model.js            # Loads and manages the model
│   ├── detect.js           # Detection and tracking logic
│   └── ui.js               # Renders bounding boxes and UI
├── public/                 # Static assets
│   ├── detection.html      # Detection UI HTML
│   ├── popup.html          # Extension popup HTML
│   ├── manifest.json       # Chrome manifest file
│   ├── service-worker.js   # Background worker
│   └── images/             # Icons and graphics
├── yolo11n_web_model/      # Pre-trained model
│   ├── model.json
│   ├── weights.bin
│   └── metadata.yaml
├── popup.js                # Handles popup interactions
├── vite.config.js          # Build configuration
├── build.js                # Custom build script
└── package.json            # Project dependencies
```

## Implementation Details

### Detection Pipeline

**Input Processing**
- Captures screen frames
- Resizes, pads, and normalizes input
- Prepares image tensor for inference

**Inference**
- Runs YOLO11n model using TensorFlow.js
- Extracts bounding boxes, classes, and scores
- Applies Non-Maximum Suppression (NMS)

**Rendering**
- Maps box coordinates to screen space
- Creates or updates DOM overlays
- Highlights matched keyword in green

**Performance Optimization**
- Throttles frame rate adaptively
- Reuses DOM elements to minimize memory use
- Minimizes layout thrashing and reflows

## Key Technologies
- **TensorFlow.js**: In-browser deep learning with GPU acceleration
- **ES Modules**: Modular JavaScript for maintainable code
- **Chrome Extensions API**: For seamless browser integration
- **Vite**: Fast bundling and hot-reload dev server
- **YOLO11n**: Lightweight model trained on COCO (80 classes)

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) and npm
- Google Chrome browser

### Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/khanhpham2134/object-detection-chrome-extension.git
   cd chrome-extension
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```

### Load in Chrome
1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` directory

## Usage
1. Click the extension icon in Chrome toolbar
2. Enter a keyword (e.g., `"person"`, `"car"`, `"laptop"`)
3. Click **Start Detection** to launch the detection interface
4. Share your screen when prompted
5. Detected objects will be outlined with bounding boxes
6. Matching objects will be highlighted in **green**

## Supported Objects
Supports 80 object classes from the COCO dataset, including:
- **People**: person
- **Vehicles**: car, truck, bus, motorcycle, bicycle, train
- **Animals**: dog, cat, horse, bird
- **Electronics**: laptop, phone, TV
- **Furniture**: chair, couch, bed, dining table
- And many more...

## Build Process
- Vite bundles and optimizes ES modules
- TensorFlow.js split into its own chunk for caching
- Static assets copied from `public/`
- Source maps generated for debugging

## Performance Considerations
- Real-time inference tuned for low-latency
- Uses WebGL when available
- DOM reuse and optimized layout rendering

