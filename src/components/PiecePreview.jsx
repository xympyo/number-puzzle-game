import { DIGIT_COLORS } from "../data/digits";
import { DIGIT_SHAPES } from "../lib/geometry";

export default function PiecePreview({ digit, orientationIndex = 0, size = 16, faded = false }) {
  const shape = DIGIT_SHAPES[digit][orientationIndex] ?? DIGIT_SHAPES[digit][0];
  return (
    <div
      className="relative grid"
      style={{
        gridTemplateColumns: `repeat(${shape.width}, ${size}px)`,
        gridTemplateRows: `repeat(${shape.height}, ${size}px)`,
        opacity: faded ? 0.45 : 1,
      }}
      aria-label={`Digit ${digit} shape`}
    >
      {Array.from({ length: shape.width * shape.height }).map((_, index) => {
        const x = index % shape.width;
        const y = Math.floor(index / shape.width);
        const filled = shape.cells.some((cell) => cell.x === x && cell.y === y);
        return (
          <div
            key={`${x}-${y}`}
            className="rounded-[3px]"
            style={{
              width: size,
              height: size,
              background: filled ? DIGIT_COLORS[digit] : "transparent",
              border: filled ? "1px solid rgba(255,255,255,.45)" : "1px solid transparent",
              boxShadow: filled ? "0 0 10px rgba(255,255,255,.08)" : "none",
            }}
          />
        );
      })}
      <span className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] font-black text-slate-950">
        {digit}
      </span>
    </div>
  );
}
