# AeroPuzzle

A real-time, computer vision-based interactive puzzle game. Create and solve puzzles using **air gestures** — no mouse or touch input required.

AeroPuzzle runs as a standalone desktop application with a glassy HUD overlay, smoothed gesture trails, and automatic completion detection.

---

## Key Features

- **Interactive HUD Overlay** — Sleek header and victory card panels drawn dynamically.
- **Hysteresis Gesture Filtering** — Dual-threshold filtering to eliminate pinch gesture stuttering.
- **Hand Tracking** — Uses MediaPipe Hand Landmarker for real-time tracking of hand gestures.
- **Auto-Termination** — Closes automatically after displaying the final score for 5 seconds upon solving.

---

## Tech Stack

- **Language**: Python 3.x
- **Computer Vision**: OpenCV (image processing, webcam access, and GUI display)
- **Hand Tracking**: MediaPipe (Tasks-Vision API)
- **Image Editing & Typography**: Pillow (PIL), NumPy

---

## Getting Started

1. Clone or navigate to the repository directory.
2. Install the required Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Run the application:

   ```bash
   python app.py
   ```

---

## How to Play

1. **Webcam Active** — Ensure your webcam is connected and allowed.
2. **Calibrate Crop** — Position both hands in front of the camera and spread your index fingers to define the calibration crop window.
3. **Capture Snapshot** — Pinch your index finger and thumb together to capture the snapshot and start the puzzle.
4. **Solve the Puzzle**:
   - Move your hand to control the pointer cursor.
   - Pinch to grab a tile.
   - Drag the tile to its correct position.
   - Release the pinch to swap it with another tile.
5. **Win** — Solve the puzzle to see your final score. The application automatically closes 5 seconds after solving.