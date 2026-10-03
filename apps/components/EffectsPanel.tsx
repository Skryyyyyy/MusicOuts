import React, { useState } from 'react';
import { Track } from '../../core/project-model/types';
import { RotaryKnob } from './RotaryKnob';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Sliders,
} from 'lucide-react';

interface EffectModule {
  id: string;
  name: string;
  type: 'equalizer' | 'reverb' | 'delay' | 'compressor' | 'vinyl' | 'reverse' | 'enhance' | 'pitch' | 'spatial';
  isEnabled: boolean;
  level: number; // 0..1 mini meter
}

interface EffectsPanelProps {
  selectedTrack: Track;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onUpdateTrack: (track: Track) => void;
  onAddKeyframe?: (parameter: string, value: number) => void;
}

export const EffectsPanel: React.FC<EffectsPanelProps> = ({
  selectedTrack,
  isCollapsed,
  onToggleCollapse,
  onUpdateTrack,
  onAddKeyframe,
}) => {
  const [activeEffectId, setActiveEffectId] = useState<string>('fx-eq');
  const [effects, setEffects] = useState<EffectModule[]>([
    { id: 'fx-reverb', name: 'Reverb', type: 'reverb', isEnabled: true, level: 0.45 },
    { id: 'fx-delay', name: 'Delay', type: 'delay', isEnabled: false, level: 0.1 },
    { id: 'fx-comp', name: 'Compressor', type: 'compressor', isEnabled: true, level: 0.65 },
    { id: 'fx-vinyl', name: 'Vinyl', type: 'vinyl', isEnabled: false, level: 0.0 },
    { id: 'fx-rev', name: 'Reverse', type: 'reverse', isEnabled: false, level: 0.0 },
    { id: 'fx-eq', name: 'Equalizer', type: 'equalizer', isEnabled: true, level: 0.8 },
    { id: 'fx-neural', name: 'Neural Enhance', type: 'enhance', isEnabled: true, level: 0.7 },
    { id: 'fx-spatial', name: 'Spatial', type: 'spatial', isEnabled: false, level: 0.2 },
  ]);

  const toggleEffectPower = (effectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEffects((prev) =>
      prev.map((fx) => (fx.id === effectId ? { ...fx, isEnabled: !fx.isEnabled } : fx))
    );
  };

  const activeEffect = effects.find((fx) => fx.id === activeEffectId) || effects[0];

  return (
    <div className="bg-[#12141A] border-t border-white/[0.08] flex flex-col shrink-0 transition-all duration-200">
      {/* Header Bar */}
      <div className="h-9 px-4 bg-[#161820] border-b border-white/[0.06] flex items-center justify-between select-none">
        <div className="flex items-center space-x-2">
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            {selectedTrack ? `${selectedTrack.name} — FX Rack` : 'Master FX Chain'}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
            DAW Grade
          </span>
        </div>

        <button
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
        >
          <span>{isCollapsed ? 'Show Effects' : 'Hide Effects'}</span>
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Rack Content (Collapsible) */}
      {!isCollapsed && (
        <div className="h-56 flex overflow-hidden p-3 gap-3 bg-[#0F1117]">
          {/* Horizontal Strip Rack of Effects */}
          <div className="flex space-x-2 overflow-x-auto pb-1 shrink-0">
            {effects.map((fx) => {
              const isSelected = activeEffectId === fx.id;

              return (
                <div
                  key={fx.id}
                  onClick={() => setActiveEffectId(fx.id)}
                  className={`w-14 rounded-xl flex flex-col items-center justify-between p-2 cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-[#1F222C] border-emerald-500/50 shadow-lg'
                      : 'bg-[#161820] border-white/[0.04] hover:bg-[#1A1D26]'
                  }`}
                >
                  {/* Green LED Power Button */}
                  <button
                    onClick={(e) => toggleEffectPower(fx.id, e)}
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                      fx.isEnabled
                        ? 'bg-emerald-500 shadow-[0_0_8px_#22C55E]'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                    title={fx.isEnabled ? 'Bypass Effect' : 'Enable Effect'}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white/90" />
                  </button>

                  {/* Rotated Vertical Label */}
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider -rotate-90 my-auto whitespace-nowrap transition-colors ${
                      isSelected ? 'text-white' : 'text-slate-400'
                    }`}
                  >
                    {fx.name}
                  </span>

                  {/* Mini Level Indicator */}
                  <div className="w-8 h-1 bg-black/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${fx.isEnabled ? fx.level * 100 : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Add Effect Strip */}
            <div className="w-12 rounded-xl border border-dashed border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 flex flex-col items-center justify-center cursor-pointer transition-colors text-slate-400 hover:text-emerald-400">
              <Plus className="w-4 h-4" />
              <span className="text-[9px] font-bold mt-1 uppercase">Add</span>
            </div>
          </div>

          {/* Focused Effect Detail Card */}
          <div className="flex-1 bg-[#161820] rounded-2xl border border-white/[0.08] p-4 flex flex-col justify-between overflow-hidden shadow-2xl relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {activeEffect.name} Module
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                    activeEffect.isEnabled
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {activeEffect.isEnabled ? 'ACTIVE' : 'BYPASS'}
                </span>
              </div>
            </div>

            {/* EQ Frequency Curve Visualizer & Knobs */}
            {activeEffect.type === 'equalizer' && (
              <div className="flex-1 flex flex-col justify-between">
                {/* Live Frequency-Response Curve with Green Gradient Fill */}
                <div className="h-20 bg-[#0B0D12] rounded-xl border border-white/[0.06] relative overflow-hidden flex items-center justify-center">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 80">
                    <defs>
                      <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    <line x1="100" y1="0" x2="100" y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 2" />
                    <line x1="200" y1="0" x2="200" y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 2" />
                    <line x1="300" y1="0" x2="300" y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 2" />
                    <line x1="0" y1="40" x2="400" y2="40" stroke="rgba(255,255,255,0.1)" />

                    {/* Smooth Spline Curve computed from Low, Mid, High Gains */}
                    {(() => {
                      const yLow = 40 - (selectedTrack?.eqLowGain || 0) * 2.2;
                      const yMid = 40 - (selectedTrack?.eqMidGain || 0) * 2.2;
                      const yHigh = 40 - (selectedTrack?.eqHighGain || 0) * 2.2;
                      const pathData = `M 0,${yLow} Q 100,${yLow} 150,${(yLow + yMid) / 2} T 250,${yMid} T 350,${yHigh} L 400,${yHigh}`;
                      const fillData = `${pathData} L 400,80 L 0,80 Z`;

                      return (
                        <>
                          <path d={fillData} fill="url(#eqGradient)" />
                          <path d={pathData} fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" />
                          <circle cx="80" cy={yLow} r="4" fill="#22C55E" className="shadow-md" />
                          <circle cx="200" cy={yMid} r="4" fill="#22C55E" className="shadow-md" />
                          <circle cx="340" cy={yHigh} r="4" fill="#22C55E" className="shadow-md" />
                        </>
                      );
                    })()}
                  </svg>
                  <div className="absolute bottom-1 px-3 w-full flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>120 Hz Low</span>
                    <span>2.5 kHz Mid</span>
                    <span>8.0 kHz High</span>
                  </div>
                </div>

                {/* Rotary Knobs Row (Low, Mid, High, Volume) */}
                <div className="flex items-center justify-around mt-2">
                  <RotaryKnob
                    label="Low Gain"
                    value={selectedTrack?.eqLowGain || 0}
                    min={-12}
                    max={12}
                    step={0.5}
                    unit="dB"
                    defaultValue={0}
                    onChange={(val) => onUpdateTrack({ ...selectedTrack, eqLowGain: val })}
                    onAddKeyframe={() => onAddKeyframe && onAddKeyframe('eq_low', selectedTrack.eqLowGain)}
                  />
                  <RotaryKnob
                    label="Mid Gain"
                    value={selectedTrack?.eqMidGain || 0}
                    min={-12}
                    max={12}
                    step={0.5}
                    unit="dB"
                    defaultValue={0}
                    onChange={(val) => onUpdateTrack({ ...selectedTrack, eqMidGain: val })}
                    onAddKeyframe={() => onAddKeyframe && onAddKeyframe('eq_mid', selectedTrack.eqMidGain)}
                  />
                  <RotaryKnob
                    label="High Gain"
                    value={selectedTrack?.eqHighGain || 0}
                    min={-12}
                    max={12}
                    step={0.5}
                    unit="dB"
                    defaultValue={0}
                    onChange={(val) => onUpdateTrack({ ...selectedTrack, eqHighGain: val })}
                    onAddKeyframe={() => onAddKeyframe && onAddKeyframe('eq_high', selectedTrack.eqHighGain)}
                  />
                  <RotaryKnob
                    label="Track Gain"
                    value={selectedTrack?.volume || 1.0}
                    min={0.0}
                    max={2.0}
                    step={0.05}
                    unit="x"
                    defaultValue={1.0}
                    onChange={(val) => onUpdateTrack({ ...selectedTrack, volume: val })}
                    onAddKeyframe={() => onAddKeyframe && onAddKeyframe('volume', selectedTrack.volume)}
                  />
                </div>
              </div>
            )}

            {/* Reverb Module Detail */}
            {activeEffect.type === 'reverb' && (
              <div className="flex-1 flex items-center justify-around">
                <RotaryKnob
                  label="Send Amount"
                  value={Math.round((selectedTrack?.reverbSend || 0) * 100)}
                  min={0}
                  max={100}
                  unit="%"
                  defaultValue={20}
                  onChange={(val) => onUpdateTrack({ ...selectedTrack, reverbSend: val / 100 })}
                />
                <RotaryKnob
                  label="Pre-Delay"
                  value={20}
                  min={0}
                  max={100}
                  unit="ms"
                  defaultValue={20}
                  onChange={() => {}}
                />
                <RotaryKnob
                  label="Decay Time"
                  value={1.8}
                  min={0.2}
                  max={6.0}
                  unit="s"
                  defaultValue={1.8}
                  onChange={() => {}}
                />
              </div>
            )}

            {/* Compressor Detail */}
            {activeEffect.type === 'compressor' && (
              <div className="flex-1 flex items-center justify-around">
                <RotaryKnob
                  label="Threshold"
                  value={-12}
                  min={-40}
                  max={0}
                  unit="dB"
                  defaultValue={-12}
                  onChange={() => {}}
                />
                <RotaryKnob
                  label="Ratio"
                  value={3.5}
                  min={1.0}
                  max={20.0}
                  unit=":1"
                  defaultValue={3.0}
                  onChange={() => {}}
                />
                <RotaryKnob
                  label="Attack"
                  value={10}
                  min={1}
                  max={100}
                  unit="ms"
                  defaultValue={10}
                  onChange={() => {}}
                />
                <RotaryKnob
                  label="Release"
                  value={150}
                  min={10}
                  max={1000}
                  unit="ms"
                  defaultValue={150}
                  onChange={() => {}}
                />
              </div>
            )}

            {/* Neural Enhance Detail */}
            {activeEffect.type === 'enhance' && (
              <div className="flex-1 flex items-center justify-around">
                <RotaryKnob
                  label="Denoise"
                  value={65}
                  min={0}
                  max={100}
                  unit="%"
                  defaultValue={50}
                  onChange={() => {}}
                />
                <RotaryKnob
                  label="De-Reverb"
                  value={40}
                  min={0}
                  max={100}
                  unit="%"
                  defaultValue={30}
                  onChange={() => {}}
                />
                <RotaryKnob
                  label="DLSS Restore"
                  value={85}
                  min={0}
                  max={100}
                  unit="%"
                  defaultValue={80}
                  onChange={() => {}}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
