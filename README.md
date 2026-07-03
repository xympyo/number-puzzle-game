# Number Puzzle Game

A polished client-side 11 x 11 digit block puzzle solver built with React, Vite,
JavaScript, and Tailwind CSS.

## Run locally

```bash
npm install
npm run dev
```

## What it does

- Drag digit-shaped pieces `0` through `9` onto an 11 x 11 board.
- Rotate pieces in 90 degree increments without mirror flipping.
- Lock placements, undo/redo edits, clear the board, and reset the puzzle.
- Solve from any valid partial board using a Web Worker.
- Stream solution batches, browse thumbnails, apply solutions, and export JSON.
- Show puzzle intelligence after solving: forced placements, position frequency,
  and cell heatmap coverage.

All ten digit pieces occupy 104 cells total, so every complete layout leaves
exactly 17 board cells empty.

## Verification

```bash
npm run test
npm run lint
npm run build
```
