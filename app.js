// ================= AeroPuzzle Game Engine =================

const video = document.getElementById('webcam');
const cameraOverlay = document.getElementById('camera-overlay');
const cameraCtx = cameraOverlay.getContext('2d');

const puzzleCanvas = document.getElementById('puzzle-canvas');
const puzzleCtx = puzzleCanvas.getContext('2d');

const trackingStatus = document.getElementById('tracking-status');
const gameTimer = document.getElementById('game-timer');
const actionPrompt = document.getElementById('action-prompt');

const toggleCameraBtn = document.getElementById('toggle-camera-btn');
const resetPuzzleBtn = document.getElementById('reset-puzzle-btn');
const imageLoader = document.getElementById('image-loader');
const cameraPlaceholder = document.getElementById('camera-placeholder');
const puzzlePlaceholder = document.getElementById('puzzle-placeholder');

// Modals
const victoryModal = document.getElementById('victory-modal');
const victoryTime = document.getElementById('victory-time');
const victoryGrid = document.getElementById('victory-grid');
const playAgainBtn = document.getElementById('modal-play-again');

// State variables
let mode = 'calibrate'; // 'calibrate' or 'playing'
let gridSize = 3;
let webcamActive = false;
let mediaStream = null;
let cameraHelper = null;

let handsTracker = null;
let handResults = null;

// Puzzle State
let originalImageCanvas = null; // Stored cropped frame
let tiles = [];                 // Array of puzzle tiles: { id: index, currentPos: index, canvas: Canvas }
let selectedTileIndex = null;   // Index in tiles array being dragged
let hoveredTileIndex = null;
let dragging = false;
let solved = false;
let shuffling = false;

// Interaction / Gestures
let prevPinch = false;
let isPinching = false;
let pinchX = 0, pinchY = 0; // normalized
let indexX = 0, indexY = 0; // normalized
let smoothIndexX = 0.5, smoothIndexY = 0.5;
let trailPoints = [];
const maxTrailLen = 15;

// Selection Crop Box coordinates (normalized 0-1 relative to webcam/canvas)
let cropBox = { x1: 0.2, y1: 0.15, x2: 0.8, y2: 0.85 };

// Timing
let startTime = null;
let timerInterval = null;

// Sound Effects Synthesizer using Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'click') {
    osc.frequency.setValueAtTime(600, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'grab') {
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.15);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'drop') {
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'snap') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'win') {
    // Play a sweet chord progression
    const freqs = [261.63, 329.63, 392.00, 523.25]; // C major
    freqs.forEach((f, idx) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.frequency.setValueAtTime(f, now + idx * 0.1);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.1, now + idx * 0.1 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.6);
      o.start(now + idx * 0.1);
      o.stop(now + idx * 0.1 + 0.6);
    });
  }
}

// Set up camera and overlay sizes
function resizeOverlays() {
  const rect = video.getBoundingClientRect();
  cameraOverlay.width = rect.width || 640;
  cameraOverlay.height = rect.height || 360;
  
  puzzleCanvas.width = puzzleCanvas.parentElement.clientWidth;
  puzzleCanvas.height = puzzleCanvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeOverlays);

// Initialize MediaPipe Hands
function initMediaPipe() {
  handsTracker = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  handsTracker.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  handsTracker.onResults(onHandResults);
}

// Start Camera Stream
async function startWebcam() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' }
    });
    video.srcObject = mediaStream;
    video.play();
    webcamActive = true;
    video.style.display = 'block'; // Make the live video feed visible

    cameraPlaceholder.style.display = 'none';
    trackingStatus.innerHTML = `<span class="status-dot green"></span><span class="status-text">Camera Active</span>`;
    toggleCameraBtn.innerHTML = `<i class="fa-solid fa-stop"></i> Stop Camera`;
    toggleCameraBtn.classList.replace('btn-primary', 'btn-secondary');

    // Wait until video metadata loads to resize overlay
    video.onloadedmetadata = () => {
      resizeOverlays();
      // Start processing loop using camera utils
      cameraHelper = new Camera(video, {
        onFrame: async () => {
          if (webcamActive) {
            await handsTracker.send({ image: video });
          }
        },
        width: 1280,
        height: 720
      });
      cameraHelper.start();
    };

  } catch (err) {
    console.error('Error opening camera: ', err);
    alert('Could not access the webcam. Please allow permission.');
  }
}

