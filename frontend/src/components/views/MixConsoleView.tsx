import React, { useEffect, useState } from "react";
import { Sliders, Disc, Radio, Mic, Music, Activity, Zap, Volume2 } from "lucide-react";
import { STEM_TYPES, StemState, StemType } from "../../types";
import { AudioGraphEngine } from "../../engine/audioGraph";

export interface MixConsoleViewProps {
  audioGraph: AudioGraphEngine | null;
  stemStates: Record<StemType, StemState>;
  masterVolume: number;
  djFilterCutoff: number;
  djFilterType: "lowpass" | "highpass";
  djFilterQ?: number;
  isDucking?: boolean;
  duckingReduction?: number;
  onStemVolumeChange: (stem: StemType, volume: number) => void;
  onStemMuteToggle: (stem: StemType) => void;
  onStemSoloToggle: (stem: StemType) => void;
  onStemPanChange: (stem: StemType, pan: number) => void;
  onMasterVolumeChange: (volume: number) => void;
  onDjFilterChange?: (cutoff: number, type: "lowpass" | "highpass", Q?: number) => void;
  onDuckingToggle?: () => void;
  className?: string;
}

interface ChannelVisualConfig {
  name: string;
  shortName: string;
  icon: React.ReactNode;
  color: string;
  accent: string;
  gradient: string;
  glow: string;
  border: string;
  badge: string;
}

const CHANNEL_CONFIGS: Record<StemType, ChannelVisualConfig> = {
  vocals: {
    name: "VOCALS",
    shortName: "VOX",
    icon: <Mic className="w-4 h-4 text-cyan-400" />,
    color: "text-cyan-400",
    accent: "#00e5ff",
    gradient: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    glow: "shadow-[0_0_20px_rgba(0,229,255,0.15)]",
    border: "border-cyan-500/30 hover:border-cyan-400/60",
    badge: "01",
  },
  drums: {
    name: "DRUMS",
    shortName: "DRM",
    icon: <Disc className="w-4 h-4 text-orange-400" />,
    color: "text-orange-400",
    accent: "#ff5722",
    gradient: "from-orange-500/20 via-orange-500/5 to-transparent",
    glow: "shadow-[0_0_20px_rgba(255,87,34,0.15)]",
    border: "border-orange-500/30 hover:border-orange-400/60",
    badge: "02",
  },
  bass: {
    name: "BASS",
    shortName: "BAS",
    icon: <Music className="w-4 h-4 text-purple-400" />,
    color: "text-purple-400",
    accent: "#a855f7",
    gradient: "from-purple-500/20 via-purple-500/5 to-transparent",
    glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
    border: "border-purple-500/30 hover:border-purple-400/60",
    badge: "03",
  },
  other: {
    name: "OTHER",
    shortName: "OTH",
    icon: <Radio className="w-4 h-4 text-emerald-400" />,
    color: "text-emerald-400",
    accent: "#10b981",
    gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    border: "border-emerald-500/30 hover:border-emerald-400/60",
    badge: "04",
  },
};

