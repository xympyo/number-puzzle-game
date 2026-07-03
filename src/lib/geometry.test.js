import { describe, expect, it } from "vitest";
import { DIGITS, EXPECTED_CELL_COUNTS } from "../data/digits";
import { getBounds, getUniqueOrientations, patternToCells, rotateCellsClockwise } from "./geometry";

describe("digit geometry", () => {
  it("normalizes patterns and preserves expected occupied counts", () => {
    for (const [digit, expected] of Object.entries(EXPECTED_CELL_COUNTS)) {
      expect(patternToCells(DIGITS[digit])).toHaveLength(expected);
    }

    expect(getBounds(patternToCells(DIGITS["1"]))).toEqual({ width: 1, height: 5 });
  });

  it("deduplicates rotationally identical orientations", () => {
    expect(getUniqueOrientations(DIGITS["1"])).toHaveLength(2);
    expect(getUniqueOrientations(DIGITS["8"]).length).toBeGreaterThanOrEqual(1);
  });

  it("rotates around the normalized bounding box", () => {
    const one = patternToCells(DIGITS["1"]);
    expect(getBounds(rotateCellsClockwise(one))).toEqual({ width: 5, height: 1 });
  });
});
