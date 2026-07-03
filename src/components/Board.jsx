import { DIGIT_COLORS, BOARD_SIZE } from "../data/digits";
import { buildBoard, placementCells } from "../lib/geometry";

export default function Board({
  boardRef,
  placements,
  locked,
  selectedDigit,
  preview,
  heatmap,
  heatmapEnabled,
  onCellPointerDown,
  onSelect,
  onContextMenu,
}) {
  const board = buildBoard(placements);
  const selectedCells = selectedDigit && placements[selectedDigit] ? placementCells(placements[selectedDigit]) : [];
  const previewCells = preview?.placement ? placementCells(preview.placement) : [];

  return (
    <section className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[min(86vw,680px)] items-center justify-between px-1">
        <h2 className="section-title">11 x 11 Board</h2>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-3 w-3 rounded-sm bg-emerald-400/70" /> valid
          <span className="h-3 w-3 rounded-sm bg-rose-500/70" /> invalid
        </div>
      </div>
      <div
        ref={boardRef}
        onContextMenu={onContextMenu}
        className="board-grid relative grid aspect-square w-full max-w-[min(86vw,680px)] touch-none select-none overflow-hidden rounded-md border border-slate-500 bg-slate-950 shadow-2xl shadow-cyan-950/30"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
      >
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, index) => {
          const x = index % BOARD_SIZE;
          const y = Math.floor(index / BOARD_SIZE);
          const digit = board[y][x];
          const isSelected = selectedCells.some((cell) => cell.x === x && cell.y === y);
          const previewHit = previewCells.some((cell) => cell.x === x && cell.y === y);
          const heat = heatmapEnabled ? heatmap?.[index] : null;
          return (
            <button
              key={`${x}-${y}`}
              type="button"
              onPointerDown={(event) => onCellPointerDown(event, x, y, digit)}
              onClick={() => digit && onSelect(digit)}
              className={`relative border border-slate-800/90 ${isSelected ? "z-10 ring-2 ring-white" : ""}`}
              style={{
                background: digit ? DIGIT_COLORS[digit] : heatmapEnabled && heat != null ? heatColor(heat) : "rgba(15,23,42,.76)",
              }}
              aria-label={digit ? `Digit ${digit} cell` : "Empty cell"}
            >
              {digit && (
                <span className="absolute inset-0 grid place-items-center text-[clamp(10px,1.9vw,18px)] font-black text-slate-950">
                  {digit}
                </span>
              )}
              {digit && locked[digit] && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-slate-950" />}
              {previewHit && (
                <span
                  className={`absolute inset-0 ${preview.valid ? "bg-emerald-300/55" : "bg-rose-500/60"} ring-1 ${
                    preview.valid ? "ring-emerald-100" : "ring-rose-100"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function heatColor(value) {
  if (value === 0) return "rgba(15,23,42,.92)";
  if (value === 1) return "rgba(250,204,21,.72)";
  return `rgba(34,211,238,${0.12 + value * 0.56})`;
}
