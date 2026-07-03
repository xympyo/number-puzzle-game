import { BOARD_SIZE, DIGIT_ORDER } from "../data/digits";
import { DIGIT_SHAPES, cellsToMask } from "./geometry";

export function generateCandidates(orientations = DIGIT_SHAPES) {
  const result = {};
  for (const digit of DIGIT_ORDER) {
    result[digit] = [];
    for (const orientation of orientations[digit]) {
      for (let y = 0; y <= BOARD_SIZE - orientation.height; y += 1) {
        for (let x = 0; x <= BOARD_SIZE - orientation.width; x += 1) {
          const cells = orientation.cells.map((cell) => ({ x: x + cell.x, y: y + cell.y }));
          result[digit].push({
            digit,
            x,
            y,
            orientationIndex: orientation.index,
            rotation: orientation.rotation,
            cellCount: orientation.cells.length,
            mask: cellsToMask(cells),
          });
        }
      }
    }
  }
  return result;
}

export function bigintPopcount(value) {
  let count = 0;
  let cursor = value;
  while (cursor > 0n) {
    cursor &= cursor - 1n;
    count += 1;
  }
  return count;
}

export function solutionKey(solution) {
  return DIGIT_ORDER.map((digit) => {
    const placement = solution[digit];
    return `${digit}:${placement.x}:${placement.y}:${placement.orientationIndex}`;
  }).join("|");
}
