import { DIGIT_ORDER, EXPECTED_CELL_COUNTS } from "../data/digits";
import { getPieceState } from "../lib/puzzleState";
import PiecePreview from "./PiecePreview";

export default function PieceTray({ placements, locked, selectedDigit, onPiecePointerDown, onSelect }) {
  return (
    <section className="panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="section-title">Piece Tray</h2>
        <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">0-9</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {DIGIT_ORDER.map((digit) => {
          const state = getPieceState(digit, placements, locked);
          return (
            <button
              key={digit}
              type="button"
              onPointerDown={(event) => onPiecePointerDown(event, digit)}
              onClick={() => onSelect(digit)}
              className={`flex touch-none items-center gap-3 rounded-md border p-3 text-left transition ${
                selectedDigit === digit ? "border-cyan-300 bg-cyan-300/10" : "border-slate-700 bg-slate-900/70 hover:border-slate-500"
              }`}
            >
              <PiecePreview digit={digit} faded={state !== "Available"} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-white">Digit {digit}</span>
                <span className="block text-xs text-slate-400">{EXPECTED_CELL_COUNTS[digit]} cells</span>
              </span>
              <span
                className={`rounded px-2 py-1 text-[11px] font-bold ${
                  state === "Locked" ? "bg-amber-400 text-slate-950" : state === "Placed" ? "bg-emerald-400 text-slate-950" : "bg-slate-700 text-slate-200"
                }`}
              >
                {state}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
