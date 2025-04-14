/**
 * Main entry point for the object detection application
 * Coordinates between model, detection, and UI components
 */

import { loadModel, loadClassNames, getModel, cleanupTensorflow } from './model.js';
import { processFrame, findMatchingDetection, getDetectionInterval } from './detect.js';
import { 
  createBoxElement, updateExistingBoxElement,
  updateDetectionStats, removeStats, showError, hideError,
  updateButtonState, getBoxElements, resetBoxElements
} from './ui.js';

/**
 * Global state variables
 */
let keyword = "";               // Search keyword for highlighting specific objects
let videoElement = null;        // Reference to the video element capturing screen content
let isDetectionRunning = false; // Flag indicating if detection loop is active
let lastDetectionTime = 0;      // Timestamp of last detection for throttling
let previousDetections = [];    // Previous frame's detections for tracking
let wasRunningBeforeHidden = false; // Track if detection was running before tab became hidden
let modelInferenceCount = 0; // Count of model inferences for performance tracking
let lastModelCountTime = performance.now(); // Timestamp for last model FPS count

/**
 * Initialize the application when DOM is fully loaded
 */
document.addEventListener("DOMContentLoaded", () => {
  // Initialize video element reference
  videoElement = document.getElementById("video");
  
  // Set up event listeners for UI controls
  document.getElementById("shareScreen").addEventListener("click", startScreenCapture);
  document.getElementById("start").addEventListener("click", startDetection);
  document.getElementById("stop").addEventListener("click", stopDetection);
  
  // Initial button states - disabled until video source is available
  updateButtonState(false, false);
  
  // Load model and class names asynchronously
  Promise.all([loadModel(), loadClassNames()])
    .then(() => {
      document.getElementById("modelStatus").textContent = "Model loaded successfully!";
    })
    .catch(error => {
      console.error("Initialization error:", error);
      document.getElementById("modelStatus").textContent = "Error loading model: " + error.message;
      document.getElementById("modelStatus").style.color = "#db4437"; // Google red for error
    });
  
  // Load search keyword from Chrome extension storage
  chrome.storage.local.get("objectKeyword", (data) => {
    if (data.objectKeyword) {
      keyword = data.objectKeyword.toLowerCase();
      console.log("Detecting:", keyword);
      
      // Update UI to show current keyword
      document.title = `Detecting: ${keyword}`;
      const keywordDisplay = document.getElementById("keywordDisplay");
      if (keywordDisplay) {
        keywordDisplay.textContent = `Looking for: ${keyword}`;
      }
    } else {
      console.warn("No object keyword found in storage.");
    }
  });
});

/**
 * Handle page visibility changes to pause/resume detection
 * This reduces resource usage when tab is not visible
 */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('Page hidden, pausing detection');
    wasRunningBeforeHidden = isDetectionRunning;
    isDetectionRunning = false;
  } else if (wasRunningBeforeHidden) {
    console.log('Page visible again, resuming detection');
    isDetectionRunning = true;
    lastDetectionTime = 0;
    requestAnimationFrame(detectionLoop);
  }
});

/**
 * Start screen capture using browser's MediaDevices API
 * Requests user permission to share screen content
 */
async function startScreenCapture() {
  try {
    // Request screen sharing with cursor
    const stream = await navigator.mediaDevices.getDisplayMedia({ 
      video: { cursor: "always" },
      audio: false 
    });
    
    // Set captured stream as source for video element
    videoElement = document.getElementById("video");
    videoElement.srcObject = stream;
    
    // Handle user-initiated stop of screen sharing
    stream.getVideoTracks()[0].onended = () => {
      stopDetection();
      console.log("Screen sharing ended by user");
    };
    
    // Once video metadata is loaded, enable detection
    videoElement.onloadedmetadata = () => {
      console.log("Screen sharing started");
      updateButtonState(false, true);
    };
  } catch (err) {
    // Handle permission denied or other errors
    console.error("Error accessing screen sharing:", err);
    showError(`Error accessing screen sharing: ${err.message}`);
  }
}

