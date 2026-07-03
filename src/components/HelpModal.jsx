import { X } from "lucide-react";

export default function HelpModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4">
      <section className="w-full max-w-lg rounded-md border border-slate-600 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black text-white">How to use</h2>
          <button className="icon-btn" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 text-sm leading-6 text-slate-300">
          <p>Drag a digit from the tray onto the board. Existing unlocked pieces can be dragged again to reposition them.</p>
          <p>Use R, the rotate buttons, or right-click to rotate the selected piece. Only rotations are allowed; mirror flips are never generated.</p>
          <p>Lock a piece to protect a placement while experimenting. The solver treats every currently placed digit as fixed, locked or not.</p>
          <p>Use the checker for a quick completion test, or run all solutions to stream every arrangement up to the safety limit.</p>
        </div>
      </section>
    </div>
  );
}
