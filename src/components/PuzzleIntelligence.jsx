import { DIGIT_ORDER } from "../data/digits";
import { serializePlacement } from "../lib/geometry";

export default function PuzzleIntelligence({ intelligence, heatmapEnabled, onToggleHeatmap }) {
  return (
    <section className="panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="section-title">Puzzle Intelligence</h2>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={heatmapEnabled} onChange={(event) => onToggleHeatmap(event.target.checked)} />
          Heatmap
        </label>
      </div>
      {!intelligence ? (
        <p className="text-sm text-slate-400">Run a solve to reveal forced placements, candidate frequencies, and cell coverage.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-bold text-white">Forced placements</h3>
            <div className="space-y-1 text-sm">
              {DIGIT_ORDER.map((digit) => (
                <p key={digit} className="flex justify-between gap-2 border-b border-slate-800 pb-1 text-slate-300">
                  <span>Digit {digit}</span>
                  <span className={intelligence.forced[digit] ? "text-emerald-300" : "text-slate-500"}>
                    {intelligence.forced[digit] ? "Forced in every solution" : "Flexible"}
                  </span>
                </p>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold text-white">Top placement frequencies</h3>
            <div className="max-h-44 space-y-1 overflow-auto pr-1 text-xs text-slate-300">
              {intelligence.topFrequencies.map((item) => (
                <p key={item.key} className="rounded bg-slate-900 p-2">
                  Digit {item.digit} at {serializePlacement(item.placement)} appears in {Math.round(item.frequency * 100)}% of solutions.
                </p>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Always occupied" value={intelligence.alwaysOccupied} />
            <Stat label="Always empty" value={intelligence.alwaysEmpty} />
            <Stat label="Flexible cells" value={intelligence.flexibleCells} />
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded bg-slate-900 p-2">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="text-slate-400">{label}</p>
    </div>
  );
}