function stopWebcam() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }
  if (cameraHelper) {
    cameraHelper.stop();
  }
  webcamActive = false;
  video.style.display = 'none'; // Hide the video element when camera is stopped
  cameraPlaceholder.style.display = 'flex';
  trackingStatus.innerHTML = `<span class="status-dot red"></span><span class="status-text">Camera Inactive</span>`;
  toggleCameraBtn.innerHTML = `<i class="fa-solid fa-play"></i> Start Camera`;
  toggleCameraBtn.classList.replace('btn-secondary', 'btn-primary');
  
  // Clear overlays
  cameraCtx.clearRect(0, 0, cameraOverlay.width, cameraOverlay.height);
}

// MediaPipe Hand Detection Results callback
function onHandResults(results) {
  handResults = results;
  drawCameraOverlay();
  
  // Update state indicators based on tracking
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    processGestures(results);
  } else {
    isPinching = false;
  }
}

// Process Gestures & Tracking logic
function processGestures(results) {
  const width = cameraOverlay.width;
  const height = cameraOverlay.height;

  // 1. Two-hand box selection in calibration mode
  if (mode === 'calibrate') {
    if (results.multiHandLandmarks.length >= 2) {
      // Get index fingers (landmark 8)
      const h1 = results.multiHandLandmarks[0];
      const h2 = results.multiHandLandmarks[1];

      // Normalized coordinates
      const p1 = h1[8];
      const p2 = h2[8];

      cropBox.x1 = Math.min(p1.x, p2.x);
      cropBox.y1 = Math.min(p1.y, p2.y);
      cropBox.x2 = Math.max(p1.x, p2.x);
      cropBox.y2 = Math.max(p1.y, p2.y);

      // Require a minimum bounding box size
      if (Math.abs(cropBox.x2 - cropBox.x1) > 0.15 && Math.abs(cropBox.y2 - cropBox.y1) > 0.15) {
        actionPrompt.innerText = "Pinch index & thumb to SNAP image";
        actionPrompt.classList.add('visible');
      } else {
        actionPrompt.innerText = "Spread hands apart to frame puzzle";
        actionPrompt.classList.add('visible');
      }
    } else {
      actionPrompt.classList.remove('visible');
    }

    // Capture Snap action with Pinch gesture
    detectPinch(results);
    if (isPinching && !prevPinch) {
      if (results.multiHandLandmarks.length >= 2) {
        // Capture snapshot from webcam!
        capturePuzzleFromWebcam();
      }
    }
    prevPinch = isPinching;
  }

  // 2. Play mode: dragging and dropping puzzle pieces
  else if (mode === 'playing' && !shuffling && !solved) {
    detectPinch(results);
    
    // Get pointer coordinates (from the first tracked hand)
    const hand = results.multiHandLandmarks[0];
    indexX = hand[8].x;
    indexY = hand[8].y;

    // Pointer smoothing (alpha interpolation)
    const alpha = 0.25;
    smoothIndexX = alpha * indexX + (1 - alpha) * smoothIndexX;
    smoothIndexY = alpha * indexY + (1 - alpha) * smoothIndexY;

    // Add pointer trail
    trailPoints.push({ x: smoothIndexX * width, y: smoothIndexY * height });
    if (trailPoints.length > maxTrailLen) {
      trailPoints.shift();
    }

    // Convert pointer coordinate to local puzzle coordinates
    const local = getLocalPuzzleCoords(smoothIndexX, smoothIndexY);
    
    if (local) {
      const col = Math.floor(local.lx * gridSize);
      const row = Math.floor(local.ly * gridSize);
      hoveredTileIndex = row * gridSize + col;

      // Pinch Action (Grab / Drag start)
      if (isPinching && !prevPinch) {
        selectedTileIndex = hoveredTileIndex;
        dragging = true;
        playSound('grab');
      }
      
      // Release Action (Drop / Swap)
      if (!isPinching && prevPinch && dragging) {
        if (selectedTileIndex !== null && hoveredTileIndex !== null && selectedTileIndex !== hoveredTileIndex) {
          // Swap tiles
          swapTiles(selectedTileIndex, hoveredTileIndex);
          playSound('drop');
          checkSolved();
        }
        dragging = false;
        selectedTileIndex = null;
      }
    } else {
      hoveredTileIndex = null;
    }

    prevPinch = isPinching;
    drawPuzzle();
  }
}

