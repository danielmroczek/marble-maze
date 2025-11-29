import * as THREE from "three";
import { generateMaze } from "./mazeGenerator.js";

// Constants
const MIN_MAZE_DIMENSION = 2;
const MAX_MAZE_DIMENSION = 11;
let mazeDimension = 7; // Maze half-size (grid is 2*mazeDimension + 1)
let gridWidth = mazeDimension * 2 + 1;
let gridHeight = mazeDimension * 2 + 1;
// Start position aligned to center of tile (1,1) to avoid half-tile offset
let startX = 2 * 1 - gridWidth;
let startZ = -(2 * 1 - gridHeight);
const BALL_RADIUS = 0.4;
const EPSILON = 0.001;
const BOUNCE_DAMPING = -0.2; // invert direction and resume at half the impact speed

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a); // glClearColor(0.1, 0.1, 0.1, 1)

// Camera setup - default overview mode
const camera = new THREE.PerspectiveCamera(
  60, // FOV (matches gluPerspective(60, ...))
  window.innerWidth / window.innerHeight,
  10, // Near plane
  75 // Far plane
);

camera.position.set(0, 45, 0.01);
camera.lookAt(0, 0, 0);
camera.up.set(0, 1, 0);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// HUD references
const timerDisplay = document.getElementById("timerDisplay");
const objectiveTextEl = document.getElementById("objectiveText");
const winMessageEl = document.getElementById("winMessage");
const instructionsPanel = document.getElementById("instructions");
const mobileControlsEl = document.getElementById("mobileControls");
const mobileCameraBtn = document.getElementById("mobileCameraBtn");
const mobileLightingBtn = document.getElementById("mobileLightingBtn");
const mobileResetBtn = document.getElementById("mobileResetBtn");
const mobileNewLevelBtn = document.getElementById("mobileNewLevelBtn");

const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
const platform = typeof navigator !== "undefined" ? navigator.platform : "";
const maxTouchPoints =
  typeof navigator !== "undefined" ? navigator.maxTouchPoints || 0 : 0;
const isIOS13IPad = platform === "MacIntel" && maxTouchPoints > 1;
const isMobile =
  /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(userAgent) ||
  isIOS13IPad;

const DESKTOP_OBJECTIVE =
  "Objective: Roll the ball onto the glowing red goal tile!";
const MOBILE_PENDING_OBJECTIVE =
  "Tap once to enable motion controls, then tilt your phone toward the glowing red goal tile.";
const MOBILE_ACTIVE_OBJECTIVE =
  "Tilt your phone gently to roll the ball onto the glowing red goal tile!";
const MOBILE_BLOCKED_OBJECTIVE =
  "Motion controls are unavailable. Use the buttons below to load a new maze or adjust the view.";

let mobileMotionState = isMobile ? "pending" : "inactive";
let mobileOrientationListenerAttached = false;

function setObjectiveMessage(message) {
  if (objectiveTextEl) {
    objectiveTextEl.textContent = message;
  }
}

function showWinMessage(finalTimeSeconds) {
  if (!winMessageEl) return;
  winMessageEl.innerHTML = `Level Cleared!<br>Final time: ${finalTimeSeconds.toFixed(
    2
  )}s<br><small>${
    isMobile
      ? "Use the buttons below to toggle the camera, lighting, or load a new maze."
      : "R = reset · N = new level · +/- = resize"
  }</small>`;
  winMessageEl.classList.add("visible");
}

function hideWinMessage() {
  if (!winMessageEl) return;
  winMessageEl.classList.remove("visible");
  winMessageEl.textContent = "";
}

function launchConfetti() {
  const colors = ["#ff6b6b", "#feca57", "#54a0ff", "#1dd1a1", "#f368e0"];
  const totalPieces = 24;
  for (let i = 0; i < totalPieces; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.top = `${Math.random() * 20}vh`;
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    document.body.appendChild(piece);
    piece.addEventListener("animationend", () => piece.remove());
  }
}

