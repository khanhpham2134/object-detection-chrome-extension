/**
 * Storage for all detection box DOM elements currently displayed
 * Indexed by detection ID for quick lookup and updates
 * @type {Object.<string, HTMLElement>}
 */
let boxElements = {};

/**
 * Converts a hex color to an RGBA color with specified alpha
 * 
 * @param {string} hex - Hex color code (e.g. "#FF0000")
 * @param {number} alpha - Opacity value between 0-1
 * @returns {string} RGBA color string
 */
export function hexToRgba(hex, alpha) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`
    : `rgba(255, 0, 0, ${alpha})`; // Default to red if conversion fails
}

/**
 * Creates a new bounding box DOM element for a detection
 * 
 * @param {Object} detection - Detection object containing position, class, and score
 * @param {Object} detection.screenBox - Box coordinates in screen space
 * @param {string} detection.className - Human-readable class name
 * @param {number} detection.score - Confidence score (0-1)
 * @param {string} detection.id - Unique identifier for this detection
 * @param {boolean} detection.isKeywordMatch - Whether this matches user's search term
 * @param {number} detection.class - Class ID number
 * @param {HTMLElement} container - Container element to append the box to
 * @returns {HTMLElement} The created box element
 */
export function createBoxElement(detection, container) {
  const { screenBox, className, score, id, isKeywordMatch, class: classId } = detection;
  const { x1, y1, width, height } = screenBox;
  
  // Create the box element
  const boxElement = document.createElement('div');
  boxElement.className = 'detection-box';
  boxElement.dataset.id = id; // Store detection ID for future reference
  boxElement.style.position = 'absolute';
  boxElement.style.left = `${x1}px`;
  boxElement.style.top = `${y1}px`;
  boxElement.style.width = `${width}px`;
  boxElement.style.height = `${height}px`;
  
  // Predefined colors for different object classes
  // Each class gets a consistent color based on its ID
  const colors = [
    "#FF3838", "#FF9D97", "#FF701F", "#FFB21D", "#CFD231", 
    "#48F90A", "#92CC17", "#3DDB86", "#1A9334", "#00D4BB", 
    "#2C99A8", "#00C2FF", "#344593", "#6473FF", "#0018EC", 
    "#8438FF", "#520085", "#CB38FF", "#FF95C8", "#FF37C7"
  ];
  const colorIndex = classId % colors.length;
  // Highlight with green if this matches the search keyword
  const color = isKeywordMatch ? "#00FF00" : colors[colorIndex];
  
  // Apply visual styling to the box
  boxElement.style.border = `2px solid ${color}`;
  boxElement.style.backgroundColor = hexToRgba(color, 0.2); // Semi-transparent fill
  boxElement.style.boxSizing = 'border-box';
  boxElement.style.opacity = '0'; // Start invisible for fade-in animation
  boxElement.style.zIndex = '10';
  
  // Create the label element showing object class and confidence
  const labelElement = document.createElement('div');
  labelElement.className = 'detection-label';
  labelElement.style.position = 'absolute';
  labelElement.style.bottom = '100%'; // Position above the box by default
  labelElement.style.left = '0';
  labelElement.style.backgroundColor = color;
  labelElement.style.color = '#fff';
  labelElement.style.padding = '2px 6px';
  labelElement.style.fontSize = '12px';
  labelElement.style.borderRadius = '3px 3px 0 0';
  labelElement.style.whiteSpace = 'nowrap'; // Prevent text wrapping
  labelElement.style.zIndex = '20'; // Place above the box
  labelElement.style.pointerEvents = 'none'; // Don't interfere with mouse events
  labelElement.style.transformOrigin = 'bottom left';
  
  // Split the label into class name and accuracy for separate updates
  const classNameSpan = document.createElement('span');
  classNameSpan.className = 'class-name';
  classNameSpan.textContent = `${className} - `;
  
  const accuracySpan = document.createElement('span');
  accuracySpan.className = 'accuracy';
  accuracySpan.textContent = `${Math.round(score * 100)}%`;
  
  // Assemble the DOM structure
  labelElement.appendChild(classNameSpan);
  labelElement.appendChild(accuracySpan);
  boxElement.appendChild(labelElement);
  container.appendChild(boxElement);
  
  // Store reference for future updates
  boxElements[id] = boxElement;
  
  // Fade in the box and position the label properly after a short delay
  // This allows the browser to paint the element first
  setTimeout(() => {
    boxElement.style.opacity = '1';
    repositionLabel(boxElement);
  }, 10);
  
  return boxElement;
}

/**
 * Updates an existing box element with new position and score data
 * 
 * @param {HTMLElement} boxElement - The DOM element to update
 * @param {Object} detection - New detection data
 * @param {Object} detection.screenBox - Updated box coordinates
 * @param {number} detection.score - Updated confidence score
 */
export function updateExistingBoxElement(boxElement, detection) {
  const { screenBox, score } = detection;
  const { x1, y1, width, height } = screenBox;
  
  // Check if position or size has changed significantly (avoid minor jitter)
  const currentX = parseFloat(boxElement.style.left);
  const currentY = parseFloat(boxElement.style.top);
  const currentWidth = parseFloat(boxElement.style.width);
  const currentHeight = parseFloat(boxElement.style.height);
  
  const positionChanged = 
    Math.abs(currentX - x1) > 1 || 
    Math.abs(currentY - y1) > 1 ||
    Math.abs(currentWidth - width) > 1 ||
    Math.abs(currentHeight - height) > 1;
  
  // Only update position and size if they've changed significantly
  // This reduces DOM operations for better performance
  if (positionChanged) {
    boxElement.style.left = `${x1}px`;
    boxElement.style.top = `${y1}px`;
    boxElement.style.width = `${width}px`;
    boxElement.style.height = `${height}px`;
    
    // Reposition the label when the box moves
    repositionLabel(boxElement);
  }
  
  // Update accuracy percentage if needed
  const accuracyElement = boxElement.querySelector('.accuracy');
  if (accuracyElement) {
    const currentScore = parseInt(accuracyElement.textContent);
    const newScore = Math.round(score * 100);
    
    // Only update DOM if score has changed
    if (currentScore !== newScore) {
      accuracyElement.textContent = `${newScore}%`;
    }
  }
}

/**
 * Positions the label element intelligently to keep it visible
 * within the container boundaries
 * 
 * @param {HTMLElement} boxElement - Box element containing the label
 */
export function repositionLabel(boxElement) {
  const labelElement = boxElement.querySelector('.detection-label');
  if (!labelElement) return;
  
  const container = boxElement.parentNode;
  if (!container) return;
  
  // Get dimensions of container and box
  const containerRect = container.getBoundingClientRect();
  const boxRect = boxElement.getBoundingClientRect();
  
  // Reset to default position (above the box)
  labelElement.style.bottom = '100%';
  labelElement.style.top = 'auto';
  labelElement.style.left = '0';
  labelElement.style.right = 'auto';
  
  // Use setTimeout to calculate after browser layout is complete
  setTimeout(() => {
    const labelRect = labelElement.getBoundingClientRect();
    
    // If label extends above container, move it to the top of the box
    if (labelRect.top < containerRect.top) {
      labelElement.style.bottom = 'auto';
      labelElement.style.top = '0';
    }
    
    // If label extends beyond right edge, right-align it
    if (labelRect.right > containerRect.right) {
      labelElement.style.left = 'auto';
      labelElement.style.right = '0';
    }
  }, 0);
}

/**
 * Creates or updates statistics display showing detection counts
 * 
 * @param {number} totalCount - Total number of objects detected
 * @param {number} keywordCount - Number of objects matching keyword
 * @param {string} keyword - The current search keyword
 */
export function updateDetectionStats(totalCount, keywordCount, keyword) {
  let statsDiv = document.getElementById("detectionStats");
  
  // Create stats div if it doesn't exist
  if (!statsDiv) {
    statsDiv = document.createElement("div");
    statsDiv.id = "detectionStats";
    statsDiv.style.position = "fixed";
    statsDiv.style.top = "10px";
    statsDiv.style.right = "10px";
    statsDiv.style.backgroundColor = "rgba(0,0,0,0.7)";
    statsDiv.style.color = "white";
    statsDiv.style.padding = "10px";
    statsDiv.style.borderRadius = "5px";
    statsDiv.style.zIndex = "1000";
    document.body.appendChild(statsDiv);
  }
  
  // Update stats text
  statsDiv.innerHTML = `
    <div>Total objects: ${totalCount}</div>
    ${keyword ? `<div>"${keyword}" objects: ${keywordCount}</div>` : ''}
  `;
}

/**
 * Removes the statistics display
 */
export function removeStats() {
  const statsDiv = document.getElementById("detectionStats");
  if (statsDiv) statsDiv.remove();
}

/**
 * Returns the map of all box elements
 * @returns {Object.<string, HTMLElement>} Map of detection IDs to box elements
 */
export function getBoxElements() {
  return boxElements;
}

/**
 * Clears all box elements from memory
 */
export function resetBoxElements() {
  boxElements = {};
}

/**
 * Displays an error message to the user
 * @param {string} message - The error message to show
 */
export function showError(message) {
  const errorElement = document.getElementById("errorMessage");
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = "block";
  }
}

/**
 * Hides the error message
 */
export function hideError() {
  const errorElement = document.getElementById("errorMessage");
  if (errorElement) {
    errorElement.style.display = "none";
  }
}

/**
 * Updates button states based on application state
 * 
 * @param {boolean} isDetecting - Whether detection is currently running
 * @param {boolean} hasVideo - Whether a video source is available
 */
export function updateButtonState(isDetecting, hasVideo) {
  // Start button is disabled when detecting or no video is available
  document.getElementById("start").disabled = isDetecting || !hasVideo;
  // Stop button is only enabled when detection is running
  document.getElementById("stop").disabled = !isDetecting;
}