# Marble Maze

A browser-based 3D labyrinth game built with Three.js. Tilt the board with your mouse to roll a marble through a randomly generated maze, adapted from an original C++ OpenGL project and running entirely client-side.

> [!NOTE]
> Marble Maze is a static web app: there is no backend, database, or build pipeline. You can host it on any static file server.

## Features

- 3D maze rendered with Three.js
- Randomly generated maze layout on each load
- Mouse-based board tilt controlling the marble
- Keyboard debug controls for fine-grained movement
- Two camera modes: top-down overview and follow-camera
- Toggleable lighting: focused spotlight vs more ambient light
- Objective + timer HUD that teaches players to reach the red goal, tracks run time, and freezes with a celebratory win popup + confetti when you finish

## Getting Started

### Prerequisites

You only need a modern web browser. For local development, a simple HTTP server is recommended to avoid CORS issues.

### Run locally

From the `web` folder of this repo:

```pwsh
# Option 1: Python HTTP server
cd "d:/dev/!archive/open-gl-labirynth/web"
python -m http.server 8000

# Then open in your browser
# http://localhost:8000/index.html
```

Or, if you use VS Code, you can use the Live Server extension and choose "Open with Live Server" on `index.html`.

No `npm install` or other dependency setup is required: Three.js is loaded from a CDN via an import map in `index.html`.

## How It Works

The project is intentionally minimal and build-less:

- `index.html` creates the page, displays the controls overlay, configures the import map for `three`, and loads `main.js` as an ES module.
- `main.js`:
  - Initializes the Three.js scene, camera, renderer, lighting, and a tiltable board group.
  - Builds the maze geometry from a 2D `walls` grid.
  - Handles physics, collision detection, and input.
  - Tracks timer state, updates the on-screen HUD copy, and triggers the win animation/confetti once the ball reaches the red goal tile.
  - Runs the main animation loop (`animate`) with `requestAnimationFrame`.
- `mazeGenerator.js` implements a randomized depth-first search (DFS) maze generator that fills the `walls` grid with walls, floor, start, and end tiles.
- `assets/` contains bitmap textures for walls, floor, and start/stop tiles.

### Controls

Overlayed in the bottom-left of the screen and implemented in `main.js`:

- Mouse move: tilt the board (clamped to ±45° on each axis)
- `C`: toggle camera view (overview / follow)
- `P`: pause/resume physics
- `R`: reset ball to the start tile and clear velocity
- `N`: generate a new random maze and reset the ball
- `+` / `=`: increase maze size (up to 11), rebuild maze, reset ball
- `-` / `_`: decrease maze size (down to 2), rebuild maze, reset ball
- After you reach the glowing red goal tile, the timer stops and the overlay reminds you: `R` to retry, `N` for a fresh maze, or `+/-` to change the maze size.
- `L`: toggle lighting mode (spotlight vs ambient)
- `W/A/S/D`: nudge the ball in the horizontal plane (debug)
- `Q/E`: move the ball up/down (debug)

## Development Notes

- The game uses custom Euler integration for physics; there is no external physics engine.
- Collisions are grid-based, resolving separately on X and Z axes to avoid tunneling.
- The ball’s bounce off walls is damped so it loses speed on impact.
- Three.js is imported as `import * as THREE from "three";` and resolved via the import map in `index.html`.
- If you refactor, keep `main.js` as the central place for game state and rendering unless you deliberately modularize.

> [!TIP]
> For contributors and AI coding agents, see `AGENTS.md` for deeper technical context, conventions, and debugging tips.

## Testing

There is no automated test suite. Use manual testing in the browser:

- Verify the maze renders and the marble is visible.
- Move the mouse and confirm the board tilts and the ball rolls.
- Check that the marble collides with walls instead of passing through.
- Toggle camera (`C`) and lighting (`L`) and ensure both modes work.
- Reach the red goal tile and confirm the timer freezes, the win popup/confetti appear, and the overlay updates with the R/N/+/- instructions.
- Reload several times to confirm that the maze layout changes and always has a valid path from start to finish.

## Deployment

Because it is a static site, you can deploy Marble Maze by serving the project files as-is:

- GitHub Pages, Netlify, Vercel, static S3/Blob hosting, or any simple web server work fine.
- Ensure `index.html` is served as the default document.
- The Three.js dependency is fetched from jsDelivr; make sure outbound HTTPS access to the CDN is allowed in your environment.