// Check distance between index tip (8) and thumb tip (4) to identify pinch
let pinchActive = false;
function detectPinch(results) {
  let foundPinchHand = false;
  for (const hand of results.multiHandLandmarks) {
    const thumb = hand[4];
    const index = hand[8];
    const distance = Math.sqrt(Math.pow(index.x - thumb.x, 2) + Math.pow(index.y - thumb.y, 2));
    
    if (pinchActive) {
      if (distance < 0.06) {
        foundPinchHand = true;
        pinchX = index.x;
        pinchY = index.y;
        break;
      }
    } else {
      if (distance < 0.04) {
        foundPinchHand = true;
        pinchActive = true;
        pinchX = index.x;
        pinchY = index.y;
        break;
      }
    }
  }
  
  if (!foundPinchHand) {
    pinchActive = false;
  }
  isPinching = pinchActive;
}

// Convert global normalized camera space coordinates into local [0..1] crop box space
function getLocalPuzzleCoords(nx, ny) {
  const cX1 = cropBox.x1;
  const cY1 = cropBox.y1;
  const cX2 = cropBox.x2;
  const cY2 = cropBox.y2;

  // Clamp the normalized hand coordinates to be within the cropBox boundaries
  // This prevents accidental drag cancellation if the hand moves slightly outside the box.
  const clampedX = Math.max(cX1, Math.min(nx, cX2));
  const clampedY = Math.max(cY1, Math.min(ny, cY2));

  // Mirror only the computed local x coordinate so that moving the hand to the right
  // (which is smaller nx in mirrored feed) moves the puzzle cursor to the right.
  return {
    lx: 1 - (clampedX - cX1) / (cX2 - cX1),
    ly: (clampedY - cY1) / (cY2 - cY1)
  };
}

