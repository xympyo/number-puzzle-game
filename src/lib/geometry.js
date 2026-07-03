import { BOARD_SIZE, DIGITS } from "../data/digits";

export function patternToCells(pattern) {
  const cells = [];
  pattern.forEach((row, y) => {
    [...row].forEach((value, x) => {
      if (value === "#") cells.push({ x, y });
    });
  });
  return normalizeCells(cells);
}

export function normalizeCells(cells) {
  if (!cells.length) return [];
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  return cells
    .map((cell) => ({ x: cell.x - minX, y: cell.y - minY }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function getBounds(cells) {
  if (!cells.length) return { width: 0, height: 0 };
  return {
    width: Math.max(...cells.map((cell) => cell.x)) + 1,
    height: Math.max(...cells.map((cell) => cell.y)) + 1,
  };
}

export function rotateCellsClockwise(cells) {
  const { height } = getBounds(cells);
  // Rotate around the current normalized bounding box, then normalize again.
  return normalizeCells(cells.map((cell) => ({ x: height - 1 - cell.y, y: cell.x })));
}

export function rotateCellsCounterClockwise(cells) {
  const { width } = getBounds(cells);
  return normalizeCells(cells.map((cell) => ({ x: cell.y, y: width - 1 - cell.x })));
}

export function cellsKey(cells) {
  return normalizeCells(cells)
    .map((cell) => `${cell.x},${cell.y}`)
    .join(";");
}

export function getUniqueOrientations(pattern) {
  const orientations = [];
  const seen = new Set();
  let current = patternToCells(pattern);

  for (let index = 0; index < 4; index += 1) {
    const normalized = normalizeCells(current);
    const key = cellsKey(normalized);
    if (!seen.has(key)) {
      seen.add(key);
      orientations.push({
        index: orientations.length,
        rotation: index * 90,
        cells: normalized,
        ...getBounds(normalized),
      });
    }
    current = rotateCellsClockwise(current);
  }

  return orientations;
}

export const DIGIT_SHAPES = Object.fromEntries(
  Object.entries(DIGITS).map(([digit, pattern]) => [digit, getUniqueOrientations(pattern)]),
);

export function placementCells(placement, orientations = DIGIT_SHAPES) {
  if (!placement) return [];
  const orientation = orientations[placement.digit]?.[placement.orientationIndex];
  if (!orientation) return [];
  return orientation.cells.map((cell) => ({ x: placement.x + cell.x, y: placement.y + cell.y }));
}

export function isPlacementInBounds(placement, orientations = DIGIT_SHAPES) {
  const orientation = orientations[placement.digit]?.[placement.orientationIndex];
  if (!orientation) return false;
  return (
    placement.x >= 0 &&
    placement.y >= 0 &&
    placement.x + orientation.width <= BOARD_SIZE &&
    placement.y + orientation.height <= BOARD_SIZE
  );
}

export function cellIndex(x, y) {
  return y * BOARD_SIZE + x;
}

export function cellsToMask(cells) {
  return cells.reduce((mask, cell) => mask | (1n << BigInt(cellIndex(cell.x, cell.y))), 0n);
}

export function placementMask(placement, orientations = DIGIT_SHAPES) {
  return cellsToMask(placementCells(placement, orientations));
}

export function makeEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

export function buildBoard(placements, orientations = DIGIT_SHAPES) {
  const board = makeEmptyBoard();
  for (const placement of Object.values(placements)) {
    if (!placement) continue;
    for (const cell of placementCells(placement, orientations)) {
      if (cell.x >= 0 && cell.x < BOARD_SIZE && cell.y >= 0 && cell.y < BOARD_SIZE) {
        board[cell.y][cell.x] = placement.digit;
      }
    }
  }
  return board;
}

export function isPlacementValid(placement, placements, orientations = DIGIT_SHAPES) {
  if (!isPlacementInBounds(placement, orientations)) return false;
  const candidate = placementMask(placement, orientations);
  for (const [digit, existing] of Object.entries(placements)) {
    if (!existing || digit === placement.digit) continue;
    if ((candidate & placementMask(existing, orientations)) !== 0n) return false;
  }
  return true;
}

export function boardValidity(placements, orientations = DIGIT_SHAPES) {
  let mask = 0n;
  for (const placement of Object.values(placements)) {
    if (!placement) continue;
    if (!isPlacementInBounds(placement, orientations)) return { valid: false, mask };
    const next = placementMask(placement, orientations);
    if ((mask & next) !== 0n) return { valid: false, mask };
    mask |= next;
  }
  return { valid: true, mask };
}

export function serializePlacement(placement, orientations = DIGIT_SHAPES) {
  if (!placement) return "";
  const orientation = orientations[placement.digit]?.[placement.orientationIndex];
  return `${placement.digit}:${placement.x}:${placement.y}:${orientation?.rotation ?? 0}`;
}
