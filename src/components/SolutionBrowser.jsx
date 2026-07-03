import { Download, Grid2X2, List, SkipBack, SkipForward } from "lucide-react";
import { useMemo, useState } from "react";
import SolutionThumbnail from "./SolutionThumbnail";

export default function SolutionBrowser({ solutions, activeIndex, lockedCount, onPreview, onApply, onExport }) {
  const [view, setView] = useState("grid");
  const visible = useMemo(() => solutions.slice(0, 400), [solutions]);

  return (
    <section className="panel min-h-[360px]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="section-title">Solutions</h2>
        <div className="flex gap-1">
          <button className="icon-btn" type="button" onClick={() => setView("grid")} title="Grid view">
            <Grid2X2 size={16} />
          </button>
          <button className="icon-btn" type="button" onClick={() => setView("list")} title="List view">
            <List size={16} />
          </button>
          <button className="icon-btn" type="button" onClick={onExport} disabled={!solutions.length} title="Export JSON">
            <Download size={16} />
          </button>
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between rounded bg-slate-900 p-2 text-sm text-slate-300">
        <button className="icon-btn" type="button" onClick={() => onPreview(Math.max(0, activeIndex - 1))} disabled={!solutions.length}>
          <SkipBack size={16} />
        </button>
        <span>{solutions.length ? `${activeIndex + 1} / ${solutions.length}` : "No solutions yet"}</span>
        <button className="icon-btn" type="button" onClick={() => onPreview(Math.min(solutions.length - 1, activeIndex + 1))} disabled={!solutions.length}>
          <SkipForward size={16} />
        </button>
      </div>
      {solutions.length > 400 && <p className="mb-2 text-xs text-amber-200">Showing first 400 cards for browser responsiveness. Export includes all loaded results.</p>}
      <div className={view === "grid" ? "grid max-h-[520px] grid-cols-2 gap-3 overflow-auto pr-1" : "max-h-[520px] space-y-2 overflow-auto pr-1"}>
        {visible.map((solution, index) => (
          <article key={index} className="rounded-md border border-slate-700 bg-slate-900/80 p-2">
            <div className={view === "grid" ? "space-y-2" : "flex gap-3"}>
              <SolutionThumbnail solution={solution} selected={index === activeIndex} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">Solution {index + 1}</p>
                <p className="text-xs text-slate-400">{lockedCount} locked placements respected</p>
                <div className="mt-2 flex gap-2">
                  <button className="mini-btn" type="button" onClick={() => onPreview(index)}>
                    Preview
                  </button>
                  <button className="mini-btn" type="button" onClick={() => onApply(index)}>
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