// Draw skeleton, nodes, crop frames on Webcam overlay
function drawCameraOverlay() {
  const width = cameraOverlay.width;
  const height = cameraOverlay.height;
  cameraCtx.clearRect(0, 0, width, height);

  // Draw crop selection frame
  if (mode === 'calibrate') {
    const x1 = cropBox.x1 * width;
    const y1 = cropBox.y1 * height;
    const x2 = cropBox.x2 * width;
    const y2 = cropBox.y2 * height;
    
    // Draw mirrored relative to mirrored display
    const viewX1 = (1 - cropBox.x2) * width;
    const viewX2 = (1 - cropBox.x1) * width;

    // Glowing crop box
    cameraCtx.shadowBlur = 15;
    cameraCtx.shadowColor = isPinching ? '#ff007f' : '#00f2fe';
    cameraCtx.strokeStyle = isPinching ? '#ff007f' : '#00f2fe';
    cameraCtx.lineWidth = 3;
    cameraCtx.strokeRect(viewX1, y1, viewX2 - viewX1, y2 - y1);
    
    // Reset shadow
    cameraCtx.shadowBlur = 0;

    // Title indicator
    cameraCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    cameraCtx.fillRect(viewX1, y1 - 30, 110, 30);
    cameraCtx.fillStyle = '#f3f4f6';
    cameraCtx.font = '14px Outfit';
    cameraCtx.fillText('CROP AREA', viewX1 + 10, y1 - 10);
  }

  // Draw hand landmarks (mirrored)
  if (handResults && handResults.multiHandLandmarks) {
    for (const landmarks of handResults.multiHandLandmarks) {
      // Draw connection lines
      cameraCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      cameraCtx.lineWidth = 2;
      
      // Hand connections mappings
      drawConnectionsMirrored(landmarks, HAND_CONNECTIONS, width, height);

      // Draw custom joints
      for (const lm of landmarks) {
        const cx = (1 - lm.x) * width;
        const cy = lm.y * height;
        cameraCtx.beginPath();
        cameraCtx.arc(cx, cy, 4, 0, 2 * Math.PI);
        cameraCtx.fillStyle = '#00f5a0';
        cameraCtx.fill();
      }
    }
  }

  // Draw pointer trail and finger pointer in playing mode
  if (mode === 'playing' && handResults && handResults.multiHandLandmarks && handResults.multiHandLandmarks.length > 0) {
    // Draw trail
    if (trailPoints.length > 1) {
      cameraCtx.beginPath();
      cameraCtx.moveTo(trailPoints[0].x, trailPoints[0].y);
      for (let i = 1; i < trailPoints.length; i++) {
        cameraCtx.lineTo(trailPoints[i].x, trailPoints[i].y);
      }
      cameraCtx.strokeStyle = 'rgba(0, 245, 160, 0.8)';
      cameraCtx.lineWidth = 4;
      cameraCtx.lineCap = 'round';
      cameraCtx.stroke();
    }

    // Draw glowing cursor
    const curX = (1 - smoothIndexX) * width;
    const curY = smoothIndexY * height;
    cameraCtx.shadowBlur = 20;
    cameraCtx.shadowColor = isPinching ? '#ff007f' : '#00f2fe';
    cameraCtx.fillStyle = isPinching ? '#ff007f' : '#f3f4f6';
    cameraCtx.beginPath();
    cameraCtx.arc(curX, curY, isPinching ? 8 : 10, 0, 2 * Math.PI);
    cameraCtx.fill();
    cameraCtx.shadowBlur = 0;
  }
}

// Draw connections with mirror adjustment
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [5, 9], [9, 10], [10, 11], [11, 12], // Middle
  [9, 13], [13, 14], [14, 15], [15, 16], // Ring
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17] // Pinky & Palm
];

function drawConnectionsMirrored(landmarks, connections, width, height) {
  for (const conn of connections) {
    const from = landmarks[conn[0]];
    const to = landmarks[conn[1]];
    cameraCtx.beginPath();
    cameraCtx.moveTo((1 - from.x) * width, from.y * height);
    cameraCtx.lineTo((1 - to.x) * width, to.y * height);
    cameraCtx.stroke();
  }
}

// Capture frame inside selection, crop it, and construct puzzle pieces
function capturePuzzleFromWebcam() {
  playSound('snap');
  
  // 1. Create a helper canvas to capture crop
  const captureCanvas = document.createElement('canvas');
  const capCtx = captureCanvas.getContext('2d');
  
  const w = video.videoWidth;
  const h = video.videoHeight;
  
  const cropW = (cropBox.x2 - cropBox.x1) * w;
  const cropH = (cropBox.y2 - cropBox.y1) * h;
  
  captureCanvas.width = cropW;
  captureCanvas.height = cropH;

  // Crop from mirrored coordinates as MediaPipe coordinates are normalized
  // Mirror cropBox.x1 and x2 relative to source
  const srcX = cropBox.x1 * w;
  const srcY = cropBox.y1 * h;
  
  capCtx.translate(cropW, 0);
  capCtx.scale(-1, 1); // Mirror captured slice so puzzle image is normally oriented
  capCtx.drawImage(video, srcX, srcY, cropW, cropH, 0, 0, cropW, cropH);
  capCtx.setTransform(1, 0, 0, 1, 0, 0); // reset
  
  initializePuzzle(captureCanvas);
}

