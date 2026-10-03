import React from 'react';
import {
  X,
  History,
  RotateCcw,
  RotateCw,
  Scissors,
  MoveHorizontal,
  Trash2,
  Sliders,
  CheckCircle,
} from 'lucide-react';

interface HistoryModalProps {
  undoStackLength: number;
  redoStackLength: number;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  undoStackLength,
  redoStackLength,
  onClose,
  onUndo,
  onRedo,
}) => {
  // Demo history events matching project lifecycle
  const historyEntries = [
    { id: 'h-1', title: 'Initialize 7-Track Demo Project', time: '10:55:02 AM', icon: CheckCircle, category: 'System' },
    { id: 'h-2', title: 'Adjust Synth Pad Spline Automation Keyframe', time: '10:56:14 AM', icon: Sliders, category: 'Automation' },
    { id: 'h-3', title: 'Split Vocal Take 01 at 00:00:42:17', time: '10:57:30 AM', icon: Scissors, category: 'Edit' },
    { id: 'h-4', title: 'Move Guitar Riff Clip to Bar 5', time: '10:58:05 AM', icon: MoveHorizontal, category: 'Timeline' },
    { id: 'h-5', title: 'Ripple Delete Lead Vocal Take Silence Region', time: '10:58:45 AM', icon: Trash2, category: 'Edit' },
    { id: 'h-6', title: 'Apply Demucs AI 4-Stem Separation', time: '11:00:12 AM', icon: CheckCircle, category: 'AI Lab' },
    { id: 'h-7', title: 'Enable Master Brickwall Limiter (-1.0 dBTP)', time: '11:02:18 AM', icon: Sliders, category: 'Mastering' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-[#10121A] border border-white/10 rounded-xl w-full max-w-2xl h-[520px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-12 bg-[#171924] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <History className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                VISUAL EDIT HISTORY & UNDO TREE
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Reversible Command History • Non-Destructive State Snapshots
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="h-11 bg-[#131520] border-b border-white/5 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={onUndo}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#00E5FF]" />
              Undo (Ctrl+Z)
            </button>
            <button
              onClick={onRedo}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5 text-[#00E5FF]" />
              Redo (Ctrl+Y)
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-400">
            Current History: {historyEntries.length} items (Undo {undoStackLength} / Redo {redoStackLength})
          </span>
        </div>

        {/* History List */}
        <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-[#08090E]">
          {historyEntries.map((entry, idx) => {
            const Icon = entry.icon;
            const isCurrent = idx === historyEntries.length - 1;

            return (
              <div
                key={entry.id}
                className={`p-3 rounded-lg border flex items-center justify-between transition-all ${
                  isCurrent
                    ? 'bg-purple-500/15 border-purple-500/40 text-white shadow-md'
                    : 'bg-[#12141F] border-white/5 text-slate-300 hover:border-white/15'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isCurrent
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold flex items-center gap-2">
                      <span>{entry.title}</span>
                      {isCurrent && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-200">
                          HEAD
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {entry.category} • {entry.time}
                    </span>
                  </div>
                </div>

                <button
                  onClick={onUndo}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white"
                >
                  Rollback to Here
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="h-12 bg-[#171924] border-t border-white/[0.08] px-4 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#00E5FF] hover:bg-[#00B0FF] text-black font-bold text-xs rounded-lg shadow-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
