import { DIGIT_ORDER } from "../data/digits";

export function createInitialState() {
  return {
    placements: {},
    locked: {},
    selectedDigit: null,
  };
}

export function placedCount(placements) {
  return DIGIT_ORDER.filter((digit) => placements[digit]).length;
}

export function getPieceState(digit, placements, locked) {
  if (locked[digit]) return "Locked";
  if (placements[digit]) return "Placed";
  return "Available";
}
