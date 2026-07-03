import { DIGIT_ORDER, TOTAL_BOARD_CELLS } from "../data/digits";
import { DIGIT_SHAPES, placementMask } from "../lib/geometry";
import { bigintPopcount, generateCandidates, solutionKey } from "../lib/solverHelpers";

const candidatesByDigit = generateCandidates(DIGIT_SHAPES);
let cancelRequested = false;

self.onmessage = (event) => {
  const { type, payload } = event.data;
  if (type === "cancel") {
    cancelRequested = true;
    return;
  }
  if (type === "solve") {
    cancelRequested = false;
    solve(payload).catch((error) => {
      self.postMessage({ type: "error", message: error?.message ?? "Solver failed" });
    });
  }
};

function delay() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function normalizePlacement(placement) {
  return {
    digit: placement.digit,
    x: placement.x,
    y: placement.y,
    orientationIndex: placement.orientationIndex,
  };
}

function validateFixedPlacements(placements) {
  const fixed = {};
  let occupiedMask = 0n;

  for (const [digit, placement] of Object.entries(placements ?? {})) {
    if (!placement) continue;
    const normalized = normalizePlacement({ ...placement, digit });
    const mask = placementMask(normalized, DIGIT_SHAPES);
    const matchingCandidate = candidatesByDigit[digit].find(
      (candidate) =>
        candidate.x === normalized.x &&
        candidate.y === normalized.y &&
        candidate.orientationIndex === normalized.orientationIndex,
    );

    if (!matchingCandidate || (occupiedMask & mask) !== 0n) {
      return { valid: false, fixed, occupiedMask };
    }

    fixed[digit] = { ...normalized, mask };
    occupiedMask |= mask;
  }

  return { valid: true, fixed, occupiedMask };
}

async function solve(payload) {
  const startedAt = performance.now();
  const mode = payload.mode ?? "all";
  const safetyLimit = mode === "first" ? 1 : payload.safetyLimit ?? 2000;
  const batchSize = payload.batchSize ?? 25;
  const { valid, fixed, occupiedMask } = validateFixedPlacements(payload.placements);
  let nodes = 0;
  let solutionsFound = 0;
  const seen = new Set();
  let batch = [];

  if (!valid) {
    self.postMessage({
      type: "done",
      status: "completed",
      exact: true,
      solutionsFound: 0,
      nodes,
      elapsedMs: performance.now() - startedAt,
      message: "Current board is invalid.",
    });
    return;
  }

  const remainingDigits = DIGIT_ORDER.filter((digit) => !fixed[digit]);
  const fixedPlacements = Object.fromEntries(
    Object.entries(fixed).map(([digit, placement]) => [
      digit,
      {
        digit,
        x: placement.x,
        y: placement.y,
        orientationIndex: placement.orientationIndex,
        source: "user",
      },
    ]),
  );

  function emitBatch(force = false) {
    if (batch.length === 0 || (!force && batch.length < batchSize)) return;
    self.postMessage({ type: "solutions", solutions: batch, total: solutionsFound, nodes });
    batch = [];
  }

  async function backtrack(currentMask, remaining, placed) {
    if (cancelRequested || solutionsFound >= safetyLimit) return;
    nodes += 1;

    if (nodes % 2500 === 0) {
      self.postMessage({ type: "progress", nodes, solutionsFound, elapsedMs: performance.now() - startedAt });
      await delay();
      if (cancelRequested) return;
    }

    let propagated = true;
    let mask = currentMask;
    let digits = [...remaining];
    const activePlaced = { ...placed };

    while (propagated) {
      propagated = false;
      const areaNeeded = digits.reduce((sum, digit) => sum + DIGIT_SHAPES[digit][0].cells.length, 0);
      if (TOTAL_BOARD_CELLS - bigintPopcount(mask) < areaNeeded) return;

      let candidateUnion = 0n;
      const validByDigit = new Map();
      for (const digit of digits) {
        const validCandidates = candidatesByDigit[digit].filter((candidate) => (candidate.mask & mask) === 0n);
        if (validCandidates.length === 0) return;
        validByDigit.set(digit, validCandidates);
        for (const candidate of validCandidates) candidateUnion |= candidate.mask;
      }
      if (bigintPopcount(candidateUnion) < areaNeeded) return;

      const forced = digits.find((digit) => validByDigit.get(digit).length === 1);
      if (forced) {
        const candidate = validByDigit.get(forced)[0];
        activePlaced[forced] = {
          digit: forced,
          x: candidate.x,
          y: candidate.y,
          orientationIndex: candidate.orientationIndex,
          source: "solver",
        };
        mask |= candidate.mask;
        digits = digits.filter((digit) => digit !== forced);
        propagated = true;
      }
    }

    if (digits.length === 0) {
      const solution = { ...fixedPlacements, ...activePlaced };
      const key = solutionKey(solution);
      if (!seen.has(key)) {
        seen.add(key);
        solutionsFound += 1;
        batch.push(solution);
        emitBatch();
      }
      return;
    }

    let bestDigit = null;
    let bestCandidates = null;
    for (const digit of digits) {
      const validCandidates = candidatesByDigit[digit].filter((candidate) => (candidate.mask & mask) === 0n);
      if (!bestCandidates || validCandidates.length < bestCandidates.length || (validCandidates.length === bestCandidates.length && digit < bestDigit)) {
        bestDigit = digit;
        bestCandidates = validCandidates;
      }
    }

    for (const candidate of bestCandidates) {
      if (cancelRequested || solutionsFound >= safetyLimit) return;
      await backtrack(mask | candidate.mask, digits.filter((digit) => digit !== bestDigit), {
        ...activePlaced,
        [bestDigit]: {
          digit: bestDigit,
          x: candidate.x,
          y: candidate.y,
          orientationIndex: candidate.orientationIndex,
          source: "solver",
        },
      });
    }
  }

  await backtrack(occupiedMask, remainingDigits, {});
  emitBatch(true);

  const paused = !cancelRequested && solutionsFound >= safetyLimit && mode !== "first";
  self.postMessage({
    type: "done",
    status: cancelRequested ? "cancelled" : "completed",
    exact: !paused && !cancelRequested,
    paused,
    safetyLimit,
    solutionsFound,
    nodes,
    elapsedMs: performance.now() - startedAt,
  });
}
