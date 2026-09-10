import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Power,
  Sparkles,
  Waves,
  Zap,
  Activity,
  RotateCcw,
  Volume2,
  Mic,
  Disc,
  Music,
  Radio,
} from 'lucide-react';
import { AudioGraphEngine } from '../../engine/audioGraph';
import {
  StemType,
  STEM_TYPES,
  StemFxState,
  FxRackState,
  DEFAULT_FX_RACK_STATE,
} from '../../types';

export interface FxRackViewProps {
  audioGraph: AudioGraphEngine | null;
  fxRackState: FxRackState;
  onFxChange: (stem: StemType, newFxState: StemFxState) => void;
  className?: string;
}

const STEM_ICONS: Record<StemType, React.ReactNode> = {
  vocals: <Mic className="w-4 h-4 text-cyan-400" />,
  drums: <Disc className="w-4 h-4 text-orange-400" />,
  bass: <Music className="w-4 h-4 text-purple-400" />,
  other: <Radio className="w-4 h-4 text-emerald-400" />,
};

const STEM_COLORS: Record<StemType, { border: string; text: string; bg: string; accent: string }> = {
  vocals: { border: 'border-cyan-500/40', text: 'text-cyan-400', bg: 'bg-cyan-500/15', accent: '#00e5ff' },
  drums: { border: 'border-orange-500/40', text: 'text-orange-400', bg: 'bg-orange-500/15', accent: '#ff5722' },
  bass: { border: 'border-purple-500/40', text: 'text-purple-400', bg: 'bg-purple-500/15', accent: '#a855f7' },
  other: { border: 'border-emerald-500/40', text: 'text-emerald-400', bg: 'bg-emerald-500/15', accent: '#10b981' },
};

