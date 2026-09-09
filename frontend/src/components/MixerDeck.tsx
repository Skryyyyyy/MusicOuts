import React, { useEffect, useState } from 'react';
import { Sliders, Disc, Radio } from 'lucide-react';
import { STEM_TYPES, StemState, StemType } from '../types';
import { AudioGraphEngine } from '../engine/audioGraph';

export interface MixerDeckProps {
  audioGraph: AudioGraphEngine | null;
  stemStates: Record<StemType, StemState>;
  masterVolume: number;
  djFilterCutoff: number;
  djFilterType: 'lowpass' | 'highpass';
  djFilterQ?: number;
  onStemVolumeChange: (stem: StemType, volume: number) => void;
  onStemMuteToggle: (stem: StemType) => void;
  onStemSoloToggle: (stem: StemType) => void;
  onStemPanChange: (stem: StemType, pan: number) => void;
  onMasterVolumeChange: (volume: number) => void;
  onDjFilterChange?: (cutoff: number, type: 'lowpass' | 'highpass', Q?: number) => void;
  className?: string;
}

const STEM_CONFIG: Record<
  StemType,
  {
    name: string;
    text: string;
    border: string;
    bg: string;
    glow: string;
    accent: string;
    lightAccent: string;
  }
> = {
  vocals: {
    name: 'Vocals',
    text: 'text-neon-cyan',
    border: 'border-neon-cyan/40',
    bg: 'bg-cyan-500/10',
    glow: 'shadow-neon-cyan',
    accent: '#00f3ff',
    lightAccent: '#70f8ff',
  },
  drums: {
    name: 'Drums',
    text: 'text-neon-magenta',
    border: 'border-neon-magenta/40',
    bg: 'bg-pink-500/10',
    glow: 'shadow-neon-magenta',
    accent: '#ff007f',
    lightAccent: '#ff66b2',
  },
  bass: {
    name: 'Bass',
    text: 'text-neon-yellow',
    border: 'border-neon-yellow/40',
    bg: 'bg-yellow-500/10',
    glow: 'shadow-neon-yellow',
    accent: '#ffe600',
    lightAccent: '#fff066',
  },
  other: {
    name: 'Other',
    text: 'text-neon-green',
    border: 'border-neon-green/40',
    bg: 'bg-emerald-500/10',
    glow: 'shadow-neon-green',
    accent: '#00ff66',
    lightAccent: '#66ffaa',
  },
};

