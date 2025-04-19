import * as tf from '@tensorflow/tfjs';
import { getModel, getClassNames } from './model.js';

// Throttling configuration
let DETECTION_INTERVAL = 200;  // Initial/fallback value
const MIN_INTERVAL = 0;        // Minimum interval (0 = unlimited)
const MAX_INTERVAL = 500;      // Maximum interval (throttle floor)
let frameTimings = [];         // Store recent frame times
const MAX_SAMPLES = 10;        // Number of samples to average

/**
 * Returns a dynamically calculated detection interval
 * based on recent processing performance
 * @returns {number} Adaptive interval between detections in milliseconds
 */
export function getDetectionInterval() {
  // If we have timing data, calculate adaptive interval
  if (frameTimings.length >= 5) {
    // Calculate average processing time
    const avgTime = frameTimings.reduce((sum, time) => sum + time, 0) / frameTimings.length;
    
    // Set target to be slightly above average processing time
    // This prevents queueing frames faster than they can be processed
    let adaptiveInterval = avgTime * 1.2;
    
    // Clamp to reasonable range
    adaptiveInterval = Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, adaptiveInterval));
    
    return adaptiveInterval;
  }
  
  // Fallback to default if not enough samples
  return DETECTION_INTERVAL;
}

/**
 * Record a frame processing time
 * @param {number} time - Processing time in milliseconds
 */
export function recordFrameTiming(time) {
  frameTimings.push(time);
  
  // Keep array at reasonable size
  if (frameTimings.length > MAX_SAMPLES) {
    frameTimings.shift(); // Remove oldest
  }
}

/**
 * Main detection function that processes a video frame and returns object detections
 * @param {HTMLVideoElement} videoElement - The video element to capture frames from
 * @returns {Object} Object containing processed detections and padding information
 */