// Initialize Puzzle system with a canvas image source
function initializePuzzle(imageSourceCanvas) {
  originalImageCanvas = imageSourceCanvas;
  puzzlePlaceholder.style.display = 'none';
  resetPuzzleBtn.removeAttribute('disabled');
  
  mode = 'playing';
  solved = false;
  shuffling = true;
  startTime = null;
  gameTimer.innerText = '00:00.00';

  const w = originalImageCanvas.width;
  const h = originalImageCanvas.height;
  const tileW = w / gridSize;
  const tileH = h / gridSize;

  tiles = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const idx = r * gridSize + c;
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = tileW;
      tileCanvas.height = tileH;
      const tCtx = tileCanvas.getContext('2d');
      tCtx.drawImage(originalImageCanvas, c * tileW, r * tileH, tileW, tileH, 0, 0, tileW, tileH);

      tiles.push({
        id: idx,
        currentPos: idx,
        canvas: tileCanvas
      });
    }
  }

  // Shuffle process with visual frames
  shufflePuzzle();
}

// Animated shuffling simulation
function shufflePuzzle() {
  let swaps = 0;
  const maxSwaps = 12;
  const interval = setInterval(() => {
    const i = Math.floor(Math.random() * tiles.length);
    const j = Math.floor(Math.random() * tiles.length);
    if (i !== j) {
      const temp = tiles[i].currentPos;
      tiles[i].currentPos = tiles[j].currentPos;
      tiles[j].currentPos = temp;
      playSound('click');
    }
    drawPuzzle();
    swaps++;
    if (swaps >= maxSwaps) {
      clearInterval(interval);
      shuffling = false;
      startTime = Date.now();
      startTimer();
    }
  }, 120);
}

// Swaps current positions of tiles
function swapTiles(i, j) {
  // Find tiles matching those current slot positions
  const t1 = tiles.find(t => t.currentPos === i);
  const t2 = tiles.find(t => t.currentPos === j);
  if (t1 && t2) {
    const temp = t1.currentPos;
    t1.currentPos = t2.currentPos;
    t2.currentPos = temp;
  }
}

// Render dynamic sliding tiles on the Canvas
function drawPuzzle() {
  if (!originalImageCanvas || tiles.length === 0) return;

  const w = puzzleCanvas.width;
  const height = puzzleCanvas.height;
  puzzleCtx.clearRect(0, 0, w, height);

  const tileW = w / gridSize;
  const tileH = height / gridSize;

  let draggedTile = null;

  // Draw grid background tiles
  tiles.forEach((tile) => {
    // Determine row/col of current positions
    const r = Math.floor(tile.currentPos / gridSize);
    const c = tile.currentPos % gridSize;

    const dx = c * tileW;
    const dy = r * tileH;

    if (dragging && selectedTileIndex === tile.currentPos) {
      // Keep track of the dragged tile to draw it on top later
      draggedTile = { tile, dx, dy };
      
      // Draw a darkened placeholder slot where it was grabbed
      puzzleCtx.fillStyle = 'rgba(13, 14, 21, 0.7)';
      puzzleCtx.fillRect(dx, dy, tileW, tileH);
      puzzleCtx.strokeStyle = '#ff007f';
      puzzleCtx.lineWidth = 2;
      puzzleCtx.strokeRect(dx + 2, dy + 2, tileW - 4, tileH - 4);
    } else {
      // Draw the image tile normally
      puzzleCtx.drawImage(tile.canvas, dx, dy, tileW, tileH);

      // Glowing border for hovered tile
      if (hoveredTileIndex === tile.currentPos) {
        puzzleCtx.strokeStyle = '#00f2fe';
        puzzleCtx.lineWidth = 3;
        puzzleCtx.strokeRect(dx + 1, dy + 1, tileW - 2, tileH - 2);
      } else {
        puzzleCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        puzzleCtx.lineWidth = 1;
        puzzleCtx.strokeRect(dx, dy, tileW, tileH);
      }
    }
  });

  // Draw the dragged tile following the cursor on top of everything
  if (dragging && draggedTile) {
    const local = getLocalPuzzleCoords(smoothIndexX, smoothIndexY);
    if (local) {
      const curPx = local.lx * w;
      const curPy = local.ly * height;

      puzzleCtx.save();
      puzzleCtx.globalAlpha = 0.8;
      // Shadow under the dragged piece to make it look floating
      puzzleCtx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      puzzleCtx.shadowBlur = 15;
      
      // Draw centered on cursor
      puzzleCtx.drawImage(
        draggedTile.tile.canvas, 
        curPx - tileW / 2, 
        curPy - tileH / 2, 
        tileW, 
        tileH
      );
      
      // Neon border around the floating tile
      puzzleCtx.strokeStyle = '#ff007f';
      puzzleCtx.lineWidth = 3;
      puzzleCtx.strokeRect(curPx - tileW / 2, curPy - tileH / 2, tileW, tileH);
      
      puzzleCtx.restore();
    }
  }
}