function getDefaultObjectiveCopy() {
  if (!isMobile) {
    return DESKTOP_OBJECTIVE;
  }
  if (mobileMotionState === "granted") {
    return MOBILE_ACTIVE_OBJECTIVE;
  }
  if (mobileMotionState === "blocked") {
    return MOBILE_BLOCKED_OBJECTIVE;
  }
  return MOBILE_PENDING_OBJECTIVE;
}

function initializeMobileExperience() {
  if (!isMobile) {
    return;
  }
  document.body.classList.add("is-mobile");
  if (instructionsPanel) {
    instructionsPanel.setAttribute("aria-hidden", "true");
  }
  configureMobileButtons();
  prepareMobileOrientation();
}

function configureMobileButtons() {
  if (!mobileControlsEl) {
    return;
  }
  mobileControlsEl.setAttribute("aria-hidden", "false");
  mobileCameraBtn?.addEventListener("click", cycleCameraMode);
  mobileLightingBtn?.addEventListener("click", toggleLightingMode);
  mobileResetBtn?.addEventListener("click", () => startRun());
  mobileNewLevelBtn?.addEventListener("click", () =>
    startRun({ rebuildMaze: true })
  );
}

function prepareMobileOrientation() {
  if (!isMobile) {
    return;
  }
  if (typeof window.DeviceOrientationEvent === "undefined") {
    mobileMotionState = "blocked";
    setObjectiveMessage(getDefaultObjectiveCopy());
    return;
  }

  const needsPermission =
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function";

  if (!needsPermission) {
    requestDeviceOrientationAccess();
    return;
  }

  const requestPermission = () => {
    requestDeviceOrientationAccess();
  };

  window.addEventListener("touchend", requestPermission, {
    once: true,
    passive: true,
  });
  window.addEventListener("click", requestPermission, { once: true });
  setObjectiveMessage(getDefaultObjectiveCopy());
}

function requestDeviceOrientationAccess() {
  if (mobileOrientationListenerAttached) {
    return;
  }
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    DeviceOrientationEvent.requestPermission()
      .then((state) => {
        if (state === "granted") {
          attachDeviceOrientationListener();
          mobileMotionState = "granted";
          setObjectiveMessage(getDefaultObjectiveCopy());
        } else {
          mobileMotionState = "blocked";
          setObjectiveMessage(getDefaultObjectiveCopy());
        }
      })
      .catch(() => {
        mobileMotionState = "blocked";
        setObjectiveMessage(getDefaultObjectiveCopy());
      });
  } else {
    attachDeviceOrientationListener();
    mobileMotionState = "granted";
    setObjectiveMessage(getDefaultObjectiveCopy());
  }
}

function attachDeviceOrientationListener() {
  if (mobileOrientationListenerAttached) {
    return;
  }
  window.addEventListener("deviceorientation", handleDeviceOrientation);
  mobileOrientationListenerAttached = true;
}

function handleDeviceOrientation(event) {
  const gamma = clampTilt(event.gamma ?? 0); // left/right
  const beta = clampTilt(event.beta ?? 0); // front/back
  tiltAngleX = gamma;
  tiltAngleZ = beta;
}

function clampTilt(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-45, Math.min(value, 45));
}

initializeMobileExperience();

// State variables
let ballX = startX,
  ballZ = startZ,
  ballY = 0; // Ball position
let velocityX = 0,
  velocityZ = 0; // Velocity
let accelerationX = 0,
  accelerationZ = 0; // Acceleration
let tiltAngleX = 0,
  tiltAngleZ = 0; // Board tilt angles
let paused = false;
let cameraMode = 0; // 0 = overview, 1 = follow
const cameraModesCount = 2;
let lightMode = true; // true = spotlight mode, false = ambient mode
let hasWon = false;
let timerActive = false;
let levelStartTime = performance.now();
let latestElapsedSeconds = 0;

// Maze grid (will be generated)
// 1 = wall, 0 = empty, -1 = start, -2 = end
let walls = Array(gridHeight)
  .fill(null)
  .map(() => Array(gridWidth).fill(1));
let goalTileX = 0;
let goalTileZ = 0;

