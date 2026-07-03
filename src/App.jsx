import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "./components/Board";
import HelpModal from "./components/HelpModal";
import PieceTray from "./components/PieceTray";
import PuzzleIntelligence from "./components/PuzzleIntelligence";
import SolutionBrowser from "./components/SolutionBrowser";
import SolverPanel from "./components/SolverPanel";
import Toolbar from "./components/Toolbar";
import { BOARD_SIZE, DIGIT_ORDER, EMPTY_CELLS_WHEN_COMPLETE, TOTAL_BOARD_CELLS } from "./data/digits";
import { boardValidity, DIGIT_SHAPES, isPlacementValid, placementCells, serializePlacement } from "./lib/geometry";
import { createInitialState, placedCount } from "./lib/puzzleState";

const initialSearch = {
  status: "idle",
  solutionsFound: 0,
  elapsedMs: 0,
  nodes: 0,
  paused: false,
  message: "",
};

export default function App() {
  const boardRef = useRef(null);
  const workerRef = useRef(null);
  const [state, setState] = useState(createInitialState);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [drag, setDrag] = useState(null);
  const [preview, setPreview] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [activeSolutionIndex, setActiveSolutionIndex] = useState(0);
  const [search, setSearch] = useState(initialSearch);
  const [completableStatus, setCompletableStatus] = useState("not yet checked");
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const validity = useMemo(() => boardValidity(state.placements), [state.placements]);
  const intelligence = useMemo(() => buildIntelligence(solutions), [solutions]);

  const commitState = useCallback((updater) => {
    setState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      setHistory((existing) => ({ past: [...existing.past, current].slice(-80), future: [] }));
      setCompletableStatus("not yet checked");
      return next;
    });
  }, []);

  const placePiece = useCallback(
    (placement) => {
      if (!isPlacementValid(placement, state.placements)) return false;
      commitState((current) => ({
        ...current,
        placements: { ...current.placements, [placement.digit]: placement },
        selectedDigit: placement.digit,
      }));
      return true;
    },
    [commitState, state.placements],
  );

  const rotateSelected = useCallback(
    (direction = 1) => {
      const digit = state.selectedDigit;
      if (!digit || !state.placements[digit] || state.locked[digit]) return;
      const count = DIGIT_SHAPES[digit].length;
      const nextIndex = (state.placements[digit].orientationIndex + direction + count) % count;
      const rotated = { ...state.placements[digit], orientationIndex: nextIndex };
      if (isPlacementValid(rotated, state.placements)) placePiece(rotated);
    },
    [placePiece, state.locked, state.placements, state.selectedDigit],
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        if (drag) {
          const count = DIGIT_SHAPES[drag.digit].length;
          setDrag((current) => current && { ...current, orientationIndex: (current.orientationIndex + 1) % count });
        } else {
          rotateSelected(1);
        }
      }
      if (event.key === "Escape") {
        setDrag(null);
        setPreview(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drag, rotateSelected]);

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  const updatePreview = useCallback((clientX, clientY, currentDrag) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cellSize = rect.width / BOARD_SIZE;
    const x = Math.floor((clientX - rect.left) / cellSize);
    const y = Math.floor((clientY - rect.top) / cellSize);
    const placement = {
      digit: currentDrag.digit,
      x,
      y,
      orientationIndex: currentDrag.orientationIndex,
    };
    const placementsWithoutDragged = { ...state.placements };
    delete placementsWithoutDragged[currentDrag.digit];
    setPreview({
      placement,
      valid: x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE && isPlacementValid(placement, placementsWithoutDragged),
    });
  }, [state.placements]);

  useEffect(() => {
    if (!drag) return undefined;
    const onPointerMove = (event) => updatePreview(event.clientX, event.clientY, drag);
    const onPointerUp = () => {
      if (preview?.valid) placePiece(preview.placement);
      setDrag(null);
      setPreview(null);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [drag, placePiece, preview, updatePreview]);

  const startDrag = (event, digit, fromBoard = false) => {
    if (state.locked[digit]) return;
    event.preventDefault();
    const existing = state.placements[digit];
    setState((current) => ({ ...current, selectedDigit: digit }));
    setDrag({
      digit,
      orientationIndex: existing?.orientationIndex ?? 0,
      origin: fromBoard ? existing : null,
    });
    updatePreview(event.clientX, event.clientY, {
      digit,
      orientationIndex: existing?.orientationIndex ?? 0,
    });
  };

  const solve = (mode, safetyLimit = 2000) => {
    if (mode === "all" && placedCount(state.placements) === 0) {
      setSolutions([]);
      setSearch({
        ...initialSearch,
        status: "completed",
        message:
          "Empty-board full enumeration is too large for an in-browser exact search. Place or lock a few digits first, then run Find all solutions.",
      });
      setCompletableStatus("not yet checked");
      return;
    }

    workerRef.current?.terminate();
    const worker = new Worker(new URL("./workers/solver.worker.js", import.meta.url), { type: "module" });
    workerRef.current = worker;
    setSolutions([]);
    setActiveSolutionIndex(0);
    setSearch({ ...initialSearch, status: "running" });

    worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === "solutions") {
        setSolutions((current) => [...current, ...message.solutions]);
        setSearch((current) => ({ ...current, solutionsFound: message.total, nodes: message.nodes }));
      }
      if (message.type === "progress") {
        setSearch((current) => ({ ...current, nodes: message.nodes, solutionsFound: message.solutionsFound, elapsedMs: message.elapsedMs }));
      }
      if (message.type === "done") {
        const statusMessage = message.paused
          ? message.timeLimitReached
            ? `${message.message} At least ${message.solutionsFound} solutions found.`
            : `At least ${message.solutionsFound} solutions found. Enumeration paused at the safety limit.`
          : message.exact
            ? `Exact total: ${message.solutionsFound} solutions`
            : message.message || "";
        setSearch({
          status: message.status,
          solutionsFound: message.solutionsFound,
          elapsedMs: message.elapsedMs,
          nodes: message.nodes,
          paused: message.paused,
          message: statusMessage,
        });
        setCompletableStatus(message.solutionsFound > 0 ? `completable (${message.solutionsFound})` : "not completable");
      }
      if (message.type === "error") {
        setSearch((current) => ({ ...current, status: "completed", message: message.message }));
      }
    };

    worker.postMessage({
      type: "solve",
      payload: {
        placements: state.placements,
        mode,
        safetyLimit,
        batchSize: 25,
        timeLimitMs: mode === "first" ? 30000 : 45000,
      },
    });
  };

  const applySolution = (index) => {
    const solution = solutions[index];
    if (!solution) return;
    commitState((current) => ({
      ...current,
      placements: Object.fromEntries(Object.entries(solution).map(([digit, placement]) => [digit, { ...placement, digit }])),
      selectedDigit: null,
    }));
    setActiveSolutionIndex(index);
  };

  const previewSolution = (index) => {
    const solution = solutions[index];
    if (!solution) return;
    setState((current) => ({
      ...current,
      placements: Object.fromEntries(Object.entries(solution).map(([digit, placement]) => [digit, { ...placement, digit }])),
    }));
    setActiveSolutionIndex(index);
  };

  const exportSolutions = () => {
    const blob = new Blob([JSON.stringify(solutions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "number-puzzle-solutions.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const undo = () => {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      setState(previous);
      return { past: current.past.slice(0, -1), future: [state, ...current.future] };
    });
  };

  const redo = () => {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      setState(next);
      return { past: [...current.past, state], future: current.future.slice(1) };
    });
  };

  const selectedLocked = state.selectedDigit ? Boolean(state.locked[state.selectedDigit]) : false;
  const lockedCount = Object.values(state.locked).filter(Boolean).length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#164e63_0,#0f172a_34%,#020617_100%)] px-4 py-6 text-slate-100">
      <header className="mx-auto mb-6 max-w-7xl">
        <p className="text-sm font-bold uppercase tracking-[.25em] text-cyan-200">Set-packing puzzle solver</p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">11 x 11 Number Puzzle</h1>
      </header>
      <div className="mx-auto grid max-w-7xl gap-4 xl:grid-cols-[280px_minmax(420px,1fr)_360px]">
        <div className="space-y-4">
          <PieceTray placements={state.placements} locked={state.locked} selectedDigit={state.selectedDigit} onPiecePointerDown={startDrag} onSelect={(digit) => setState((current) => ({ ...current, selectedDigit: digit }))} />
          <Toolbar
            selectedDigit={state.selectedDigit}
            selectedLocked={selectedLocked}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onRotateLeft={() => rotateSelected(-1)}
            onRotateRight={() => rotateSelected(1)}
            onLock={() => state.selectedDigit && commitState((current) => ({ ...current, locked: { ...current.locked, [state.selectedDigit]: true } }))}
            onUnlock={() => state.selectedDigit && commitState((current) => ({ ...current, locked: { ...current.locked, [state.selectedDigit]: false } }))}
            onUndo={undo}
            onRedo={redo}
            onClear={() => commitState((current) => ({ ...current, placements: {}, selectedDigit: null }))}
            onReset={() => commitState(createInitialState())}
            onHelp={() => setHelpOpen(true)}
          />
        </div>

        <Board
          boardRef={boardRef}
          placements={state.placements}
          locked={state.locked}
          selectedDigit={state.selectedDigit}
          preview={preview}
          heatmap={intelligence?.heatmap}
          heatmapEnabled={heatmapEnabled}
          onCellPointerDown={(event, _x, _y, digit) => digit && startDrag(event, digit, true)}
          onSelect={(digit) => setState((current) => ({ ...current, selectedDigit: digit }))}
          onContextMenu={(event) => {
            event.preventDefault();
            rotateSelected(1);
          }}
        />

        <div className="space-y-4">
          <SolverPanel
            placements={state.placements}
            valid={validity.valid}
            completableStatus={completableStatus}
            search={search}
            onCheck={() => solve("first", 1)}
            onSolveFirst={() => solve("first", 1)}
            onSolveAll={() => solve("all", 2000)}
            onCancel={() => workerRef.current?.postMessage({ type: "cancel" })}
            onContinue={() => solve("all", search.solutionsFound + 2000)}
          />
          <SolutionBrowser
            solutions={solutions}
            activeIndex={activeSolutionIndex}
            lockedCount={lockedCount}
            onPreview={previewSolution}
            onApply={applySolution}
            onExport={exportSolutions}
          />
          <PuzzleIntelligence intelligence={intelligence} heatmapEnabled={heatmapEnabled} onToggleHeatmap={setHeatmapEnabled} />
        </div>
      </div>
      <footer className="mx-auto mt-6 max-w-7xl text-xs text-slate-500">
        {placedCount(state.placements)} pieces placed. Completed layouts occupy {TOTAL_BOARD_CELLS - EMPTY_CELLS_WHEN_COMPLETE} cells and leave {EMPTY_CELLS_WHEN_COMPLETE} empty cells.
      </footer>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}