// Check victory condition
function checkSolved() {
  const isWin = tiles.every(tile => tile.id === tile.currentPos);
  if (isWin) {
    solved = true;
    clearInterval(timerInterval);
    playSound('win');
    
    // Confetti!
    triggerConfetti();

    // Show modal
    setTimeout(() => {
      victoryTime.innerText = gameTimer.innerText;
      victoryGrid.innerText = `${gridSize}x3${gridSize === 3 ? '' : gridSize === 4 ? '4x4' : '5x5'}`;
      victoryModal.classList.add('active');
    }, 800);
  }
}

// Confetti blast
function triggerConfetti() {
  const duration = 3 * 1000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#00f2fe', '#00f5a0', '#ff007f']
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#00f2fe', '#00f5a0', '#ff007f']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

// Game Timer Loop
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!startTime) return;
    const elapsed = Date.now() - startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const centiseconds = Math.floor((elapsed % 1000) / 10);
    
    const displayStr = 
      (minutes < 10 ? '0' + minutes : minutes) + ':' +
      (seconds < 10 ? '0' + seconds : seconds) + '.' +
      (centiseconds < 10 ? '0' + centiseconds : centiseconds);
      
    gameTimer.innerText = displayStr;
  }, 33);
}

// Setup Custom Image upload as fallback
imageLoader.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      // Resize to nice 16:9 box
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 640;
      tempCanvas.height = 360;
      const tCtx = tempCanvas.getContext('2d');
      tCtx.drawImage(img, 0, 0, 640, 360);
      
      // Load puzzle with this canvas
      initializePuzzle(tempCanvas);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

// Grid Size buttons
document.querySelectorAll('.difficulty-selector button').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.difficulty-selector button').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    gridSize = parseInt(e.target.dataset.grid);
    playSound('click');
    if (originalImageCanvas) {
      initializePuzzle(originalImageCanvas);
    }
  });
});

// App Control Buttons
toggleCameraBtn.addEventListener('click', () => {
  playSound('click');
  if (webcamActive) {
    stopWebcam();
  } else {
    startWebcam();
  }
});

resetPuzzleBtn.addEventListener('click', () => {
  playSound('click');
  mode = 'calibrate';
  tiles = [];
  originalImageCanvas = null;
  selectedTileIndex = null;
  hoveredTileIndex = null;
  dragging = false;
  solved = false;
  clearInterval(timerInterval);
  gameTimer.innerText = '00:00.00';
  puzzleCtx.clearRect(0, 0, puzzleCanvas.width, puzzleCanvas.height);
  puzzlePlaceholder.style.display = 'flex';
  resetPuzzleBtn.setAttribute('disabled', 'true');
  victoryModal.classList.remove('active');
});

playAgainBtn.addEventListener('click', () => {
  playSound('click');
  victoryModal.classList.remove('active');
  resetPuzzleBtn.click();
});

// Main init calls
initMediaPipe();
resizeOverlays();