// Lighting setup
const AMBIENT_INTENSITY_SPOTLIGHT_MODE = 0.0;
const AMBIENT_INTENSITY_AMBIENT_MODE = 0.5;
const ambientLight = new THREE.AmbientLight(
  0xffffff,
  AMBIENT_INTENSITY_SPOTLIGHT_MODE
);
scene.add(ambientLight);

// Spotlight tuning constants (raise height & widen cone)
const SPOTLIGHT_HEIGHT_OFFSET = 30; // was 10 (2x higher)
const SPOTLIGHT_ANGLE_DEG = 7; // was 15 (wider beam to avoid narrow cone at high tilt)
const SPOTLIGHT_INTENSITY_FOCUSED = 512.0; // intensity when in spotlight mode

// Spotlight that follows the ball
const spotlight = new THREE.SpotLight(0xffffff, SPOTLIGHT_INTENSITY_FOCUSED);
spotlight.position.set(ballX, BALL_RADIUS + SPOTLIGHT_HEIGHT_OFFSET, -ballZ);
spotlight.angle = (SPOTLIGHT_ANGLE_DEG * Math.PI) / 180; // widened cutoff
spotlight.penumbra = 0.8; // softer edges due to higher elevation
spotlight.decay = 2;
spotlight.castShadow = true;
spotlight.target.position.set(ballX, 0, -ballZ);
scene.add(spotlight);
scene.add(spotlight.target);

// Create a tiltable board group
const boardGroup = new THREE.Group();
scene.add(boardGroup);

// Ball
const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 20, 20);
const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const ball = new THREE.Mesh(ballGeometry, ballMaterial);
ball.position.set(ballX, BALL_RADIUS + ballY, -ballZ);
ball.castShadow = true;
boardGroup.add(ball);

// Texture loader
const textureLoader = new THREE.TextureLoader();
const chessTexture = textureLoader.load("assets/chess.bmp");
const startTexture = textureLoader.load("assets/start.bmp");
const stopTexture = textureLoader.load("assets/stop.bmp");

// Set texture wrapping and filtering
[chessTexture, startTexture, stopTexture].forEach((tex) => {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
});

// Materials
const wallMaterial = new THREE.MeshStandardMaterial({
  map: chessTexture,
  color: 0x000080, // Blue tint like the C++ version
});
const floorMaterial = new THREE.MeshStandardMaterial({ map: chessTexture });
const startMaterial = new THREE.MeshStandardMaterial({ map: startTexture });
const stopMaterial = new THREE.MeshStandardMaterial({ map: stopTexture });

// Function to create a textured cube (wall)
function createCube(x, y, z) {
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const cube = new THREE.Mesh(geometry, wallMaterial);
  cube.position.set(x, y + 1, z);
  cube.receiveShadow = true;
  cube.castShadow = true;
  return cube;
}

// Function to create a floor tile
function createFloor(x, y, z, material = floorMaterial) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const floor = new THREE.Mesh(geometry, material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x, y, z);
  floor.receiveShadow = true;
  return floor;
}

function rebuildGridForCurrentDimension() {
  gridWidth = mazeDimension * 2 + 1;
  gridHeight = mazeDimension * 2 + 1;
  startX = 2 * 1 - gridWidth;
  startZ = -(2 * 1 - gridHeight);
  walls = Array(gridHeight)
    .fill(null)
    .map(() => Array(gridWidth).fill(1));
}

// Build the maze geometry
function buildMaze() {
  // Remove previous maze tiles but keep the ball in the group
  for (let i = boardGroup.children.length - 1; i >= 0; i--) {
    const child = boardGroup.children[i];
    if (child !== ball) {
      boardGroup.remove(child);
    }
  }

  generateMaze(mazeDimension, walls, gridWidth, gridHeight);
  goalTileX = 0;
  goalTileZ = 0;

  for (let i = 0; i < gridWidth; i++) {
    for (let j = 0; j < gridHeight; j++) {
      const x = (i - gridWidth / 2) * 2 + 1 - (gridWidth % 2);
      const z = (j - gridHeight / 2) * 2 + 1 - (gridHeight % 2);

      switch (walls[j][i]) {
        case -1: // Start tile
          boardGroup.add(createFloor(x, 0, z, startMaterial));
          break;
        case -2: // End tile
          boardGroup.add(createFloor(x, 0, z, stopMaterial));
          goalTileX = i;
          goalTileZ = j;
          break;
        case 1: // Wall
          boardGroup.add(createCube(x, 0, z));
          break;
        default: // Floor
          boardGroup.add(createFloor(x, 0, z));
          break;
      }
    }
  }
}

