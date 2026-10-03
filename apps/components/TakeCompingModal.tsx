import React, { useState } from 'react';
import {
  X,
  Mic,
  Sparkles,
  Check,
} from 'lucide-react';

interface Take {
  id: string;
  name: string;
  color: string;
  rating: number;
  regions: { start: number; end: number; selected: boolean }[];
}

interface TakeCompingModalProps {
  trackName: string;
  onClose: () => void;
  onApplyComp: (compName: string) => void;
}

export const TakeCompingModal: React.FC<TakeCompingModalProps> = ({
  trackName,
  onClose,
  onApplyComp,
}) => {
  const [takes, setTakes] = useState<Take[]>([
    {
      id: 'take-1',
      name: 'Take 1 (Main Lead)',
      color: '#EC4899',
      rating: 4,
      regions: [
        { start: 0, end: 12, selected: true },
        { start: 12, end: 24, selected: false },
        { start: 24, end: 36, selected: false },
        { start: 36, end: 48, selected: true },
      ],
    },
    {
      id: 'take-2',
      name: 'Take 2 (High Energy)',
      color: '#A855F7',
      rating: 5,
      regions: [
        { start: 0, end: 12, selected: false },
        { start: 12, end: 24, selected: true },
        { start: 24, end: 36, selected: false },
        { start: 36, end: 48, selected: false },
      ],
    },
    {
      id: 'take-3',
      name: 'Take 3 (Smooth Vibrato)',
      color: '#00E5FF',
      rating: 5,
      regions: [
        { start: 0, end: 12, selected: false },
        { start: 12, end: 24, selected: false },
        { start: 24, end: 36, selected: true },
        { start: 36, end: 48, selected: false },
      ],
    },
  ]);

  const toggleRegion = (takeId: string, regionIndex: number) => {
    setTakes(
      takes.map((t) => ({
        ...t,
        regions: t.regions.map((r, rIdx) => {
          if (rIdx === regionIndex) {
            return { ...r, selected: t.id === takeId };
          }
          return r;
        }),
      }))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-[#10121A] border border-white/10 rounded-xl w-full max-w-5xl h-[600px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-12 bg-[#171924] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
              <Mic className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                VOCAL COMPING & TAKE LANES
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  {trackName}
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Multi-Take Comping System • Seamless Crossfade Stitching
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

        {/* Master Comp Composite Preview (Top Row) */}
        <div className="p-4 bg-[#0A0B10] border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#00E5FF] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              MASTER COMPOSITE RESULT (LIVE AUDITION)
            </span>
            <span className="text-[10px] font-mono text-slate-400">4 Stitched Phrases</span>
          </div>

          <div className="h-12 bg-[#141622] rounded-lg border border-white/10 p-1 flex gap-1">
            {[0, 1, 2, 3].map((phraseIdx) => {
              const activeTake = takes.find((t) => t.regions[phraseIdx]?.selected);
              return (
                <div
                  key={phraseIdx}
                  className="flex-1 rounded flex items-center justify-center text-xs font-bold font-mono transition-all"
                  style={{
                    backgroundColor: activeTake ? `${activeTake.color}30` : '#1A1D2C',
                    border: activeTake ? `1px solid ${activeTake.color}` : '1px dashed rgba(255,255,255,0.1)',
                    color: activeTake ? activeTake.color : '#64748B',
                  }}
                >
                  {activeTake ? `${activeTake.name.split(' ')[0]} (Phrase ${phraseIdx + 1})` : 'Empty'}
                </div>
              );
            })}
          </div>
        </div>

        {/* Multi-Take Lanes */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#08090E]">
          {takes.map((take) => (
            <div
              key={take.id}
              className="bg-[#12141D] border border-white/[0.08] rounded-lg p-3 hover:border-white/20 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: take.color }}
                  />
                  <span className="text-xs font-bold text-slate-200">{take.name}</span>
                </div>
                <div className="flex items-center space-x-3 text-xs font-mono text-slate-400">
                  <span>Rating: {'★'.repeat(take.rating)}</span>
                </div>
              </div>

              {/* Take Phrase Region Selectors */}
              <div className="grid grid-cols-4 gap-2">
                {take.regions.map((region, rIdx) => (
                  <button
                    key={rIdx}
                    onClick={() => toggleRegion(take.id, rIdx)}
                    className={`h-12 rounded-lg border p-2 flex flex-col justify-between text-left transition-all ${
                      region.selected
                        ? 'bg-white/10 border-white text-white shadow-lg'
                        : 'bg-black/30 border-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-mono">
                        {region.start}s - {region.end}s
                      </span>
                      {region.selected && (
                        <Check className="w-3 h-3 text-[#00E5FF]" />
                      )}
                    </div>
                    <span className="text-[11px] font-bold truncate">
                      Phrase {rIdx + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="h-16 bg-[#151722] border-t border-white/[0.08] px-4 flex items-center justify-between shrink-0">
          <span className="text-xs font-mono text-slate-400">
            Auto-Crossfade: 12ms Equal-Power Crossfade applied at seam boundaries
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 hover:bg-white/10 rounded-lg text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onApplyComp('Master Vocal Comp');
                onClose();
              }}
              className="px-5 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90 text-white font-bold text-xs rounded-lg shadow-lg shadow-pink-500/20"
            >
              Commit Master Comp Lane
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
