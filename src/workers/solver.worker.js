import { DIGIT_ORDER, TOTAL_BOARD_CELLS } from "../data/digits";
import { DIGIT_SHAPES, placementMask } from "../lib/geometry";
import { bigintPopcount, generateCandidates } from "../lib/solverHelpers";

const candidatesByDigit = generateCandidates(DIGIT_SHAPES);
for (const digit of DIGIT_ORDER) {
  candidatesByDigit[digit].forEach((candidate, index) => {
    candidate.index = index;
  });
}
const overlapMatrix = buildOverlapMatrix();
const candidateLookup = Object.fromEntries(
  DIGIT_ORDER.map((digit) => [
    digit,
    new Map(candidatesByDigit[digit].map((candidate) => [candidateKey(candidate), candidate])),
  ]),
);
const digitAreas = Object.fromEntries(DIGIT_ORDER.map((digit) => [digit, DIGIT_SHAPES[digit][0].cells.length]));
const BOARD_SIZE = 11;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
let cancelRequested = false;

function buildOverlapMatrix() {
  const matrix = {};
  for (const digit of DIGIT_ORDER) {
    matrix[digit] = {};
    for (const otherDigit of DIGIT_ORDER) {
      if (digit === otherDigit) continue;
      matrix[digit][otherDigit] = candidatesByDigit[digit].map((candidate) =>
        candidatesByDigit[otherDigit].map((otherCandidate) => bigintPopcount(candidate.mask & otherCandidate.mask)),
      );
    }
  }
  return matrix;
}

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

function candidateKey(placement) {
  return `${placement.x}:${placement.y}:${placement.orientationIndex}`;
}

function toPlacement(candidate, source = "solver") {
  return {
    digit: candidate.digit,
    x: candidate.x,
    y: candidate.y,
    orientationIndex: candidate.orientationIndex,
    source,
  };
}

