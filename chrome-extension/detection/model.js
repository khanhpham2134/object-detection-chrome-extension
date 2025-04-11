import * as tf from '@tensorflow/tfjs';

/**
 * Global reference to the loaded TensorFlow.js model
 * @type {tf.GraphModel|null}
 */
let model;

/**
 * Map of class IDs to human-readable class names
 * @type {Object.<number, string>}
 */
let classNames = {};

/**
 * Loads class names from the model's metadata YAML file
 * 
 * The metadata.yaml file contains information about the model's classes
 * in COCO dataset format, which maps numeric class IDs to human-readable names
 * 
 * @returns {Promise<Object>} Object mapping class IDs to class names
 * @throws {Error} If metadata can't be loaded or parsed
 */
export async function loadClassNames() {
  try {
    // Fetch the metadata file using Chrome extension URL
    const response = await fetch(chrome.runtime.getURL('../yolo11n_web_model/metadata.yaml'));
    const yamlText = await response.text();
    
    // Extract the 'names:' section from the YAML
    const namesSection = yamlText.split('names:')[1].split('\n\n')[0];
    // Split into lines and remove empty ones
    const nameLines = namesSection.split('\n').filter(line => line.trim() !== '');
    
    // Parse each line to extract class ID and name
    nameLines.forEach(line => {
      // Use regex to match "<id>: <class name>" pattern
      const match = line.match(/\s+(\d+):\s+(.*)/);
      if (match) {
        const classId = parseInt(match[1]);
        const className = match[2].trim();
        classNames[classId] = className;
      }
    });
    
    console.log("Class names loaded:", Object.keys(classNames).length);
    return classNames;
  } catch (error) {
    console.error("Error loading class names:", error);
    throw error;
  }
}

/**
 * Loads the YOLO object detection model
 * 
 * This loads a TensorFlow.js graph model from the extension's resources
 * and initializes it for inference. The model is stored in the global 'model'
 * variable for later access.
 * 
 * @returns {Promise<tf.GraphModel>} The loaded model
 * @throws {Error} If model loading fails
 */
export async function loadModel() {
  try {
    // Update UI to show loading status
    document.getElementById("modelStatus").textContent = "Loading model...";
    
    // Get the path to the model's JSON file using Chrome extension URL
    const modelPath = chrome.runtime.getURL('../yolo11n_web_model/model.json');
    
    // Load the model with caching disabled to ensure fresh model
    model = await tf.loadGraphModel(modelPath, {
      fetchFunc: (url, init) => {
        return fetch(url, {
          ...init,
          cache: 'no-store'  // Prevent browser caching to ensure latest version
        });
      }
    });
    console.log("YOLO Model Loaded Successfully");
    return model;
  } catch (error) {
    // Handle loading errors and update UI
    console.error("Error loading YOLO model:", error);
    document.getElementById("errorMessage").textContent = `Error loading model: ${error.message}`;
    document.getElementById("errorMessage").style.display = "block";
    throw error;
  }
}

/**
 * Returns the currently loaded model
 * 
 * @returns {tf.GraphModel|null} The YOLO detection model or null if not loaded
 */
export function getModel() {
  return model;
}

/**
 * Returns the loaded class names dictionary
 * 
 * @returns {Object.<number, string>} Object mapping class IDs to class names
 */
export function getClassNames() {
  return classNames;
}

/**
 * Cleans up TensorFlow resources to prevent memory leaks
 * 
 * This should be called when detection is stopped to free GPU memory
 * and prevent memory-related performance issues.
 */
export function cleanupTensorflow() {
  try {
    // Dispose of all variables tracked by TensorFlow.js
    tf.disposeVariables();
    console.log("TensorFlow memory state:", tf.memory());
  } catch (e) {
    console.error("Error during TensorFlow cleanup:", e);
  }
}