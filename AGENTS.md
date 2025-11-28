# AGENTS.md

## Project Overview

Marble Maze is a browser-based port of a legacy C++ OpenGL labyrinth game. The maze is rendered in 3D using Three.js, and the player guides a ball through a randomly generated maze by tilting the board with the mouse (plus optional keyboard debug controls). The app is entirely client-side: there is no build pipeline, backend, or package manager.

Key technologies:
- Plain `index.html` + inline CSS
- Vanilla JavaScript (`main.js`, `mazeGenerator.js`)
- Three.js (imported from a CDN via an import map)

High-level architecture:
- `index.html` bootstraps the page, overlays instructions UI, configures the import map for `three`, and loads `main.js` as an ES module.
- `main.js` is a monolithic game module: Three.js scene/camera/renderer setup, maze geometry construction from a grid, physics and collision, input handling, lighting, HUD/timer management, and the main animation loop.
- `mazeGenerator.js` contains a randomized depth-first-search maze generator that directly populates a 2D `walls` grid.
- `assets/` hosts bitmap textures used for walls, floor, and start/stop tiles.

## Setup Commands

This project is intentionally build-less and dependency-free beyond the Three.js CDN import.

Recommended ways to run locally (Windows PowerShell):

- Using VS Code Live Server (preferred for CORS-friendly file loading):
  1. Install the Live Server extension in VS Code.
  2. Open this folder and run `index.html` via "Open with Live Server".

- Using a simple Python HTTP server from this directory:

```pwsh
cd "d:/dev/!archive/open-gl-labirynth/web"
python -m http.server 8000
```

Then open `http://localhost:8000/index.html` in a modern browser.

There is no `npm`, `pnpm`, or `yarn` usage here, and no `package.json`.

## Development Workflow

- Entry point: open `index.html` in a browser (ideally via a local server as above).
- Three.js is imported from a CDN using an import map defined in `index.html`:
  - Path is currently `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`.
  - If you change the Three.js version, update this URL accordingly.
- `main.js` is loaded as a module (`type="module"`) and imports:
  - `three` from the import map.
  - `generateMaze` from `./mazeGenerator.js`.
- Game loop:
  - `animate()` calls `updatePhysics()` and `updateCamera()` then renders via `renderer.render(scene, camera)` using `requestAnimationFrame`.
- HUD and messaging:
  - `index.html` defines `#objectiveText`, `#timerDisplay`, and `#winMessage`. `main.js` updates them through helpers like `setObjectiveMessage()`, `updateTimerUI()`, `showWinMessage()`, and `hideWinMessage()`.
  - `startRun()` centralizes maze rebuilds + ball resets + timer restarts. Prefer calling this helper (optionally with `{ rebuildMaze: true }`) instead of orchestrating `buildMaze()`/`resetBallState()` manually.
  - `launchConfetti()` spawns temporary `.confetti-piece` elements; keep CSS in sync with any animation adjustments.
- Input and controls (see also the instructions overlay in `index.html`):
  - Mouse move: update `tiltAngleX` and `tiltAngleZ` (clamped to ±45°) to tilt the board.
  - Keyboard (debug + modes):
    - `W/A/S/D`: nudge ball in Z/X directions.
    - `Q/E`: adjust ball Y (vertical) for debugging.
    - `C`: switch between overview and follow camera.
    - `P`: pause/resume physics.
    - `R`: call `startRun()` to reset the current layout, timer, and overlay copy.
    - `L`: toggle between spotlight-focused and more ambient lighting.
    - `N`: call `startRun({ rebuildMaze: true })` to regenerate a new random maze.
    - `+` / `-`: adjust `mazeDimension` (bounded by 2–11), rebuild the maze, then restart via `startRun()`.
  - When the ball reaches the red goal tile, `checkWinCondition()` stops the timer, updates the objective text to advertise `R`/`N`/`+/-`, shows the centered win popup, and fires confetti.

When editing code:
- Keep `main.js` as the central place for game state and rendering unless there is a deliberate refactor.
- Physics and collision are tightly coupled to the grid representation; prefer minimal, localized changes.

## Testing Instructions

There is no formal automated test setup (no Jest/Vitest, etc.). Testing is manual via the browser:

- Basic smoke test:
  - Load `index.html`.
  - Confirm that the maze appears, the ball is visible, and moving the mouse tilts the board.
  - Verify that the ball rolls in response to tilt and collides with walls.

- Regression checks after changes:
  - Start and end tiles are correctly textured (start/stop bitmaps).
  - Camera toggle (`C`) switches correctly between top-down and follow views.
  - Lighting toggle (`L`) switches between spotlight + dark background vs more ambient lighting.
  - Timer HUD increments during play, freezes upon reaching the red tile, and the win popup/confetti plus R/N/+/- instructions appear.
  - Maze generation always produces a valid path from start to end (try reloading multiple times).