function validateFixedPlacements(placements) {
  const fixed = {};
  let occupiedMask = 0n;

  for (const [digit, placement] of Object.entries(placements ?? {})) {
    if (!placement) continue;
    const normalized = normalizePlacement({ ...placement, digit });
    const mask = placementMask(normalized, DIGIT_SHAPES);
    const matchingCandidate = candidateLookup[digit].get(candidateKey(normalized));

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
  let batch = [];
  const deadMemo = new Set();
  let lastYieldAt = startedAt;

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
      toPlacement({ ...placement, digit }, "user"),
    ]),
  );
  const initialDomains = Object.fromEntries(
    remainingDigits.map((digit) => [
      digit,
      candidatesByDigit[digit].filter((candidate) => (candidate.mask & occupiedMask) === 0n),
    ]),
  );

  if (mode === "first") {
    const quickSolution = findFirstWithMinConflicts(remainingDigits, initialDomains, fixedPlacements, startedAt + 1600);
    if (quickSolution) {
      solutionsFound = 1;
      batch.push(quickSolution);
      emitBatch(true);
      self.postMessage({
        type: "done",
        status: "completed",
        exact: false,
        paused: false,
        safetyLimit,
        solutionsFound,
        nodes,
        elapsedMs: performance.now() - startedAt,
        message: "Found by deterministic local search.",
      });
      return;
    }
  }

  function emitBatch(force = false) {
    if (batch.length === 0 || (!force && batch.length < batchSize)) return;
    self.postMessage({ type: "solutions", solutions: batch, total: solutionsFound, nodes });
    batch = [];
  }

  function narrowDomains(domains, digits, candidateMask) {
    const nextDomains = {};
    for (const digit of digits) {
      const current = domains[digit];
      const narrowed = [];
      for (let index = 0; index < current.length; index += 1) {
        const candidate = current[index];
        if ((candidate.mask & candidateMask) === 0n) narrowed.push(candidate);
      }
      if (narrowed.length === 0) return null;
      nextDomains[digit] = narrowed;
    }
    return nextDomains;
  }

  function propagationStep(currentMask, remaining, placed, domains) {
    let mask = currentMask;
    let digits = remaining;
    let activePlaced = placed;
    let activeDomains = domains;
    let changed = true;

    while (changed) {
      changed = false;
      const areaNeeded = digits.reduce((sum, digit) => sum + digitAreas[digit], 0);
      if (TOTAL_BOARD_CELLS - bigintPopcount(mask) < areaNeeded) return null;

      let candidateUnion = 0n;
      let forcedDigit = null;
      let bestDigit = null;
      let bestCandidates = null;

      for (const digit of digits) {
        const validCandidates = activeDomains[digit];
        if (!validCandidates?.length) return null;
        if (validCandidates.length === 1) forcedDigit = digit;
        if (
          !bestCandidates ||
          validCandidates.length < bestCandidates.length ||
          (validCandidates.length === bestCandidates.length && digit < bestDigit)
        ) {
          bestDigit = digit;
          bestCandidates = validCandidates;
        }
        for (let index = 0; index < validCandidates.length; index += 1) {
          candidateUnion |= validCandidates[index].mask;
        }
      }

      if (bigintPopcount(candidateUnion) < areaNeeded) return null;

      if (forcedDigit) {
        const forcedCandidate = activeDomains[forcedDigit][0];
        const nextDigits = digits.filter((digit) => digit !== forcedDigit);
        const nextDomains = narrowDomains(activeDomains, nextDigits, forcedCandidate.mask);
        if (!nextDomains && nextDigits.length > 0) return null;
        mask |= forcedCandidate.mask;
        digits = nextDigits;
        activeDomains = nextDomains ?? {};
        activePlaced = {
          ...activePlaced,
          [forcedDigit]: toPlacement(forcedCandidate),
        };
        changed = true;
      }
    }

    return {
      mask,
      digits,
      placed: activePlaced,
      domains: activeDomains,
    };
  }

  function orderCandidatesByImpact(candidates, domains, remainingDigits) {
    return [...candidates].sort((a, b) => {
      const impactA = eliminationImpact(a.mask, domains, remainingDigits);
      const impactB = eliminationImpact(b.mask, domains, remainingDigits);
      return impactB - impactA || a.y - b.y || a.x - b.x || a.orientationIndex - b.orientationIndex;
    });
  }

  function eliminationImpact(candidateMask, domains, remainingDigits) {
    let impact = 0;
    for (const digit of remainingDigits) {
      const domain = domains[digit];
      for (let index = 0; index < domain.length; index += 1) {
        if ((domain[index].mask & candidateMask) !== 0n) impact += 1;
      }
    }
    return impact;
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function overlapScore(candidate, assignments, digit) {
    let score = 0;
    for (const [otherDigit, otherCandidate] of Object.entries(assignments)) {
      if (otherDigit === digit || !otherCandidate) continue;
      score += overlapMatrix[digit][otherDigit][candidate.index][otherCandidate.index];
    }
    return score;
  }

  function totalOverlap(assignments) {
    let score = 0;
    for (let left = 0; left < remainingDigits.length; left += 1) {
      for (let right = left + 1; right < remainingDigits.length; right += 1) {
        const leftDigit = remainingDigits[left];
        const rightDigit = remainingDigits[right];
        score += overlapMatrix[leftDigit][rightDigit][assignments[leftDigit].index][assignments[rightDigit].index];
      }
    }
    return score;
  }

  function findFirstWithMinConflicts(digits, domains, fixedSolution, deadlineMs) {
    if (digits.length === 0) return fixedSolution;
    if (digits.some((digit) => !domains[digit]?.length)) return null;

    const random = seededRandom(20260703);
    const orderedDigits = [...digits].sort((a, b) => domains[a].length - domains[b].length || b.localeCompare(a));
    const restarts = 1000;
    const maxSteps = 1600;

    for (let restart = 0; restart < restarts; restart += 1) {
      const assignments = {};
      for (const digit of orderedDigits) {
        const domain = domains[digit];
        assignments[digit] = domain[Math.floor(random() * domain.length)];
      }

      for (let step = 0; step < maxSteps; step += 1) {
        if (cancelRequested) return null;
        if (performance.now() > deadlineMs) return null;
        if (totalOverlap(assignments) === 0) {
          return {
            ...fixedSolution,
            ...Object.fromEntries(Object.entries(assignments).map(([digit, candidate]) => [digit, toPlacement(candidate)])),
          };
        }

        const conflicted = orderedDigits.filter((digit) => overlapScore(assignments[digit], assignments, digit) > 0);
        const digit = conflicted[Math.floor(random() * conflicted.length)];
        const currentScore = overlapScore(assignments[digit], assignments, digit);
        let bestScore = currentScore;
        let bestCandidates = [assignments[digit]];

        for (const candidate of domains[digit]) {
          const score = overlapScore(candidate, assignments, digit);
          if (score < bestScore) {
            bestScore = score;
            bestCandidates = [candidate];
          } else if (score === bestScore) {
            bestCandidates.push(candidate);
          }
        }

        assignments[digit] = bestCandidates[Math.floor(random() * bestCandidates.length)];
      }
    }

    return null;
  }

  function firstBitIndex(mask) {
    for (let index = 0; index < CELL_COUNT; index += 1) {
      if ((mask & (1n << BigInt(index))) !== 0n) return index;
    }
    return -1;
  }

  function openComponents(mask) {
    const componentOf = Array(CELL_COUNT).fill(-1);
    const sizes = [];
    let componentIndex = 0;

    for (let cell = 0; cell < CELL_COUNT; cell += 1) {
      if ((mask & (1n << BigInt(cell))) !== 0n || componentOf[cell] !== -1) continue;
      const queue = [cell];
      componentOf[cell] = componentIndex;
      let size = 0;

      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        size += 1;
        const x = current % BOARD_SIZE;
        const y = Math.floor(current / BOARD_SIZE);
        const neighbors = [
          x > 0 ? current - 1 : -1,
          x < BOARD_SIZE - 1 ? current + 1 : -1,
          y > 0 ? current - BOARD_SIZE : -1,
          y < BOARD_SIZE - 1 ? current + BOARD_SIZE : -1,
        ];

        for (let index = 0; index < neighbors.length; index += 1) {
          const next = neighbors[index];
          if (next < 0 || componentOf[next] !== -1 || (mask & (1n << BigInt(next))) !== 0n) continue;
          componentOf[next] = componentIndex;
          queue.push(next);
        }
      }

      sizes.push(size);
      componentIndex += 1;
    }

    return { componentOf, sizes };
  }

  function componentCapacityFeasible(mask, digits, domains) {
    if (digits.length === 0) return true;
    const { componentOf, sizes } = openComponents(mask);
    const optionsByDigit = digits.map((digit) => {
      const options = new Set();
      const domain = domains[digit];
      for (let index = 0; index < domain.length; index += 1) {
        const component = componentOf[firstBitIndex(domain[index].mask)];
        if (component >= 0) options.add(component);
      }
      return {
        digit,
        area: digitAreas[digit],
        options: [...options].filter((component) => sizes[component] >= digitAreas[digit]),
      };
    });

    if (optionsByDigit.some((item) => item.options.length === 0)) return false;

    optionsByDigit.sort((a, b) => a.options.length - b.options.length || b.area - a.area || a.digit.localeCompare(b.digit));
    const remainingCapacity = [...sizes];

    function assign(index) {
      if (index === optionsByDigit.length) return true;
      const item = optionsByDigit[index];
      for (let optionIndex = 0; optionIndex < item.options.length; optionIndex += 1) {
        const component = item.options[optionIndex];
        if (remainingCapacity[component] < item.area) continue;
        remainingCapacity[component] -= item.area;
        if (assign(index + 1)) return true;
        remainingCapacity[component] += item.area;
      }
      return false;
    }

    return assign(0);
  }

  async function backtrack(currentMask, remaining, placed, domains) {
    if (cancelRequested || solutionsFound >= safetyLimit) return;
    nodes += 1;

    const now = performance.now();
    if (nodes % 2500 === 0 || now - lastYieldAt > 80) {
      lastYieldAt = now;
      self.postMessage({ type: "progress", nodes, solutionsFound, elapsedMs: performance.now() - startedAt });
      await delay();
      if (cancelRequested) return;
    }

    const propagated = propagationStep(currentMask, remaining, placed, domains);
    if (!propagated) return;
    const { mask, digits, placed: activePlaced, domains: activeDomains } = propagated;
    const memoKey = `${digits.join("")}|${mask.toString(36)}`;
    if (deadMemo.has(memoKey)) return;
    if (!componentCapacityFeasible(mask, digits, activeDomains)) {
      deadMemo.add(memoKey);
      return;
    }

    if (digits.length === 0) {
      const solution = { ...fixedPlacements, ...activePlaced };
      solutionsFound += 1;
      batch.push(solution);
      emitBatch();
      return;
    }

    const solutionsBefore = solutionsFound;
    let bestDigit = null;
    let bestCandidates = null;
    for (const digit of digits) {
      const validCandidates = activeDomains[digit];
      if (!bestCandidates || validCandidates.length < bestCandidates.length || (validCandidates.length === bestCandidates.length && digit < bestDigit)) {
        bestDigit = digit;
        bestCandidates = validCandidates;
      }
    }

    const nextRemaining = digits.filter((digit) => digit !== bestDigit);
    const orderedCandidates = orderCandidatesByImpact(bestCandidates, activeDomains, nextRemaining);
    for (const candidate of orderedCandidates) {
      if (cancelRequested || solutionsFound >= safetyLimit) return;
      const nextDomains = narrowDomains(activeDomains, nextRemaining, candidate.mask);
      if (!nextDomains && nextRemaining.length > 0) continue;
      await backtrack(
        mask | candidate.mask,
        nextRemaining,
        {
          ...activePlaced,
          [bestDigit]: toPlacement(candidate),
        },
        nextDomains ?? {},
      );
    }
    if (solutionsFound === solutionsBefore) deadMemo.add(memoKey);
  }

  await backtrack(occupiedMask, remainingDigits, {}, initialDomains);
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