export const FxRackView: React.FC<FxRackViewProps> = ({
  audioGraph,
  fxRackState,
  onFxChange,
  className = '',
}) => {
  const [selectedStem, setSelectedStem] = useState<StemType>('vocals');
  const [compReduction, setCompReduction] = useState<number>(0);

  const currentFx = fxRackState[selectedStem] || DEFAULT_FX_RACK_STATE[selectedStem];

  // Poll compressor gain reduction meter
  useEffect(() => {
    let animId: number;
    const updateMeter = () => {
      if (audioGraph) {
        const red = audioGraph.getCompressorGainReduction(selectedStem);
        setCompReduction(red);
      }
      animId = requestAnimationFrame(updateMeter);
    };
    animId = requestAnimationFrame(updateMeter);
    return () => cancelAnimationFrame(animId);
  }, [audioGraph, selectedStem]);

  const updateStemFx = (updater: (prev: StemFxState) => StemFxState) => {
    const updated = updater(currentFx);
    onFxChange(selectedStem, updated);
    if (audioGraph) {
      audioGraph.setStemFxRackState(selectedStem, updated);
    }
  };

  const resetStemFx = () => {
    const defaultFx = JSON.parse(JSON.stringify(DEFAULT_FX_RACK_STATE[selectedStem]));
    onFxChange(selectedStem, defaultFx);
    if (audioGraph) {
      audioGraph.setStemFxRackState(selectedStem, defaultFx);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[#0b0c10] rounded-2xl border border-white/[0.08] shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl overflow-hidden select-none text-zinc-300 font-mono ${className}`}>
      {/* Header & Stem Tabs - Splice Glass Capsule Header */}
      <div className="h-14 px-5 bg-gradient-to-r from-[#14161f]/95 via-[#161822]/90 to-[#14161f]/95 border-b border-white/[0.06] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.2)]">
            <Sliders className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-extrabold text-xs tracking-wider uppercase text-white font-sans">
                Splice FX Rack
              </h2>
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-mono text-cyan-300 font-bold">
                32-BIT DSP
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 block -mt-0.5">
              Studio Stem Dynamic &amp; Spatial Inserts
            </span>
          </div>
        </div>

        {/* Stem Switcher Pill Capsule */}
        <div className="flex items-center space-x-1.5 bg-[#0b0c12]/90 p-1 rounded-full border border-white/[0.08] shadow-inner">
          {STEM_TYPES.map((stem) => {
            const isSelected = selectedStem === stem;
            return (
              <button
                key={stem}
                onClick={() => setSelectedStem(stem)}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 ${
                  isSelected
                    ? `${STEM_COLORS[stem].bg} ${STEM_COLORS[stem].text} border ${STEM_COLORS[stem].border} shadow-[0_0_12px_rgba(0,0,0,0.5)]`
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
              >
                {STEM_ICONS[stem]}
                <span className="capitalize">{stem}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={resetStemFx}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white rounded-full border border-white/[0.08] text-xs transition-all active:scale-95 shadow-sm"
          title="Reset current stem effects to defaults"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-bold">Reset FX</span>
        </button>
      </div>

      {/* Main FX Insert Grid */}
      <div className="flex-1 p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 bg-gradient-to-b from-[#0b0c10] to-[#08090c]">
        {/* 1. 3-BAND EQ */}
        <div
          className={`bg-gradient-to-b from-[#14161f]/90 to-[#101118]/90 border rounded-2xl p-4 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-200 relative ${
            currentFx.eq.enabled ? 'border-cyan-500/40 shadow-[0_0_20px_rgba(0,229,255,0.1)]' : 'border-white/[0.06] opacity-75'
          }`}
        >
          <div className="absolute top-0 left-6 right-6 h-[2px] bg-cyan-400/60 rounded-b-full" />
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-3.5">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="font-extrabold text-xs uppercase text-white tracking-wider font-sans">3-Band EQ</span>
              </div>
              <button
                onClick={() =>
                  updateStemFx((prev) => ({
                    ...prev,
                    eq: { ...prev.eq, enabled: !prev.eq.enabled },
                  }))
                }
                className={`p-1.5 rounded-full transition-all active:scale-90 ${
                  currentFx.eq.enabled
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                    : 'bg-white/[0.04] text-zinc-500 border border-white/[0.06]'
                }`}
                title="Bypass EQ"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* EQ Controls */}
            <div className="flex flex-col gap-3 text-[11px]">
              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>Low Shelf (100Hz)</span>
                  <span className="text-cyan-300 font-bold">{currentFx.eq.lowGain > 0 ? `+${currentFx.eq.lowGain}` : currentFx.eq.lowGain} dB</span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  disabled={!currentFx.eq.enabled}
                  value={currentFx.eq.lowGain}
                  onChange={(e) => {
                    const lowGain = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, eq: { ...prev.eq, lowGain } }));
                  }}
                  className="w-full accent-cyan-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>

              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>Mid Bell (1kHz)</span>
                  <span className="text-cyan-300 font-bold">{currentFx.eq.midGain > 0 ? `+${currentFx.eq.midGain}` : currentFx.eq.midGain} dB</span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  disabled={!currentFx.eq.enabled}
                  value={currentFx.eq.midGain}
                  onChange={(e) => {
                    const midGain = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, eq: { ...prev.eq, midGain } }));
                  }}
                  className="w-full accent-cyan-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>

              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>High Shelf (8kHz)</span>
                  <span className="text-cyan-300 font-bold">{currentFx.eq.highGain > 0 ? `+${currentFx.eq.highGain}` : currentFx.eq.highGain} dB</span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  disabled={!currentFx.eq.enabled}
                  value={currentFx.eq.highGain}
                  onChange={(e) => {
                    const highGain = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, eq: { ...prev.eq, highGain } }));
                  }}
                  className="w-full accent-cyan-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2.5 border-t border-white/[0.06] flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>Low: 100Hz</span>
            <span>Mid: 1.0k</span>
            <span>Hi: 8.0k</span>
          </div>
        </div>

        {/* 2. DYNAMICS COMPRESSOR */}
        <div
          className={`bg-gradient-to-b from-[#14161f]/90 to-[#101118]/90 border rounded-2xl p-4 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-200 relative ${
            currentFx.compressor.enabled
              ? 'border-orange-500/40 shadow-[0_0_20px_rgba(255,87,34,0.1)]'
              : 'border-white/[0.06] opacity-75'
          }`}
        >
          <div className="absolute top-0 left-6 right-6 h-[2px] bg-orange-400/60 rounded-b-full" />
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-3.5">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-orange-400" />
                <span className="font-extrabold text-xs uppercase text-white tracking-wider font-sans">Compressor</span>
              </div>
              <button
                onClick={() =>
                  updateStemFx((prev) => ({
                    ...prev,
                    compressor: { ...prev.compressor, enabled: !prev.compressor.enabled },
                  }))
                }
                className={`p-1.5 rounded-full transition-all active:scale-90 ${
                  currentFx.compressor.enabled
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/50 shadow-[0_0_10px_rgba(255,87,34,0.4)]'
                    : 'bg-white/[0.04] text-zinc-500 border border-white/[0.06]'
                }`}
                title="Bypass Compressor"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Compressor Controls */}
            <div className="flex flex-col gap-3 text-[11px]">
              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>Threshold</span>
                  <span className="text-orange-300 font-bold">{currentFx.compressor.threshold} dB</span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="0"
                  step="1"
                  disabled={!currentFx.compressor.enabled}
                  value={currentFx.compressor.threshold}
                  onChange={(e) => {
                    const threshold = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, compressor: { ...prev.compressor, threshold } }));
                  }}
                  className="w-full accent-orange-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>

              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>Ratio</span>
                  <span className="text-orange-300 font-bold">{currentFx.compressor.ratio}:1</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  disabled={!currentFx.compressor.enabled}
                  value={currentFx.compressor.ratio}
                  onChange={(e) => {
                    const ratio = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, compressor: { ...prev.compressor, ratio } }));
                  }}
                  className="w-full accent-orange-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>

              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>Attack / Release</span>
                  <span className="text-orange-300 font-bold">
                    {Math.round(currentFx.compressor.attack * 1000)}ms / {Math.round(currentFx.compressor.release * 1000)}ms
                  </span>
                </div>
                <input
                  type="range"
                  min="0.005"
                  max="0.1"
                  step="0.005"
                  disabled={!currentFx.compressor.enabled}
                  value={currentFx.compressor.attack}
                  onChange={(e) => {
                    const attack = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, compressor: { ...prev.compressor, attack } }));
                  }}
                  className="w-full accent-orange-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Gain Reduction Meter */}
          <div className="mt-4 pt-2.5 border-t border-white/[0.06]">
            <div className="flex justify-between text-[10px] text-zinc-500 mb-1.5 font-mono">
              <span>Gain Reduction (GR):</span>
              <span className="text-orange-400 font-bold">
                {currentFx.compressor.enabled ? `${compReduction.toFixed(1)} dB` : 'OFF'}
              </span>
            </div>
            <div className="h-2 w-full bg-[#08090c] rounded-full overflow-hidden p-0.5 border border-white/[0.06]">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(255,87,34,0.6)]"
                style={{ width: `${Math.min(100, Math.abs(compReduction) * 5)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3. REVERB */}
        <div
          className={`bg-gradient-to-b from-[#14161f]/90 to-[#101118]/90 border rounded-2xl p-4 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-200 relative ${
            currentFx.reverb.enabled
              ? 'border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
              : 'border-white/[0.06] opacity-75'
          }`}
        >
          <div className="absolute top-0 left-6 right-6 h-[2px] bg-purple-400/60 rounded-b-full" />
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-3.5">
              <div className="flex items-center space-x-2">
                <Waves className="w-4 h-4 text-purple-400" />
                <span className="font-extrabold text-xs uppercase text-white tracking-wider font-sans">Space Reverb</span>
              </div>
              <button
                onClick={() =>
                  updateStemFx((prev) => ({
                    ...prev,
                    reverb: { ...prev.reverb, enabled: !prev.reverb.enabled },
                  }))
                }
                className={`p-1.5 rounded-full transition-all active:scale-90 ${
                  currentFx.reverb.enabled
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                    : 'bg-white/[0.04] text-zinc-500 border border-white/[0.06]'
                }`}
                title="Bypass Reverb"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Reverb Controls */}
            <div className="flex flex-col gap-3 text-[11px]">
              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>Decay Time</span>
                  <span className="text-purple-300 font-bold">{currentFx.reverb.decay.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                  disabled={!currentFx.reverb.enabled}
                  value={currentFx.reverb.decay}
                  onChange={(e) => {
                    const decay = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, reverb: { ...prev.reverb, decay } }));
                  }}
                  className="w-full accent-purple-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>

              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>Dry / Wet Mix</span>
                  <span className="text-purple-300 font-bold">{Math.round(currentFx.reverb.mix * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  disabled={!currentFx.reverb.enabled}
                  value={currentFx.reverb.mix}
                  onChange={(e) => {
                    const mix = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, reverb: { ...prev.reverb, mix } }));
                  }}
                  className="w-full accent-purple-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>

              {/* Presets */}
              <div className="flex items-center space-x-1.5 pt-1">
                {[
                  { name: 'Room', decay: 1.2, mix: 0.2 },
                  { name: 'Plate', decay: 2.2, mix: 0.35 },
                  { name: 'Hall', decay: 3.8, mix: 0.5 },
                ].map((p) => (
                  <button
                    key={p.name}
                    disabled={!currentFx.reverb.enabled}
                    onClick={() =>
                      updateStemFx((prev) => ({
                        ...prev,
                        reverb: { ...prev.reverb, decay: p.decay, mix: p.mix },
                      }))
                    }
                    className="flex-1 py-1 bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-bold rounded-lg border border-white/[0.06] text-zinc-300 hover:text-white transition-all active:scale-95"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2.5 border-t border-white/[0.06] text-[10px] text-zinc-500 font-mono">
            Algorithmic Impulse Engine
          </div>
        </div>

        {/* 4. DELAY */}
        <div
          className={`bg-gradient-to-b from-[#14161f]/90 to-[#101118]/90 border rounded-2xl p-4 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-200 relative ${
            currentFx.delay.enabled
              ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
              : 'border-white/[0.06] opacity-75'
          }`}
        >
          <div className="absolute top-0 left-6 right-6 h-[2px] bg-emerald-400/60 rounded-b-full" />
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-3.5">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="font-extrabold text-xs uppercase text-white tracking-wider font-sans">Stereo Delay</span>
              </div>
              <button
                onClick={() =>
                  updateStemFx((prev) => ({
                    ...prev,
                    delay: { ...prev.delay, enabled: !prev.delay.enabled },
                  }))
                }
                className={`p-1.5 rounded-full transition-all active:scale-90 ${
                  currentFx.delay.enabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                    : 'bg-white/[0.04] text-zinc-500 border border-white/[0.06]'
                }`}
                title="Bypass Delay"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Delay Controls */}
            <div className="flex flex-col gap-3 text-[11px]">
              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>Delay Time</span>
                  <span className="text-emerald-300 font-bold">{Math.round(currentFx.delay.time * 1000)} ms</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.025"
                  disabled={!currentFx.delay.enabled}
                  value={currentFx.delay.time}
                  onChange={(e) => {
                    const time = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, delay: { ...prev.delay, time } }));
                  }}
                  className="w-full accent-emerald-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>

              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>Feedback</span>
                  <span className="text-emerald-300 font-bold">{Math.round(currentFx.delay.feedback * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.85"
                  step="0.05"
                  disabled={!currentFx.delay.enabled}
                  value={currentFx.delay.feedback}
                  onChange={(e) => {
                    const feedback = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, delay: { ...prev.delay, feedback } }));
                  }}
                  className="w-full accent-emerald-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>

              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>Dry / Wet Mix</span>
                  <span className="text-emerald-300 font-bold">{Math.round(currentFx.delay.mix * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  disabled={!currentFx.delay.enabled}
                  value={currentFx.delay.mix}
                  onChange={(e) => {
                    const mix = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, delay: { ...prev.delay, mix } }));
                  }}
                  className="w-full accent-emerald-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2.5 border-t border-white/[0.06] text-[10px] text-zinc-500 font-mono">
            Tempo Synced Ping-Pong
          </div>
        </div>

        {/* 5. SATURATION / DISTORTION */}
        <div
          className={`bg-gradient-to-b from-[#14161f]/90 to-[#101118]/90 border rounded-2xl p-4 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-200 relative ${
            currentFx.saturation.enabled
              ? 'border-pink-500/40 shadow-[0_0_20px_rgba(236,72,153,0.1)]'
              : 'border-white/[0.06] opacity-75'
          }`}
        >
          <div className="absolute top-0 left-6 right-6 h-[2px] bg-pink-400/60 rounded-b-full" />
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-3.5">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-pink-400" />
                <span className="font-extrabold text-xs uppercase text-white tracking-wider font-sans">Warm Drive</span>
              </div>
              <button
                onClick={() =>
                  updateStemFx((prev) => ({
                    ...prev,
                    saturation: { ...prev.saturation, enabled: !prev.saturation.enabled },
                  }))
                }
                className={`p-1.5 rounded-full transition-all active:scale-90 ${
                  currentFx.saturation.enabled
                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/50 shadow-[0_0_10px_rgba(236,72,153,0.4)]'
                    : 'bg-white/[0.04] text-zinc-500 border border-white/[0.06]'
                }`}
                title="Bypass Saturation"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Saturation Controls */}
            <div className="flex flex-col gap-3 text-[11px]">
              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>Drive</span>
                  <span className="text-pink-300 font-bold">{Math.round(currentFx.saturation.drive * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  disabled={!currentFx.saturation.enabled}
                  value={currentFx.saturation.drive}
                  onChange={(e) => {
                    const drive = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, saturation: { ...prev.saturation, drive } }));
                  }}
                  className="w-full accent-pink-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>

              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>Harmonic Tone</span>
                  <span className="text-pink-300 font-bold">{Math.round(currentFx.saturation.tone * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  disabled={!currentFx.saturation.enabled}
                  value={currentFx.saturation.tone}
                  onChange={(e) => {
                    const tone = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, saturation: { ...prev.saturation, tone } }));
                  }}
                  className="w-full accent-pink-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>

              <div className="bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                  <span>Dry / Wet Mix</span>
                  <span className="text-pink-300 font-bold">{Math.round(currentFx.saturation.mix * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  disabled={!currentFx.saturation.enabled}
                  value={currentFx.saturation.mix}
                  onChange={(e) => {
                    const mix = parseFloat(e.target.value);
                    updateStemFx((prev) => ({ ...prev, saturation: { ...prev.saturation, mix } }));
                  }}
                  className="w-full accent-pink-400 h-1.5 bg-white/[0.08] rounded-full cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2.5 border-t border-white/[0.06] text-[10px] text-zinc-500 font-mono">
            Tanh Tube Waveshaper
          </div>
        </div>
      </div>
    </div>
  );
};

export default FxRackView;