/**
 * Start the object detection process
 * Validates prerequisites and initializes detection loop
 */
async function startDetection() {
  // Ensure model is loaded
  if (!getModel()) {
    showError("Model not loaded yet. Please wait.");
    return;
  }
  
  // Verify video feed is available
  if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
    showError("Screen sharing not properly started or video not available.");
    return;
  }
  
  // Clear any previous errors
  hideError();
  updateButtonState(true, true);
  
  // Reset detection state
  resetBoxElements();
  previousDetections = [];
  isDetectionRunning = true;
  
  // Reset the boxes container and prepare overlay
  const boxesContainer = document.getElementById("boxes");
  if (boxesContainer) {
    boxesContainer.innerHTML = "";
    
    // Match overlay size to video dimensions
    const videoRect = videoElement.getBoundingClientRect();
    boxesContainer.style.width = `${videoRect.width}px`;
    boxesContainer.style.height = `${videoRect.height}px`;
  }
  
  // Begin detection loop
  lastDetectionTime = 0;
  requestAnimationFrame(detectionLoop);
}

/**
 * Stop detection and clean up resources
 */
function stopDetection() {
  isDetectionRunning = false;
  updateButtonState(false, videoElement !== null);
  
  // Animate box removal with fade-out effect
  const boxesContainer = document.getElementById("boxes");
  if (boxesContainer) {
    const boxes = boxesContainer.querySelectorAll('.detection-box');
    boxes.forEach(box => {
      box.style.opacity = "0";
    });
    
    // Clear container after animation completes
    setTimeout(() => {
      boxesContainer.innerHTML = "";
    }, 500);
  }
  
  // Clean up resources and references
  resetBoxElements();
  previousDetections = [];
  removeStats();
  cleanupTensorflow();
}

/**
 * Main detection loop using requestAnimationFrame
 * Processes frames at a throttled rate to balance performance
 * 
 * @param {number} timestamp - Current animation frame timestamp
 */
async function detectionLoop(timestamp) {
  // Exit if detection is no longer running
  if (!isDetectionRunning) return;
  
  // Schedule next frame immediately to maintain smooth animation
  requestAnimationFrame(detectionLoop);
  
  // Apply throttling - only process frames at the specified interval
  if (timestamp - lastDetectionTime < getDetectionInterval()) {
    return;
  }
  
  lastDetectionTime = timestamp;
  
  try {
    // Process current frame through TensorFlow model
    const { processedDetections, paddingInfo } = await processFrame(videoElement);
    
    modelInferenceCount++;
    const now = performance.now();
    if (now - lastModelCountTime >= 1000) {
      console.log("YOLO inference FPS:", modelInferenceCount);
      
      // Check if element exists before updating
      const fpsElement = document.getElementById("modelFps");
      if (fpsElement) {
        fpsElement.textContent = `${modelInferenceCount} model FPS`;
      }
      
      modelInferenceCount = 0;
      lastModelCountTime = now;
    }

    // Update UI with detection results
    updateDetectionBoxes(processedDetections, paddingInfo);
    
  } catch (error) {
    // Handle detection errors
    console.error("Error during object detection:", error);
    isDetectionRunning = false;
    showError(`Detection error: ${error.message}`);
    updateButtonState(false, true);
  }
}

/**
 * Updates the visual representation of detection boxes
 * Maps model coordinates to screen coordinates and manages box elements
 * 
 * @param {Array<Object>} detections - Array of detected objects
 * @param {Object} paddingInfo - Information about padding and scaling applied to input
 */