function buildIntelligence(solutions) {
  if (!solutions.length) return null;
  const forced = {};
  const frequencies = new Map();
  const heatCounts = Array(BOARD_SIZE * BOARD_SIZE).fill(0);

  for (const digit of DIGIT_ORDER) {
    const first = serializePlacement(solutions[0][digit]);
    forced[digit] = solutions.every((solution) => serializePlacement(solution[digit]) === first);
  }

  for (const solution of solutions) {
    for (const digit of DIGIT_ORDER) {
      const placement = solution[digit];
      const key = serializePlacement(placement);
      frequencies.set(key, {
        key,
        digit,
        placement,
        count: (frequencies.get(key)?.count ?? 0) + 1,
      });
      for (const cell of placementCells(placement)) heatCounts[cell.y * BOARD_SIZE + cell.x] += 1;
    }
  }

  const heatmap = heatCounts.map((count) => count / solutions.length);
  return {
    forced,
    heatmap,
    alwaysOccupied: heatmap.filter((value) => value === 1).length,
    alwaysEmpty: heatmap.filter((value) => value === 0).length,
    flexibleCells: heatmap.filter((value) => value > 0 && value < 1).length,
    topFrequencies: [...frequencies.values()]
      .map((item) => ({ ...item, frequency: item.count / solutions.length }))
      .sort((a, b) => b.frequency - a.frequency || a.key.localeCompare(b.key))
      .slice(0, 12),
  };
}