export const MixerDeck: React.FC<MixerDeckProps> = ({
  audioGraph,
  stemStates,
  masterVolume,
  djFilterCutoff,
  djFilterType,
  djFilterQ = 1.0,
  onStemVolumeChange,
  onStemMuteToggle,
  onStemSoloToggle,
  onStemPanChange,
  onMasterVolumeChange,
  onDjFilterChange,
  className = '',
}) => {
  // Real-time VU meter values (0 to 100%)
  const [vuLevels, setVuLevels] = useState<Record<StemType, number>>({
    vocals: 0,
    drums: 0,
    bass: 0,
    other: 0,
  });
  const [masterVu, setMasterVu] = useState<number>(0);

  // Animation frame loop for VU meters
  useEffect(() => {
    let animId: number;

    const updateMeters = () => {
      if (audioGraph && audioGraph.isPlaying()) {
        const nextVu: Record<StemType, number> = {
          vocals: 0,
          drums: 0,
          bass: 0,
          other: 0,
        };

        for (const stem of STEM_TYPES) {
          const freqData = audioGraph.getFrequencyData(stem);
          let sum = 0;
          const count = Math.min(freqData.length, 128);
          for (let i = 0; i < count; i++) {
            sum += freqData[i];
          }
          const avg = sum / (count * 255);
          // Scale non-linearly for musical response
          const level = Math.min(100, Math.round(Math.pow(avg, 0.8) * 100));
          nextVu[stem] = stemStates[stem].muted ? 0 : level;
        }

        const masterFreq = audioGraph.getFrequencyData();
        let mSum = 0;
        const mCount = Math.min(masterFreq.length, 128);
        for (let i = 0; i < mCount; i++) {
          mSum += masterFreq[i];
        }
        const mAvg = mSum / (mCount * 255);
        setMasterVu(Math.min(100, Math.round(Math.pow(mAvg, 0.8) * 100)));
        setVuLevels(nextVu);
      } else {
        setVuLevels((prev) => {
          let hasNonZero = false;
          const decay: Record<StemType, number> = { ...prev };
          for (const s of STEM_TYPES) {
            if (decay[s] > 0) {
              decay[s] = Math.max(0, decay[s] - 4);
              hasNonZero = true;
            }
          }
          return hasNonZero ? decay : prev;
        });
        setMasterVu((prev) => Math.max(0, prev - 4));
      }

      animId = requestAnimationFrame(updateMeters);
    };

    animId = requestAnimationFrame(updateMeters);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [audioGraph, stemStates]);

  const formatDb = (volume: number): string => {
    if (volume <= 0.001) return '-inf dB';
    const db = 20 * Math.log10(volume);
    return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
  };

  const formatPan = (pan: number): string => {
    if (Math.abs(pan) < 0.05) return 'C';
    if (pan < 0) return `L${Math.round(Math.abs(pan) * 100)}`;
    return `R${Math.round(pan * 100)}`;
  };

  return (
    <div className={`bg-deck-card border border-deck-border rounded-xl p-5 shadow-2xl flex flex-col ${className}`}>
      {/* Deck Header */}
      <div className="flex items-center justify-between pb-4 border-b border-deck-border mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 border border-neon-cyan/40 flex items-center justify-center shadow-neon-cyan/20 shadow-md">
            <Sliders className="w-4 h-4 text-neon-cyan" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold tracking-wider text-slate-100 uppercase font-mono">
              4-Channel Stem Mixer Deck
            </h2>
            <p className="text-[10px] text-slate-400 font-mono">
              Independent Gain, Stereo Panning, Solo/Mute & Master DSP
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-deck-dark rounded-md border border-deck-border">
            <Radio className="w-3.5 h-3.5 text-neon-cyan animate-pulse" />
            <span>32-bit Float DSP</span>
          </div>
        </div>
      </div>

      {/* Main Channel Strips (4 Stems + 1 Master Strip) */}
      <div className="grid grid-cols-5 gap-3 flex-1">
        {/* 4 Stems Channels */}
        {STEM_TYPES.map((stem) => {
          const cfg = STEM_CONFIG[stem];
          const state = stemStates[stem];
          const vu = vuLevels[stem];

          return (
            <div
              key={stem}
              className={`bg-deck-dark/90 rounded-xl p-3 border ${cfg.border} flex flex-col items-center justify-between transition-all duration-150 hover:border-opacity-100 shadow-lg relative group`}
            >
              {/* Channel Strip Header */}
              <div className="text-center w-full pb-2 border-b border-deck-border/60">
                <span className={`text-xs font-black uppercase tracking-wider ${cfg.text} block`}>
                  {cfg.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono font-medium">
                  {formatDb(state.volume)}
                </span>
              </div>

              {/* Pan Controller Slider */}
              <div className="w-full my-2 px-1">
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mb-1">
                  <span>PAN</span>
                  <span className={state.pan !== 0 ? 'text-slate-200 font-bold' : 'text-slate-500'}>
                    {formatPan(state.pan)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-1.0"
                  max="1.0"
                  step="0.05"
                  value={state.pan}
                  onChange={(e) => onStemPanChange(stem, parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-300"
                />
              </div>

              {/* Fader & VU Meter Section */}
              <div className="flex-1 flex items-center justify-center space-x-2 my-2 w-full">
                {/* Real-time LED VU Meter Bar */}
                <div className="h-44 w-3 bg-slate-950 rounded-full p-0.5 flex flex-col justify-end border border-deck-border/80 overflow-hidden relative">
                  {/* Peak Marker Line */}
                  <div
                    className="w-full rounded-full transition-all duration-75"
                    style={{
                      height: `${vu}%`,
                      backgroundColor:
                        vu > 90 ? '#ff0055' : vu > 75 ? '#ffe600' : cfg.accent,
                      boxShadow: `0 0 8px ${cfg.accent}`,
                    }}
                  />
                </div>

                {/* Vertical Fader Track */}
                <div className="h-44 w-7 bg-slate-950 rounded-lg p-1 flex flex-col justify-end border border-deck-border relative">
                  {/* Fader background scale ticks */}
                  <div className="absolute inset-y-2 left-1 flex flex-col justify-between pointer-events-none opacity-20">
                    <span className="w-1 h-0.5 bg-slate-400" />
                    <span className="w-1 h-0.5 bg-slate-400" />
                    <span className="w-1.5 h-0.5 bg-white" />
                    <span className="w-1 h-0.5 bg-slate-400" />
                    <span className="w-1 h-0.5 bg-slate-400" />
                  </div>

                  {/* Volume Level Fill */}
                  <div
                    className="w-full rounded transition-all duration-75"
                    style={{
                      height: `${Math.min(100, (state.volume / 1.5) * 100)}%`,
                      backgroundColor: state.muted ? '#334155' : cfg.accent,
                      opacity: state.muted ? 0.3 : 0.85,
                    }}
                  />

                  {/* Invisible Range Slider for Mouse Drag */}
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.01"
                    value={state.muted ? 0 : state.volume}
                    onChange={(e) => onStemVolumeChange(stem, parseFloat(e.target.value))}
                    className="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
                    title={`${cfg.name} Volume: ${(state.volume * 100).toFixed(0)}%`}
                  />
                </div>
              </div>

              {/* Solo & Mute Buttons */}
              <div className="grid grid-cols-2 gap-1.5 w-full pt-2 border-t border-deck-border/60">
                <button
                  onClick={() => onStemMuteToggle(stem)}
                  className={`py-1 text-[11px] font-mono font-black rounded border transition-all ${
                    state.muted
                      ? 'bg-red-500/20 text-red-400 border-red-500 shadow-red-500/20 shadow-md'
                      : 'bg-deck-card text-slate-400 border-deck-border hover:text-slate-200 hover:border-slate-600'
                  }`}
                  title={`Mute ${cfg.name}`}
                >
                  M
                </button>
                <button
                  onClick={() => onStemSoloToggle(stem)}
                  className={`py-1 text-[11px] font-mono font-black rounded border transition-all ${
                    state.solo
                      ? 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow shadow-neon-yellow/30 shadow-md'
                      : 'bg-deck-card text-slate-400 border-deck-border hover:text-slate-200 hover:border-slate-600'
                  }`}
                  title={`Solo ${cfg.name}`}
                >
                  S
                </button>
              </div>
            </div>
          );
        })}

        {/* 5th Strip: Master Channel */}
        <div className="bg-deck-dark/95 rounded-xl p-3 border border-slate-700 flex flex-col items-center justify-between shadow-2xl relative">
          {/* Header */}
          <div className="text-center w-full pb-2 border-b border-deck-border/60">
            <span className="text-xs font-black uppercase tracking-wider text-slate-100 block">
              MASTER
            </span>
            <span className="text-[10px] text-slate-400 font-mono font-medium">
              {formatDb(masterVolume)}
            </span>
          </div>

          <div className="w-full my-2 text-center text-[9px] font-mono text-slate-500">
            MAIN BUS
          </div>

          {/* Master Fader & Master VU */}
          <div className="flex-1 flex items-center justify-center space-x-2 my-2 w-full">
            {/* Master VU Meter */}
            <div className="h-44 w-3 bg-slate-950 rounded-full p-0.5 flex flex-col justify-end border border-deck-border/80 overflow-hidden relative">
              <div
                className="w-full rounded-full transition-all duration-75"
                style={{
                  height: `${masterVu}%`,
                  backgroundColor:
                    masterVu > 90 ? '#ff0055' : masterVu > 75 ? '#ffe600' : '#ffffff',
                  boxShadow: '0 0 8px #ffffff',
                }}
              />
            </div>

            {/* Master Fader */}
            <div className="h-44 w-7 bg-slate-950 rounded-lg p-1 flex flex-col justify-end border border-slate-700 relative">
              <div
                className="w-full rounded bg-gradient-to-t from-slate-400 to-slate-100 transition-all duration-75"
                style={{
                  height: `${Math.min(100, (masterVolume / 1.5) * 100)}%`,
                  opacity: 0.9,
                }}
              />

              <input
                type="range"
                min="0"
                max="1.5"
                step="0.01"
                value={masterVolume}
                onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
                title={`Master Volume: ${(masterVolume * 100).toFixed(0)}%`}
              />
            </div>
          </div>

          {/* Master Reset Button */}
          <div className="w-full pt-2 border-t border-deck-border/60">
            <button
              onClick={() => onMasterVolumeChange(1.0)}
              className="w-full py-1 text-[10px] font-mono font-bold rounded bg-deck-card border border-deck-border text-slate-400 hover:text-slate-200"
              title="Reset Master to 0 dB"
            >
              0 dB (100%)
            </button>
          </div>
        </div>
      </div>

      {/* DJ Biquad Filter Sweep Section */}
      <div className="mt-4 pt-4 border-t border-deck-border bg-deck-dark/60 rounded-xl p-3.5 flex flex-col space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2">
            <Disc className="w-4 h-4 text-neon-magenta animate-spin" />
            <span className="text-slate-200 font-bold uppercase">DJ Biquad Filter Sweep</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded bg-deck-card border border-deck-border text-[11px] text-neon-magenta font-bold">
              {djFilterType.toUpperCase()} MODE
            </span>
            <span className="text-slate-100 font-mono font-bold">
              {(djFilterCutoff / 1000).toFixed(2)} kHz
            </span>
            <span className="text-slate-400 text-[10px]">Q: {djFilterQ.toFixed(1)}</span>
          </div>
        </div>

        {/* Filter Sweep Slider */}
        <div className="relative flex items-center space-x-3">
          <span className="text-[10px] font-mono text-neon-cyan">20 Hz (LP)</span>
          <div className="flex-1 relative h-3 bg-slate-900 rounded-full overflow-hidden border border-deck-border">
            <div
              className="h-full bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-yellow transition-all duration-75"
              style={{ width: `${Math.max(2, (djFilterCutoff / 20000) * 100)}%` }}
            />
            <input
              type="range"
              min="20"
              max="20000"
              step="20"
              value={djFilterCutoff}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                const type = val < 5000 ? 'lowpass' : djFilterType;
                if (onDjFilterChange) {
                  onDjFilterChange(val, type, djFilterQ);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
          <span className="text-[10px] font-mono text-neon-yellow">20 kHz (Bypass)</span>
        </div>
      </div>
    </div>
  );
};

export default MixerDeck;
