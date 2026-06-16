# AeroPuzzle

A real-time, computer vision-based interactive puzzle game. Create and solve puzzles using **air gestures** — no mouse or touch input required.

AeroPuzzle offers two ways to play:

1. **Web-Based Browser Experience** — A glassmorphic web application with in-browser MediaPipe hand tracking, Web Audio feedback, custom image uploading, and a win celebration.
2. **Desktop Python Experience** — A standalone desktop app with a glassy HUD overlay, smoothed gesture trails, and automatic completion detection.

---

## Key Features

### Web Version (Zero Install)
- **Glassmorphic UI** — Dark-mode styling with neon glows and custom hover states.
- **Sound Synthesis** — Audio cues generated via the browser's native Web Audio API for snapshots, grabs, swaps, and victory.
- **Confetti Celebration** — Triggers a confetti burst when the puzzle is solved.
- **Custom Image Upload** — Play with a webcam snapshot or upload any photo of your choice.

### Desktop Python Version
- **Anti-Aliased Typography** — Clean text rendering using Pillow (PIL) instead of standard OpenCV fonts.
- **Glassmorphic HUD Overlay** — Alpha-blended header and victory card panels.
- **Hysteresis Gesture Filtering** — Dual-threshold filtering to eliminate pinch gesture stuttering.
- **Auto-Termination** — Closes automatically after displaying the final score for 5 seconds.

---

## Tech Stack

| Layer   | Technologies |
|---------|-------------|
| Web     | HTML5, CSS3 (Glassmorphism), JavaScript (ES6), `@mediapipe/hands`, `canvas-confetti` |
| Desktop | Python, OpenCV, MediaPipe (Tasks-Vision API), Pillow, NumPy |

---

## Getting Started

### Play in the Browser

Open `index.html` directly in any modern browser:

```bash
start index.html
```

No installation or server required.

### Play the Desktop Version

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Run the app:

   ```bash
   python app.py
   ```

---

## How to Play

1. **Webcam Active** — Allow camera access when prompted.
2. **Calibrate Crop** — Spread the index fingers of both hands to position the green calibration window over your desired region.
3. **Capture Snapshot** — Pinch your index finger and thumb together to take the photo.
4. **Solve the Puzzle**:
   - Move your hand to control the cursor.
   - Pinch to grab a tile.
   - Drag it to a new position.
   - Release the pinch to swap tiles.

---

## Requirements

```
opencv-python
mediapipe
numpy
pillow
```

---

## License

This project is open source. See the repository for details.