function resetBallState() {
  ballX = startX;
  ballZ = startZ;
  velocityX = 0;
  velocityZ = 0;
  ballY = 0;
  ball.position.set(ballX, BALL_RADIUS + ballY, -ballZ);
}

function startRun({ rebuildMaze = false } = {}) {
  if (rebuildMaze) {
    buildMaze();
  }
  resetBallState();
  hasWon = false;
  paused = false;
  timerActive = true;
  levelStartTime = performance.now();
  latestElapsedSeconds = 0;
  hideWinMessage();
  setObjectiveMessage(getDefaultObjectiveCopy());
}

// Build the initial maze and start timer
buildMaze();
startRun();

// --- Collision helpers placed near physics for clarity ---
function worldToTileX(x) {
  return Math.floor((x + gridWidth + 1) / 2);
}
function worldToTileZ(z) {
  return Math.floor((z + gridHeight + 1) / 2);
}
function collideAxisX(nextX) {
  if (velocityX === 0) return;
  const dir = Math.sign(velocityX);
  const rowIndex = worldToTileZ(-ballZ);
  const edge = nextX + dir * BALL_RADIUS;
  const edgeTile = worldToTileX(edge);
  if (walls[rowIndex]?.[edgeTile] === 1) {
    const wallCenter = 2 * edgeTile - gridWidth;
    const face = dir > 0 ? wallCenter - 1 : wallCenter + 1;
    ballX = face - dir * (BALL_RADIUS + EPSILON);
    velocityX *= BOUNCE_DAMPING;
  } else {
    ballX = nextX;
  }
}
function collideAxisZ(nextWorldZ) {
  if (velocityZ === 0) return;
  const dir = Math.sign(velocityZ);
  const colIndexX = worldToTileX(ballX);
  const edge = nextWorldZ + dir * BALL_RADIUS;
  const edgeTile = worldToTileZ(edge);
  if (walls[edgeTile]?.[colIndexX] === 1) {
    const wallCenter = 2 * edgeTile - gridHeight;
    const face = dir > 0 ? wallCenter - 1 : wallCenter + 1;
    const adjustedWorldZ = face - dir * (BALL_RADIUS + EPSILON);
    ballZ = -adjustedWorldZ;
    velocityZ *= BOUNCE_DAMPING;
  } else {
    ballZ = -nextWorldZ;
  }
}

// Physics and collision detection

function updatePhysics() {
  if (paused) return;

  // Update velocity with acceleration
  velocityX = Math.max(-0.2, Math.min(velocityX + accelerationX, 0.2));
  velocityZ = Math.max(-0.2, Math.min(velocityZ + accelerationZ, 0.2));

  // Calculate acceleration from tilt
  accelerationX = 0.01 * Math.sin((tiltAngleX * Math.PI) / 180);
  accelerationZ = 0.01 * Math.sin((tiltAngleZ * Math.PI) / 180);

  // Axis-separated resolution using helpers (clear + minimal repetition)
  collideAxisX(ballX + velocityX);
  // worldZ is inverted sign of stored ballZ
  collideAxisZ(-ballZ + velocityZ);

  // Update ball position
  ball.position.set(ballX, BALL_RADIUS + ballY, -ballZ);

  // Update spotlight to follow ball
  spotlight.position.set(ballX, BALL_RADIUS + SPOTLIGHT_HEIGHT_OFFSET, -ballZ);
  spotlight.target.position.set(ballX, 0, -ballZ);

  // Update board tilt (desktop only)
  if (isMobile) {
    boardGroup.rotation.x = 0;
    boardGroup.rotation.z = 0;
  } else {
    boardGroup.rotation.x = (tiltAngleZ * Math.PI) / 180;
    boardGroup.rotation.z = (-tiltAngleX * Math.PI) / 180;
  }

  checkWinCondition();
}

