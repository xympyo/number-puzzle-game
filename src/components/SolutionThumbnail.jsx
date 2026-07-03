import { BOARD_SIZE, DIGIT_COLORS } from "../data/digits";
import { buildBoard } from "../lib/geometry";

export default function SolutionThumbnail({ solution, selected = false }) {
  const board = buildBoard(solution ?? {});
  return (
    <div
      className={`grid aspect-square w-24 overflow-hidden rounded border ${selected ? "border-cyan-200" : "border-slate-700"}`}
      style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
    >
      {board.flatMap((row, y) =>
        row.map((digit, x) => (
          <span
            key={`${x}-${y}`}
            className="border border-slate-950/40"
            style={{ background: digit ? DIGIT_COLORS[digit] : "rgba(15,23,42,.95)" }}
          />
        )),
      )}
    </div>
  );
}
