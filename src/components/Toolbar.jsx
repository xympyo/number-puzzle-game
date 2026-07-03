import { HelpCircle, Lock, RotateCcw, RotateCw, Trash2, Undo2, Unlock } from "lucide-react";

export default function Toolbar({
  selectedDigit,
  selectedLocked,
  canUndo,
  canRedo,
  onRotateLeft,
  onRotateRight,
  onLock,
  onUnlock,
  onUndo,
  onRedo,
  onClear,
  onReset,
  onHelp,
}) {
  return (
    <section className="panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="section-title">Tools</h2>
        <button className="icon-btn" type="button" onClick={onHelp} title="How to use">
          <HelpCircle size={18} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="action-btn" type="button" onClick={onRotateLeft} disabled={!selectedDigit} title="Rotate left">
          <RotateCcw size={17} /> Left
        </button>
        <button className="action-btn" type="button" onClick={onRotateRight} disabled={!selectedDigit} title="Rotate right">
          <RotateCw size={17} /> Right
        </button>
        <button className="action-btn" type="button" onClick={onLock} disabled={!selectedDigit || selectedLocked}>
          <Lock size={17} /> Lock
        </button>
        <button className="action-btn" type="button" onClick={onUnlock} disabled={!selectedDigit || !selectedLocked}>
          <Unlock size={17} /> Unlock
        </button>
        <button className="action-btn" type="button" onClick={onUndo} disabled={!canUndo}>
          <Undo2 size={17} /> Undo
        </button>
        <button className="action-btn" type="button" onClick={onRedo} disabled={!canRedo}>
          <Undo2 className="rotate-180" size={17} /> Redo
        </button>
        <button className="action-btn" type="button" onClick={onClear}>
          <Trash2 size={17} /> Clear
        </button>
        <button className="action-btn" type="button" onClick={onReset}>
          Reset
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-400">Selected: {selectedDigit ? `Digit ${selectedDigit}` : "none"}</p>
    </section>
  );
}