function updateDetectionBoxes(detections, paddingInfo) {
  const boxesContainer = document.getElementById("boxes");
  if (!boxesContainer) return;
  
  // Safety check for detections array
  if (!detections || !Array.isArray(detections)) {
    console.warn("No valid detections to process");
    detections = [];
  }
  
  // Extract transformation parameters from padding info
  const { scale, padLeft, padTop } = paddingInfo;
  
  // Calculate display scaling ratios
  const videoRect = videoElement.getBoundingClientRect();
  const displayRatioX = videoRect.width / videoElement.videoWidth;
  const displayRatioY = videoRect.height / videoElement.videoHeight;
  
  // Ensure overlay matches video size
  boxesContainer.style.width = `${videoRect.width}px`;
  boxesContainer.style.height = `${videoRect.height}px`;
  
  // Statistics tracking
  let detectionCount = detections.length;
  let keywordMatchCount = 0;
  const processedIds = new Set();
  const boxElements = getBoxElements();
  
  // Process each detection and prepare screen coordinates
  for (const detection of detections) {
    // Track objects across frames by finding matching detections
    const matchingDetection = findMatchingDetection(detection, previousDetections);
    
    // Maintain ID if object was in previous frame, otherwise create new ID
    if (matchingDetection) {
      detection.id = matchingDetection.id;
    } else {
      // Generate unique ID from class and position for new objects
      detection.id = `${detection.class}_${Math.round(detection.box[0]*100)}_${Math.round(detection.box[1]*100)}_${Date.now() % 1000}`;
    }
    
    // Track which detections we've processed in this frame
    processedIds.add(detection.id);
    
    // Convert model coordinates to screen coordinates
    const [x1, y1, x2, y2] = detection.box;
    
    // Remove model padding from normalized coordinates
    const unpadX1 = (x1 - padLeft) / scale;
    const unpadY1 = (y1 - padTop) / scale;
    const unpadX2 = (x2 - padLeft) / scale;
    const unpadY2 = (y2 - padTop) / scale;
    
    // Scale to screen dimensions
    const displayX1 = unpadX1 * displayRatioX;
    const displayY1 = unpadY1 * displayRatioY;
    const displayX2 = unpadX2 * displayRatioX;
    const displayY2 = unpadY2 * displayRatioY;
    
    // Store screen box coordinates for UI rendering
    detection.screenBox = {
      x1: displayX1,
      y1: displayY1,
      width: displayX2 - displayX1,
      height: displayY2 - displayY1
    };
    
    // Check if this detection matches user's search keyword
    const isKeywordMatch = keyword && detection.className.toLowerCase().includes(keyword.toLowerCase());
    if (isKeywordMatch) keywordMatchCount++;
    detection.isKeywordMatch = isKeywordMatch;
  }
  
  // Remove boxes for objects no longer detected
  for (const id in boxElements) {
    if (!processedIds.has(id)) {
      const boxElement = boxElements[id];
      if (boxElement) {
        // Apply fade-out animation before removal
        boxElement.style.opacity = "0";
        
        // Remove from DOM after animation completes
        setTimeout(() => {
          if (boxElement.parentNode) {
            boxElement.parentNode.removeChild(boxElement);
          }
        }, 300);
        
        // Remove from tracking dictionary
        delete boxElements[id];
      }
    }
  }
  
  // Create or update boxes for current detections
  for (const detection of detections) {
    // Skip invalid detections
    if (!detection || !detection.id) continue;
    
    // Find matching detection in previous frame
    const prev = previousDetections ? 
      previousDetections.find(p => p && p.id === detection.id) : null;
      
    if (!prev || prev.class !== detection.class) {
      // Object class has changed or is new - recreate the box
      if (boxElements[detection.id]) {
        boxElements[detection.id].remove();
        delete boxElements[detection.id];
      }
      createBoxElement(detection, boxesContainer);
    } else {
      // Object is the same class - update existing box or create if missing
      if (boxElements[detection.id]) {
        updateExistingBoxElement(boxElements[detection.id], detection);
      } else {
        createBoxElement(detection, boxesContainer);
      }
    }
  }
  
  // Update statistics display
  updateDetectionStats(detectionCount, keywordMatchCount, keyword);
  
  // Store current detections for next frame comparison (with minimal data)
  previousDetections = Array.isArray(detections) ? 
    detections.map(det => {
      if (det) {
        return { 
          id: det.id || '',           // Preserve ID for tracking
          class: det.class || 0,      // Class ID for type comparison
          box: det.box || [0, 0, 0, 0] // Position for movement tracking
        };
      }
      return null;
    }).filter(Boolean) : []; // Remove any null entries
}