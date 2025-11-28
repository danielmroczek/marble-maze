/**
 * Maze Generator Module
 * Generates a random maze using depth-first search algorithm
 */

/**
 * Generates a maze using randomized depth-first search (DFS) algorithm
 * @param {number} mazeDimension - Half-size of the maze (grid will be 2*mazeDimension + 1)
 * @param {Array<Array<number>>} walls - 2D array to populate with maze structure
 *                                       1 = wall, 0 = empty, -1 = start, -2 = end
 * @param {number} gridWidth - Width of the grid
 * @param {number} gridHeight - Height of the grid
 */
export function generateMaze(mazeDimension, walls, gridWidth, gridHeight) {
  const visited = Array(mazeDimension)
    .fill(null)
    .map(() => Array(mazeDimension).fill(false));

  // Initialize walls
  for (let i = 0; i < gridHeight; i++) {
    for (let j = 0; j < gridWidth; j++) {
      walls[i][j] = 1;
    }
  }

  const stackI = [];
  const stackJ = [];
  let currentI = 0,
    currentJ = 0;

  const isDeadEnd = (i, j) => {
    if (j > 0 && !visited[i][j - 1]) return false;
    if (i > 0 && !visited[i - 1][j]) return false;
    if (j < mazeDimension - 1 && !visited[i][j + 1]) return false;
    if (i < mazeDimension - 1 && !visited[i + 1][j]) return false;
    return true;
  };

  const hasUnvisitedCells = () => {
    for (let f = 0; f < mazeDimension; f++) {
      for (let g = 0; g < mazeDimension; g++) {
        if (!visited[f][g]) return true;
      }
    }
    return false;
  };

  while (hasUnvisitedCells()) {
    while (!isDeadEnd(currentI, currentJ)) {
      const direction = Math.floor(Math.random() * 4) + 1;

      switch (direction) {
        case 1: // Up
          if (currentJ > 0 && !visited[currentI][currentJ - 1]) {
            visited[currentI][currentJ] = true;
            walls[currentI * 2 + 1][currentJ * 2 + 1] = 0;
            walls[currentI * 2 + 1][currentJ * 2] = 0;
            stackI.push(currentI);
            stackJ.push(currentJ);
            currentJ--;
            visited[currentI][currentJ] = true;
            walls[currentI * 2 + 1][currentJ * 2 + 1] = 0;
          }
          break;
        case 2: // Right
          if (
            currentI < mazeDimension - 1 &&
            !visited[currentI + 1][currentJ]
          ) {
            visited[currentI][currentJ] = true;
            walls[currentI * 2 + 1][currentJ * 2 + 1] = 0;
            walls[currentI * 2 + 2][currentJ * 2 + 1] = 0;
            stackI.push(currentI);
            stackJ.push(currentJ);
            currentI++;
            visited[currentI][currentJ] = true;
            walls[currentI * 2 + 1][currentJ * 2 + 1] = 0;
          }
          break;
        case 3: // Down
          if (
            currentJ < mazeDimension - 1 &&
            !visited[currentI][currentJ + 1]
          ) {
            visited[currentI][currentJ] = true;
            walls[currentI * 2 + 1][currentJ * 2 + 1] = 0;
            walls[currentI * 2 + 1][currentJ * 2 + 2] = 0;
            stackI.push(currentI);
            stackJ.push(currentJ);
            currentJ++;
            visited[currentI][currentJ] = true;
            walls[currentI * 2 + 1][currentJ * 2 + 1] = 0;
          }
          break;
        case 4: // Left
          if (currentI > 0 && !visited[currentI - 1][currentJ]) {
            visited[currentI][currentJ] = true;
            walls[currentI * 2 + 1][currentJ * 2 + 1] = 0;
            walls[currentI * 2][currentJ * 2 + 1] = 0;
            stackI.push(currentI);
            stackJ.push(currentJ);
            currentI--;
            visited[currentI][currentJ] = true;
            walls[currentI * 2 + 1][currentJ * 2 + 1] = 0;
          }
          break;
      }
    }

    while (
      isDeadEnd(currentI, currentJ) &&
      stackI.length > 1 &&
      stackJ.length > 1
    ) {
      currentI = stackI.pop();
      currentJ = stackJ.pop();
    }
  }

  // Mark start and end
  walls[1][1] = -1; // Start
  walls[2 * mazeDimension - 1][2 * mazeDimension - 1] = -2; // End
}