export async function processFrame(videoElement) {
  const model = getModel();
  const classNames = getClassNames();
  
  // Validate required inputs are available
  if (!model || !videoElement) {
    throw new Error("Model or video not available");
  }
  
  // YOLO model input dimensions
  const modelWidth = 640;
  const modelHeight = 640;
  
  // Start TensorFlow memory scope to manage tensor disposal
  tf.engine().startScope();
  
  try {
    // Process video element directly
    const [inputTensor, paddingInfo] = tf.tidy(() => {
      // Convert video frame to tensor
      const img = tf.browser.fromPixels(videoElement);
      
      // Get original dimensions
      const [h, w] = img.shape.slice(0, 2);
      
      // Calculate scaling to fit within model dimensions while preserving aspect ratio
      const scale = Math.min(modelWidth / w, modelHeight / h);
      const newWidth = Math.round(w * scale);
      const newHeight = Math.round(h * scale);
      
      // Resize the image to fit model dimensions
      const resized = tf.image.resizeBilinear(img, [newHeight, newWidth]);
      
      // Calculate padding to center the image within model dimensions
      const padTop = Math.floor((modelHeight - newHeight) / 2);
      const padLeft = Math.floor((modelWidth - newWidth) / 2);
      const padBottom = modelHeight - newHeight - padTop;
      const padRight = modelWidth - newWidth - padLeft;
      
      // Add padding to make image exactly match model dimensions
      const padded = tf.pad(resized, [
        [padTop, padBottom],
        [padLeft, padRight],
        [0, 0]
      ]);
      
      // Return normalized tensor and metadata about transformations
      return [
        padded.div(255.0).expandDims(0), // Normalize to [0,1] and add batch dimension
        { 
          scale: scale,
          padLeft: padLeft, 
          padTop: padTop,
          originalShape: [h, w] 
        }
      ];
    });
    
    // Run inference on the prepared tensor
    const outputs = await model.execute(inputTensor);
    const processedDetections = [];
    
    try {
      let transposed, boxes, scores, classes, nms, boxes_data, scores_data, classes_data;
      
      try {
        // Post-process model output to get detection boxes, scores, and classes
        [transposed, boxes, scores, classes] = tf.tidy(() => {
          // Transpose model output to correct dimensions
          const trans = tf.transpose(outputs, [0, 2, 1]);
          
          // Extract width and height from model output
          const w = trans.slice([0, 0, 2], [-1, -1, 1]);
          const h = trans.slice([0, 0, 3], [-1, -1, 1]);
          
          // Calculate box coordinates from center, width, height
          const x1 = tf.sub(trans.slice([0, 0, 0], [-1, -1, 1]), tf.div(w, 2));
          const y1 = tf.sub(trans.slice([0, 0, 1], [-1, -1, 1]), tf.div(h, 2));
          
          // Construct boxes in [y1, x1, y2, x2] format for NMS
          const boxesResult = tf.concat(
            [
              y1, x1,
              tf.add(y1, h),
              tf.add(x1, w),
            ],
            2
          ).squeeze();
          
          // Extract class scores from output
          const numClasses = 80;  // Number of COCO dataset classes
          const rawScores = trans.slice([0, 0, 4], [-1, -1, numClasses]).squeeze(0);
          
          // Keep tensors from being garbage collected
          tf.keep(trans);
          tf.keep(boxesResult);
          
          // Get max score and corresponding class for each detection
          const maxScores = rawScores.max(1);
          const classIndices = rawScores.argMax(1);
          tf.keep(maxScores);
          tf.keep(classIndices);
          
          return [trans, boxesResult, maxScores, classIndices];
        });
        
        // Apply non-maximum suppression to filter overlapping boxes
        const confidenceThreshold = 0.4;  // Minimum confidence score
        const iouThreshold = 0.45;          // Intersection over Union threshold
        nms = await tf.image.nonMaxSuppressionAsync(
          boxes, scores, 100, confidenceThreshold, iouThreshold
        );
        
        // Convert tensor outputs to JavaScript arrays
        boxes_data = boxes.gather(nms, 0).dataSync();
        scores_data = scores.gather(nms, 0).dataSync();
        classes_data = classes.gather(nms, 0).dataSync();
        
        // Format detections for UI rendering
        for (let i = 0; i < scores_data.length; i++) {
          const score = scores_data[i];
          const classId = classes_data[i];
          const className = classNames[classId] || `Unknown (${classId})`;
          
          // Extract box coordinates
          const y1 = boxes_data[i * 4];
          const x1 = boxes_data[i * 4 + 1];
          const y2 = boxes_data[i * 4 + 2];
          const x2 = boxes_data[i * 4 + 3];
          
          // Store detection information
          processedDetections.push({
            box: [x1, y1, x2, y2],  // Box coordinates [x1, y1, x2, y2]
            score: score,            // Confidence score (0-1)
            class: classId,          // Class ID
            className: className      // Human-readable class name
          });
        }
      } finally {
        // Clean up tensors to prevent memory leaks
        if (transposed && !transposed.isDisposed) transposed.dispose();
        if (boxes && !boxes.isDisposed) boxes.dispose();
        if (scores && !scores.isDisposed) scores.dispose();
        if (classes && !classes.isDisposed) classes.dispose();
        if (nms && !nms.isDisposed) nms.dispose();
      }
    } catch (err) {
      console.error("Error processing model output:", err);
    } finally {
      // Final cleanup of outputs tensor
      if (outputs && !outputs.isDisposed) {
        outputs.dispose();
      }
      tf.engine().endScope();
    }
    
    return { processedDetections, paddingInfo };
  } catch (error) {
    // Ensure tensor memory is released even on error
    tf.engine().endScope();
    throw error;
  }
}

/**
 * Tracks objects between frames by finding matching detections
 * @param {Object} detection - Current detection to match
 * @param {Array} previousDetections - Array of detections from previous frame
 * @returns {Object|null} Matching detection from previous frame or null if no match
 */
export function findMatchingDetection(detection, previousDetections) {
  // Add null check to prevent errors
  if (!previousDetections || !Array.isArray(previousDetections) || previousDetections.length === 0) {
    return null;
  }
  
  // Ensure detection has a box property before accessing it
  if (!detection || !detection.box) {
    return null;
  }
  
  // Try to find exact ID match first (fastest path)
  if (detection.id) {
    const exactMatch = previousDetections.find(p => p.id === detection.id);
    if (exactMatch) return exactMatch;
  }
  
  // If no exact match, try to find similar object by position and class
  for (const prev of previousDetections) {
    // Must be the same class and have box property
    if (prev.class === detection.class && prev.box) {
      // Check if positions are close enough to be the same object
      const [x1, y1] = detection.box;
      const [px1, py1] = prev.box;
      
      // Calculate distance between centers
      const dx = Math.abs(x1 - px1);
      const dy = Math.abs(y1 - py1);

      // If objects are within threshold distance, consider them the same
      if (dx < 0.15 && dy < 0.15) {
        return prev;
      }
    }
  }
  
  // No match found
  return null;
}