function checkWinCondition() {
  if (hasWon) return;
  const tileX = worldToTileX(ballX);
  const tileZ = worldToTileZ(-ballZ);
  if (tileX === goalTileX && tileZ === goalTileZ) {
    hasWon = true;
    latestElapsedSeconds = (performance.now() - levelStartTime) / 1000;
    timerActive = false;
    setObjectiveMessage(
      isMobile
        ? "Goal reached! Use the buttons below to switch the camera, toggle lighting, or load a new maze."
        : "Goal reached! Press R to reset, N for a new level, or +/- to change the maze size."
    );
    launchConfetti();
    showWinMessage(latestElapsedSeconds);
  }
}

function updateTimerUI() {
  if (!timerDisplay) return;
  if (timerActive) {
    latestElapsedSeconds = (performance.now() - levelStartTime) / 1000;
  }
  timerDisplay.textContent = `Time: ${latestElapsedSeconds.toFixed(2)}s`;
}

// Camera update
function updateCamera() {
  if (cameraMode === 1) {
    // Follow camera
    camera.position.set(ballX, 30, -ballZ + 0.01);
    camera.lookAt(ballX, BALL_RADIUS, -ballZ);
    camera.fov = 30;
    camera.updateProjectionMatrix();
  } else {
    // Overview camera
    camera.position.set(0, 45, 0.01);
    camera.lookAt(0, 0, 0);
    camera.fov = 60;
    camera.updateProjectionMatrix();
  }
}

function cycleCameraMode() {
  cameraMode = (cameraMode + 1) % cameraModesCount;
  updateCamera();
}

function toggleLightingMode() {
  lightMode = !lightMode;
  ambientLight.intensity = lightMode
    ? AMBIENT_INTENSITY_SPOTLIGHT_MODE
    : AMBIENT_INTENSITY_AMBIENT_MODE;
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  updatePhysics();
  updateCamera();
  updateTimerUI();

  renderer.render(scene, camera);
}

// Event listeners
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Mouse movement for board tilt (desktop only)
if (!isMobile) {
  window.addEventListener("mousemove", (event) => {
    tiltAngleX = (event.clientX / window.innerWidth - 0.5) * 90;
    tiltAngleX = Math.max(-45, Math.min(tiltAngleX, 45));
    tiltAngleZ = (event.clientY / window.innerHeight - 0.5) * 90;
    tiltAngleZ = Math.max(-45, Math.min(tiltAngleZ, 45));
  });
}

// Keyboard controls
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  switch (key) {
    case "w":
      ballZ += 0.1;
      break;
    case "s":
      ballZ -= 0.1;
      break;
    case "d":
      ballX += 0.1;
      break;
    case "a":
      ballX -= 0.1;
      break;
    case "q":
      ballY -= 0.1;
      break;
    case "e":
      ballY += 0.1;
      break;
    case "p":
      paused = !paused;
      break;
    case "c":
      cycleCameraMode();
      break;
    case "r":
      startRun();
      break;
    case "n":
      startRun({ rebuildMaze: true });
      break;
    case "=":
    case "+":
      if (mazeDimension < MAX_MAZE_DIMENSION) {
        mazeDimension++;
        rebuildGridForCurrentDimension();
        startRun({ rebuildMaze: true });
      }
      break;
    case "-":
    case "_":
      if (mazeDimension > MIN_MAZE_DIMENSION) {
        mazeDimension--;
        rebuildGridForCurrentDimension();
        startRun({ rebuildMaze: true });
      }
      break;
    case "l":
      toggleLightingMode();
      break;
    case "escape":
      // Could add a menu or exit fullscreen
      break;
  }
});

// Start animation
animate();

console.log("Marble Maze initialized!");
console.log(
  "Controls: Mouse to tilt, C for camera, P to pause, R to reset, L for lighting"
);
