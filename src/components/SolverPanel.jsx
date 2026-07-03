import { Pause, Play, Search, ShieldCheck } from "lucide-react";
import { EMPTY_CELLS_WHEN_COMPLETE, TOTAL_BOARD_CELLS } from "../data/digits";
import { placedCount } from "../lib/puzzleState";

export default function SolverPanel({
  placements,
  valid,
  completableStatus,
  search,
  onSolveFirst,
  onSolveAll,
  onCheck,
  onCancel,
  onContinue,
}) {
  return (
    <section className="panel">
      <h2 className="section-title mb-4">Solve Control</h2>
      <div className="grid gap-2 text-sm">
        <Metric label="Board" value="11 x 11" />
        <Metric label="Occupied by all digits" value={`${TOTAL_BOARD_CELLS - EMPTY_CELLS_WHEN_COMPLETE} cells`} />
        <Metric label="Cells remaining when complete" value={EMPTY_CELLS_WHEN_COMPLETE} />
        <Metric label="Pieces placed" value={`${placedCount(placements)} / 10`} />
        <Metric label="Current position" value={valid ? "valid" : "invalid"} tone={valid ? "good" : "bad"} />
        <Metric label="Current partial placement" value={completableStatus} />
      </div>
      <div className="mt-4 grid gap-2">
        <button className="primary-btn" type="button" onClick={onCheck} disabled={!valid || search.status === "running"}>
          <ShieldCheck size={18} /> Check if completable
        </button>
        <button className="primary-btn" type="button" onClick={onSolveFirst} disabled={!valid || search.status === "running"}>
          <Search size={18} /> Find first solution
        </button>
        <button className="primary-btn" type="button" onClick={onSolveAll} disabled={!valid || search.status === "running"}>
          <Play size={18} /> Find all solutions
        </button>
        <button className="danger-btn" type="button" onClick={onCancel} disabled={search.status !== "running"}>
          <Pause size={18} /> Cancel
        </button>
        {search.paused && (
          <button className="primary-btn" type="button" onClick={onContinue}>
            Continue searching
          </button>
        )}
      </div>
      <div className="mt-4 rounded-md bg-slate-950 p-3 text-sm">
        <Metric label="Solutions found" value={search.solutionsFound} />
        <Metric label="Search status" value={search.status} />
        <Metric label="Elapsed time" value={`${(search.elapsedMs / 1000).toFixed(2)} seconds`} />
        <Metric label="Nodes searched" value={search.nodes.toLocaleString()} />
        {search.message && <p className="mt-2 text-xs text-amber-200">{search.message}</p>}
      </div>
    </section>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800 py-1.5 last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className={tone === "good" ? "font-bold text-emerald-300" : tone === "bad" ? "font-bold text-rose-300" : "font-bold text-slate-100"}>{value}</span>
    </div>
  );
}
