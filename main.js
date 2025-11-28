import * as THREE from "three";
import { generateMaze } from "./mazeGenerator.js";

// Constants
const MAZE_DIMENSION = 7; // Maze half-size (grid is 2*MAZE_DIMENSION + 1)
const GRID_WIDTH = MAZE_DIMENSION * 2 + 1;
const GRID_HEIGHT = MAZE_DIMENSION * 2 + 1;
// Start position aligned to center of tile (1,1) to avoid half-tile offset
const START_X = 2 * 1 - GRID_WIDTH; // equals -19 when MAZE_DIMENSION=10
const START_Z = -(2 * 1 - GRID_HEIGHT); // equals 19 when MAZE_DIMENSION=10
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

// State variables
let ballX = START_X,
  ballZ = START_Z,
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

// Maze grid (will be generated)
// 1 = wall, 0 = empty, -1 = start, -2 = end
const walls = Array(GRID_HEIGHT)
  .fill(null)
  .map(() => Array(GRID_WIDTH).fill(1));

// Lighting setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.0); // Initially dark
scene.add(ambientLight);

// Spotlight tuning constants (raise height & widen cone)
const SPOTLIGHT_HEIGHT_OFFSET = 30; // was 10 (2x higher)
const SPOTLIGHT_ANGLE_DEG = 7; // was 15 (wider beam to avoid narrow cone at high tilt)
const SPOTLIGHT_INTENSITY_FOCUSED = 512.0; // intensity when in spotlight mode
const SPOTLIGHT_INTENSITY_AMBIENT = 1.5; // intensity when ambient mode active

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

// Build the maze geometry
function buildMaze() {
  generateMaze(MAZE_DIMENSION, walls, GRID_WIDTH, GRID_HEIGHT);

  for (let i = 0; i < GRID_WIDTH; i++) {
    for (let j = 0; j < GRID_HEIGHT; j++) {
      const x = (i - GRID_WIDTH / 2) * 2 + 1 - (GRID_WIDTH % 2);
      const z = (j - GRID_HEIGHT / 2) * 2 + 1 - (GRID_HEIGHT % 2);

      switch (walls[j][i]) {
        case -1: // Start tile
          boardGroup.add(createFloor(x, 0, z, startMaterial));
          break;
        case -2: // End tile
          boardGroup.add(createFloor(x, 0, z, stopMaterial));
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

// Build the maze
buildMaze();

// --- Collision helpers placed near physics for clarity ---
function worldToTileX(x) {
  return Math.floor((x + GRID_WIDTH + 1) / 2);
}
function worldToTileZ(z) {
  return Math.floor((z + GRID_HEIGHT + 1) / 2);
}
function collideAxisX(nextX) {
  if (velocityX === 0) return;
  const dir = Math.sign(velocityX);
  const rowIndex = worldToTileZ(-ballZ);
  const edge = nextX + dir * BALL_RADIUS;
  const edgeTile = worldToTileX(edge);
  if (walls[rowIndex]?.[edgeTile] === 1) {
    const wallCenter = 2 * edgeTile - GRID_WIDTH;
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
    const wallCenter = 2 * edgeTile - GRID_HEIGHT;
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

  // Update board tilt
  boardGroup.rotation.x = (tiltAngleZ * Math.PI) / 180;
  boardGroup.rotation.z = (-tiltAngleX * Math.PI) / 180;
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

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  updatePhysics();
  updateCamera();

  renderer.render(scene, camera);
}

// Event listeners
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Mouse movement for board tilt
window.addEventListener("mousemove", (event) => {
  tiltAngleX = (event.clientX / window.innerWidth - 0.5) * 90;
  tiltAngleX = Math.max(-45, Math.min(tiltAngleX, 45));
  tiltAngleZ = (event.clientY / window.innerHeight - 0.5) * 90;
  tiltAngleZ = Math.max(-45, Math.min(tiltAngleZ, 45));
});

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
      cameraMode = (cameraMode + 1) % cameraModesCount;
      updateCamera();
      break;
    case "r":
      ballX = START_X;
      ballZ = START_Z;
      velocityX = 0;
      velocityZ = 0;
      ballY = 0;
      break;
    case "l":
      lightMode = !lightMode;
      if (lightMode) {
        // Spotlight mode
        ambientLight.intensity = 0.1;
        spotlight.intensity = SPOTLIGHT_INTENSITY_FOCUSED;
      } else {
        // Ambient mode
        ambientLight.intensity = 0.7;
        spotlight.intensity = SPOTLIGHT_INTENSITY_AMBIENT;
      }
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