If you add tests in the future, document their commands and locations in this section.

## Code Style Guidelines

### Languages and modules

- JavaScript modules only; no bundler assumed.
- Three.js is imported via `import * as THREE from "three";` (respect the import map).
- Internal code modules:
  - `main.js` imports `generateMaze` from `./mazeGenerator.js`.

### Naming and conventions

- Use descriptive English camelCase variable and function names.
- Grid/maze-related naming:
  - `MAZE_DIMENSION`: half-size of the maze; total size is `2 * MAZE_DIMENSION + 1`.
  - `GRID_WIDTH`, `GRID_HEIGHT`: derived dimensions of the grid.
  - `walls`: 2D integer array holding maze topology: `1` = wall, `0` = floor, `-1` = start, `-2` = end.
- Physics and state:
  - `ballX`, `ballY`, `ballZ`: ball coordinates in world space (Y is vertical).
  - `velocityX`, `velocityZ`, `accelerationX`, `accelerationZ`: planar motion state.
  - `tiltAngleX`, `tiltAngleZ`: board tilt angles in degrees.
- HUD state lives in `hasWon`, `timerActive`, `levelStartTime`, `latestElapsedSeconds`, and `goalTileX/Z`. Keep these synchronized with DOM updates when altering flow.
- Coordinate system:
  - Y-axis is up.
  - X/Z plane is horizontal.
  - Note: `ballZ` is sometimes stored with an inverted sign relative to Three.js world Z; be careful when converting to grid indices.

### Physics and collision

- Physics is custom Euler integration; do not swap in an external physics engine unless explicitly requested (to preserve the original game feel).
- Acceleration is computed from tilt:
  - Roughly `0.01 * Math.sin(angleInRadians)` per axis.
- Collision is grid-based:
  - Helper functions like `worldToTileX`/`worldToTileZ` map world coordinates to `walls` indices.
  - Axis-separated resolution via `collideAxisX` and `collideAxisZ` prevents ball tunneling and handles bounce.
  - On collision, the relevant velocity component is inverted and damped by a factor (currently `* -0.7`).

### File organization

- Keep textures in `assets/` and reference them by relative path from `main.js`.
- Avoid introducing a build step unless the project is explicitly being restructured.
- If you need additional modules (e.g., for refactoring `main.js`):
  - Use ES modules in the same folder.
  - Import them explicitly from `main.js`.

## Build and Deployment

- Build step: none. The shipped artifacts are the raw `index.html`, JS modules, and assets.
- Output: the repo contents themselves; no `dist` directory.
- Environment:
  - Any modern browser with ES module and import map support.
  - Internet access to fetch Three.js from jsDelivr (unless you change to a local copy).

Deployment examples:
- Static hosting (e.g., GitHub Pages, Netlify, S3):
  - Upload the entire folder contents.
  - Ensure `index.html` is used as the default document.
- If hosting behind a path prefix, asset URLs (`assets/...`) and module paths (`./mazeGenerator.js`) should keep working as they are relative, but verify that Three.js CDN is reachable.

There is no CI/CD config in this repo; if you add one, document key jobs and checks here.

## Security Considerations

- No backend, no authentication, and no persistent state; this is a static client-side game.
- No secrets or API keys should be added to this project.
- If you later integrate external services (analytics, telemetry, etc.), keep keys in environment-specific config that is not committed, and update this section accordingly.

## Debugging and Troubleshooting

Common issues and how to investigate:

- **Blank page or script errors**:
  - Open browser devtools (Console tab) to look for module import or CORS errors.
  - Verify the import map URL for Three.js and that `main.js`/`mazeGenerator.js` paths are correct.
- **Textures not loading**:
  - Confirm `assets/chess.bmp`, `assets/start.bmp`, and `assets/stop.bmp` exist and are reachable.
  - Check that the server is serving `.bmp` files correctly.
- **Maze or ball not visible**:
  - Ensure the camera aspect and size are updated on resize.
  - Inspect light mode: toggle `L` to see if the scene becomes visible.
- **Physics feels wrong after changes**:
  - Check `updatePhysics()` for modifications to acceleration computation or velocity clamping.
  - Verify collision helpers still map world coordinates to the correct `walls` indices.

For deeper debugging:
- Use `console.log` around `generateMaze`, collision helpers, and the camera update to inspect indices and positions.
- Temporarily add `AxesHelper`/`GridHelper` or other Three.js helpers to visualize orientation and scale.

## Notes for Future Agents

- Preserve the DFS maze generation algorithm in `mazeGenerator.js` when refactoring; it is a direct conceptual port of the C++ original.
- When changing the coordinate transforms or grid mapping, always validate start/end tile positions and wall alignment visually.
- If you introduce new tooling (TypeScript, bundler, tests), extend this `AGENTS.md` with the relevant commands and conventions so subsequent agents have a single source of truth.