export const MixConsoleView: React.FC<MixConsoleViewProps> = ({
  audioGraph,
  stemStates,
  masterVolume,
  djFilterCutoff,
  djFilterType,
  djFilterQ = 1.0,
  isDucking = false,
  duckingReduction = 1.0,
  onStemVolumeChange,
  onStemMuteToggle,
  onStemSoloToggle,
  onStemPanChange,
  onMasterVolumeChange,
  onDjFilterChange,
  onDuckingToggle,
  className = "",
}) => {
  const [vuLevels, setVuLevels] = useState<Record<StemType, number>>({
    vocals: 0,
    drums: 0,
    bass: 0,
    other: 0,
  });
  const [masterVu, setMasterVu] = useState<number>(0);

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
          if (freqData.length > 0) {
            let sum = 0;
            const count = Math.min(64, freqData.length);
            for (let i = 0; i < count; i++) {
              sum += freqData[i];
            }
            const avg = sum / count;
            const normalized = Math.min(100, Math.round((avg / 255) * 100 * 1.35));
            nextVu[stem] = normalized;
          }
        }

        const masterAvg = (nextVu.vocals + nextVu.drums + nextVu.bass + nextVu.other) / 4;
        setVuLevels(nextVu);
        setMasterVu(Math.min(100, Math.round(masterAvg * 1.1)));
      } else {
        setVuLevels({ vocals: 0, drums: 0, bass: 0, other: 0 });
        setMasterVu(0);
      }
      animId = requestAnimationFrame(updateMeters);
    };

    animId = requestAnimationFrame(updateMeters);
    return () => cancelAnimationFrame(animId);
  }, [audioGraph]);

  const formatDb = (vol: number): string => {
    if (vol <= 0.001) return "-∞ dB";
    const db = 20 * Math.log10(vol);
    return `${db >= 0 ? "+" : ""}${db.toFixed(1)} dB`;
  };

  const formatPan = (pan: number): string => {
    if (Math.abs(pan) < 0.05) return "C";
    if (pan < 0) return `L ${Math.round(Math.abs(pan) * 100)}`;
    return `R ${Math.round(pan * 100)}`;
  };

  return (
    <div className={`flex flex-col h-full bg-[#0b0c10] rounded-2xl border border-white/[0.08] shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl overflow-hidden ${className}`}>
      {/* Console Top Toolbar - Splice Glass Capsule Header */}
      <div className="h-14 px-5 bg-gradient-to-r from-[#14161f]/95 via-[#161822]/90 to-[#14161f]/95 border-b border-white/[0.06] flex items-center justify-between select-none shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.2)]">
            <Sliders className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xs tracking-wider text-white uppercase">
                Splice Console
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-mono text-cyan-300 font-bold">
                PRO DESK
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 block -mt-0.5">
              64-Bit Float Precision • Ultra Low Jitter Summing
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 text-xs font-mono">
          {/* Scene Performance Snapshots */}
          <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#0b0c12]/80 border border-white/[0.08] shadow-inner">
            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider ml-1 mr-1">SCENES:</span>
            {[
              { name: 'INTRO', levels: { vocals: 0.4, drums: 0.2, bass: 0.0, other: 0.5 } },
              { name: 'VERSE', levels: { vocals: 0.85, drums: 0.75, bass: 0.7, other: 0.65 } },
              { name: 'DROP', levels: { vocals: 1.0, drums: 1.0, bass: 1.0, other: 0.9 } },
              { name: 'ACAPELLA', levels: { vocals: 1.0, drums: 0.0, bass: 0.0, other: 0.1 } },
            ].map((scene) => (
              <button
                key={scene.name}
                onClick={() => {
                  for (const stem of STEM_TYPES) {
                    onStemVolumeChange(stem, scene.levels[stem]);
                  }
                }}
                className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-white/[0.05] hover:bg-cyan-500 hover:text-black text-zinc-300 border border-white/[0.06] hover:border-cyan-400 transition-all shadow-sm active:scale-95"
                title={`Recall ${scene.name} Stem Snapshot`}
              >
                {scene.name}
              </button>
            ))}
          </div>

          {onDuckingToggle && (
            <button
              onClick={onDuckingToggle}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 ${
                isDucking
                  ? "bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                  : "bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08]"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span>Auto-Ducking: {isDucking ? "ON" : "OFF"}</span>
              {isDucking && duckingReduction < 0.99 && (
                <span className="text-[10px] text-purple-200 font-mono">
                  ({(20 * Math.log10(Math.max(0.01, duckingReduction))).toFixed(1)} dB)
                </span>
              )}
            </button>
          )}

          <div className="px-3 py-1.5 rounded-full bg-[#0b0c12]/90 border border-white/[0.08] text-zinc-400 text-[11px] flex items-center space-x-1.5">
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Master:</span>
            <span className="text-cyan-400 font-bold font-mono">{formatDb(masterVolume)}</span>
          </div>
        </div>
      </div>

      {/* Main Channel Strips Workspace */}
      <div className="flex-1 p-5 flex gap-4 overflow-x-auto items-stretch justify-center bg-gradient-to-b from-[#0b0c10] to-[#08090c]">
        {/* 4 Stems Channel Strips */}
        {STEM_TYPES.map((stem) => {
          const config = CHANNEL_CONFIGS[stem];
          const state = stemStates[stem];
          const vu = vuLevels[stem];

          return (
            <div
              key={stem}
              className={`flex-1 min-w-[170px] max-w-[240px] bg-gradient-to-b from-[#14161f]/90 to-[#101118]/90 border ${config.border} rounded-2xl flex flex-col justify-between p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl relative transition-all duration-200 hover:-translate-y-0.5 ${config.glow}`}
            >
              {/* Top Accent Strip Bar */}
              <div
                className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full shadow-[0_0_10px_currentColor]"
                style={{ backgroundColor: config.accent, color: config.accent }}
              />

              {/* Top: Channel Header */}
              <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-3.5 pt-1 select-none">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-zinc-400 border border-white/[0.08] font-bold">
                    CH {config.badge}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    {config.icon}
                    <span className={`text-xs font-bold tracking-wider ${config.color}`}>
                      {config.name}
                    </span>
                  </div>
                </div>

                {/* Pan Slider Pill Container */}
                <div className="flex flex-col gap-1.5 bg-[#0b0c12]/70 p-2 rounded-xl border border-white/[0.05]">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span className="font-bold">PAN</span>
                    <span className="text-zinc-200 font-bold">{formatPan(state.pan)}</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.02"
                    value={state.pan}
                    onChange={(e) => onStemPanChange(stem, parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-white/[0.08] rounded-full appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Splice Tactile Solo / Mute Capsule Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onStemMuteToggle(stem)}
                    className={`py-1.5 rounded-xl text-xs font-mono font-extrabold tracking-wider border transition-all active:scale-95 ${
                      state.muted
                        ? "bg-red-600 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                        : "bg-white/[0.04] text-zinc-400 border-white/[0.06] hover:text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    MUTE
                  </button>
                  <button
                    onClick={() => onStemSoloToggle(stem)}
                    className={`py-1.5 rounded-xl text-xs font-mono font-extrabold tracking-wider border transition-all active:scale-95 ${
                      state.solo
                        ? "bg-amber-500 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]"
                        : "bg-white/[0.04] text-zinc-400 border-white/[0.06] hover:text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    SOLO
                  </button>
                </div>
              </div>

              {/* Middle: Long-Throw Fader + Multi-Segment LED VU Meter */}
              <div className="flex-1 flex items-center justify-center gap-4 py-5 select-none">
                {/* Precision Glass LED Meter */}
                <div className="w-4 h-full min-h-[190px] bg-[#08090c] rounded-full border border-white/[0.08] p-1 flex flex-col-reverse justify-start overflow-hidden relative shadow-inner">
                  <div
                    className="w-full rounded-full transition-all duration-75"
                    style={{
                      height: `${vu}%`,
                      background:
                        vu > 90
                          ? "linear-gradient(to top, #10b981 0%, #f59e0b 70%, #ef4444 100%)"
                          : vu > 70
                          ? "linear-gradient(to top, #10b981 0%, #f59e0b 100%)"
                          : "#10b981",
                      boxShadow: vu > 10 ? `0 0 10px ${config.accent}` : "none",
                    }}
                  />
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-25 p-1">
                    <div className="border-b border-red-500 w-full" />
                    <div className="border-b border-yellow-500 w-full" />
                    <div className="border-b border-zinc-400 w-full" />
                    <div className="border-b border-zinc-400 w-full" />
                    <div className="border-b border-zinc-400 w-full" />
                  </div>
                </div>

                {/* dB Scale Labels */}
                <div className="flex flex-col justify-between text-[8px] font-mono text-zinc-500 h-full min-h-[190px] py-1 font-semibold">
                  <span>+6</span>
                  <span>0</span>
                  <span>-6</span>
                  <span>-12</span>
                  <span>-24</span>
                  <span>-48</span>
                  <span>-∞</span>
                </div>

                {/* Tactile Vertical Slider */}
                <div className="h-full min-h-[190px] flex items-center justify-center relative">
                  <input
                    type="range"
                    min="0"
                    max="1.25"
                    step="0.01"
                    value={state.volume}
                    onChange={(e) => onStemVolumeChange(stem, parseFloat(e.target.value))}
                    className="h-full w-8 appearance-none bg-transparent cursor-pointer [writing-mode:bt-lr] [-webkit-appearance:slider-vertical]"
                    style={{
                      accentColor: config.accent,
                    }}
                  />
                </div>
              </div>

              {/* Bottom: Channel Readout Capsule */}
              <div className="border-t border-white/[0.06] pt-3 flex flex-col items-center gap-1 select-none">
                <span className="text-xs font-mono font-extrabold text-white px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  {formatDb(state.volume)}
                </span>
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest font-bold">
                  {Math.round(state.volume * 100)}%
                </span>
              </div>
            </div>
          );
        })}

        {/* Master Buss Channel Strip - iPad DAW Grand Master */}
        <div className="w-[210px] bg-gradient-to-b from-[#171a26]/95 to-[#12141e]/95 border-2 border-cyan-500/40 rounded-2xl flex flex-col justify-between p-4 shadow-[0_10px_40px_rgba(0,229,255,0.2)] backdrop-blur-2xl relative transition-all">
          {/* Top Master Glow Line */}
          <div className="absolute top-0 left-6 right-6 h-[3px] bg-cyan-400 rounded-b-full shadow-[0_0_12px_rgba(0,229,255,0.8)]" />

          <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-3.5 pt-1 select-none">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-extrabold">
                MAIN BUSS
              </span>
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            </div>

            {onDjFilterChange && (
              <div className="bg-[#0b0c12]/80 p-2.5 rounded-xl border border-white/[0.06] flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-300">
                  <span className="font-bold">DJ FILTER</span>
                  <span className="text-cyan-400 font-bold">
                    {djFilterCutoff > 1000 ? `${(djFilterCutoff / 1000).toFixed(1)}k` : `${djFilterCutoff}`} [
                    {djFilterType === "lowpass" ? "LP" : "HP"}]
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="20000"
                  step="50"
                  value={djFilterCutoff}
                  onChange={(e) => onDjFilterChange(parseFloat(e.target.value), djFilterType, djFilterQ)}
                  className="w-full h-1.5 bg-white/[0.08] rounded-full appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex gap-1.5 pt-0.5">
                  <button
                    onClick={() => onDjFilterChange(djFilterCutoff, "lowpass", djFilterQ)}
                    className={`flex-1 py-1 text-[9px] font-mono font-bold rounded-lg transition-all active:scale-95 ${
                      djFilterType === "lowpass" ? "bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,229,255,0.4)]" : "bg-white/[0.04] text-zinc-400 border border-white/[0.06]"
                    }`}
                  >
                    LOWPASS
                  </button>
                  <button
                    onClick={() => onDjFilterChange(djFilterCutoff, "highpass", djFilterQ)}
                    className={`flex-1 py-1 text-[9px] font-mono font-bold rounded-lg transition-all active:scale-95 ${
                      djFilterType === "highpass" ? "bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]" : "bg-white/[0.04] text-zinc-400 border border-white/[0.06]"
                    }`}
                  >
                    HIGHPASS
                  </button>
                  <button
                    onClick={() => onDjFilterChange(20000, "lowpass", 1.0)}
                    className="px-2 py-1 text-[9px] font-mono bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white rounded-lg border border-white/[0.06]"
                    title="Reset DJ Filter"
                  >
                    BYPASS
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Master Dual Stereo VU Meters + Long Throw Fader */}
          <div className="flex-1 flex items-center justify-center gap-4 py-5 select-none">
            <div className="flex gap-1.5 h-full min-h-[190px]">
              <div className="w-3.5 h-full bg-[#08090c] rounded-full border border-white/[0.08] p-0.5 flex flex-col-reverse justify-start overflow-hidden relative shadow-inner">
                <div
                  className="w-full rounded-full transition-all duration-75"
                  style={{
                    height: `${masterVu}%`,
                    background:
                      masterVu > 90
                        ? "linear-gradient(to top, #00e5ff 0%, #f59e0b 70%, #ef4444 100%)"
                        : "#00e5ff",
                    boxShadow: masterVu > 10 ? "0 0 10px #00e5ff" : "none",
                  }}
                />
              </div>
              <div className="w-3.5 h-full bg-[#08090c] rounded-full border border-white/[0.08] p-0.5 flex flex-col-reverse justify-start overflow-hidden relative shadow-inner">
                <div
                  className="w-full rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(0, masterVu - 2)}%`,
                    background:
                      masterVu > 90
                        ? "linear-gradient(to top, #00e5ff 0%, #f59e0b 70%, #ef4444 100%)"
                        : "#00e5ff",
                    boxShadow: masterVu > 10 ? "0 0 10px #00e5ff" : "none",
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col justify-between text-[8px] font-mono text-zinc-500 h-full min-h-[190px] py-1 font-semibold">
              <span>+6</span>
              <span>0</span>
              <span>-6</span>
              <span>-12</span>
              <span>-24</span>
              <span>-48</span>
              <span>-∞</span>
            </div>

            <div className="h-full min-h-[190px] flex items-center justify-center">
              <input
                type="range"
                min="0"
                max="1.25"
                step="0.01"
                value={masterVolume}
                onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
                className="h-full w-8 appearance-none bg-transparent cursor-pointer [writing-mode:bt-lr] [-webkit-appearance:slider-vertical]"
                style={{
                  accentColor: "#00e5ff",
                }}
              />
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-3 flex flex-col items-center gap-1 select-none">
            <span className="text-xs font-mono font-extrabold text-cyan-300 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              {formatDb(masterVolume)}
            </span>
            <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest font-bold">
              MASTER {Math.round(masterVolume * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

