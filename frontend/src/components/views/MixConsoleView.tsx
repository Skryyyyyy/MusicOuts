import React, { useEffect, useState } from "react";
import { Sliders, Disc, Radio, Mic, Music, Activity, Zap } from "lucide-react";
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
  border: string;
  bgGlow: string;
  badge: string;
}

const CHANNEL_CONFIGS: Record<StemType, ChannelVisualConfig> = {
  vocals: {
    name: "01 VOCALS",
    shortName: "VOCALS",
    icon: <Mic className="w-4 h-4 text-cyan-400" />,
    color: "text-cyan-400",
    accent: "#06b6d4",
    border: "border-cyan-500/40",
    bgGlow: "bg-cyan-500/5",
    badge: "CH 01",
  },
  drums: {
    name: "02 DRUMS",
    shortName: "DRUMS",
    icon: <Disc className="w-4 h-4 text-orange-400" />,
    color: "text-orange-400",
    accent: "#f97316",
    border: "border-orange-500/40",
    bgGlow: "bg-orange-500/5",
    badge: "CH 02",
  },
  bass: {
    name: "03 BASS",
    shortName: "BASS",
    icon: <Music className="w-4 h-4 text-purple-400" />,
    color: "text-purple-400",
    accent: "#a855f7",
    border: "border-purple-500/40",
    bgGlow: "bg-purple-500/5",
    badge: "CH 03",
  },
  other: {
    name: "04 OTHER",
    shortName: "OTHER",
    icon: <Radio className="w-4 h-4 text-emerald-400" />,
    color: "text-emerald-400",
    accent: "#10b981",
    border: "border-emerald-500/40",
    bgGlow: "bg-emerald-500/5",
    badge: "CH 04",
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
    <div className={`flex flex-col h-full bg-[#121316] border border-[#262830] rounded-lg shadow-2xl overflow-hidden ${className}`}>
      {/* Console Top Toolbar */}
      <div className="h-10 px-4 bg-[#18191e] border-b border-[#262830] flex items-center justify-between select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-xs tracking-wider text-zinc-100 font-mono uppercase">
              MixConsole • 4-Stem Studio Desk
            </span>
          </div>
          <span className="text-zinc-700">|</span>
          <span className="text-[11px] font-mono text-zinc-400">
            Internal 64-bit Float DSP • Zero Latency Summing
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          {/* Scene Performance Snapshots */}
          <div className="hidden xl:flex items-center space-x-1 px-2 py-0.5 rounded bg-[#101114] border border-[#22242b]">
            <span className="text-[10px] text-zinc-500 font-bold mr-1">SCENES:</span>
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
                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#1c1e24] hover:bg-cyan-600 text-zinc-300 hover:text-white border border-[#2d303a] transition-all"
                title={`Recall ${scene.name} Stem Snapshot`}
              >
                {scene.name}
              </button>
            ))}
          </div>

          {onDuckingToggle && (
            <button
              onClick={onDuckingToggle}
              className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all flex items-center space-x-1.5 ${
                isDucking
                  ? "bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                  : "bg-[#1c1d22] border-[#2d303a] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Zap className="w-3 h-3 text-purple-400" />
              <span>Vocal Auto-Ducking: {isDucking ? "ENGAGED" : "BYPASS"}</span>
              {isDucking && duckingReduction < 0.99 && (
                <span className="text-[10px] text-purple-200 font-normal">
                  ({(20 * Math.log10(Math.max(0.01, duckingReduction))).toFixed(1)} dB)
                </span>
              )}
            </button>
          )}

          <div className="px-2 py-0.5 rounded bg-[#101114] border border-[#22242b] text-zinc-400 text-[10px]">
            Master Bus: <span className="text-cyan-400 font-bold">{formatDb(masterVolume)}</span>
          </div>
        </div>
      </div>

      {/* Main Channel Strips Workspace */}
      <div className="flex-1 p-4 flex gap-3 overflow-x-auto items-stretch justify-center bg-[#0d0e11]">
        {/* 4 Stems Channel Strips */}
        {STEM_TYPES.map((stem) => {
          const config = CHANNEL_CONFIGS[stem];
          const state = stemStates[stem];
          const vu = vuLevels[stem];

          return (
            <div
              key={stem}
              className={`flex-1 min-w-[160px] max-w-[220px] bg-[#15161b] border ${config.border} rounded-lg flex flex-col justify-between p-3 shadow-lg relative transition-all duration-200 hover:border-opacity-80`}
            >
              {/* Top: Channel Header */}
              <div className="flex flex-col gap-2 border-b border-[#252730] pb-3 select-none">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1f2128] text-zinc-400 border border-[#2d303a]">
                    {config.badge}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    {config.icon}
                    <span className={`text-xs font-mono font-bold tracking-wider ${config.color}`}>
                      {config.name}
                    </span>
                  </div>
                </div>

                {/* Pan Rotary Slider */}
                <div className="flex flex-col gap-1 bg-[#101114] p-1.5 rounded border border-[#22242b]">
                  <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                    <span>PAN</span>
                    <span className="text-zinc-200 font-bold">{formatPan(state.pan)}</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.02"
                    value={state.pan}
                    onChange={(e) => onStemPanChange(stem, parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#252830] rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Solo / Mute Buttons */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => onStemMuteToggle(stem)}
                    className={`py-1 rounded text-[11px] font-mono font-bold tracking-wider border transition-all ${
                      state.muted
                        ? "bg-red-600 text-white border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                        : "bg-[#1c1e24] text-zinc-400 border-[#2b2e38] hover:text-white hover:bg-[#252832]"
                    }`}
                  >
                    MUTE
                  </button>
                  <button
                    onClick={() => onStemSoloToggle(stem)}
                    className={`py-1 rounded text-[11px] font-mono font-bold tracking-wider border transition-all ${
                      state.solo
                        ? "bg-amber-500 text-black border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                        : "bg-[#1c1e24] text-zinc-400 border-[#2b2e38] hover:text-white hover:bg-[#252832]"
                    }`}
                  >
                    SOLO
                  </button>
                </div>
              </div>

              {/* Middle: Long-Throw Fader + Real-time Stereo VU Meter */}
              <div className="flex-1 flex items-center justify-center gap-3 py-4 select-none">
                <div className="w-4 h-full min-h-[180px] bg-[#0a0a0d] rounded border border-[#20222a] p-0.5 flex flex-col-reverse justify-start overflow-hidden relative shadow-inner">
                  <div
                    className="w-full rounded-sm transition-all duration-75"
                    style={{
                      height: `${vu}%`,
                      background:
                        vu > 90
                          ? "linear-gradient(to top, #10b981 0%, #f59e0b 70%, #ef4444 100%)"
                          : vu > 70
                          ? "linear-gradient(to top, #10b981 0%, #f59e0b 100%)"
                          : "#10b981",
                      boxShadow: vu > 10 ? `0 0 8px ${config.accent}` : "none",
                    }}
                  />
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    <div className="border-b border-red-500 w-full" />
                    <div className="border-b border-yellow-500 w-full" />
                    <div className="border-b border-zinc-400 w-full" />
                    <div className="border-b border-zinc-400 w-full" />
                    <div className="border-b border-zinc-400 w-full" />
                  </div>
                </div>

                <div className="flex flex-col justify-between text-[8px] font-mono text-zinc-600 h-full min-h-[180px] py-1">
                  <span>+6</span>
                  <span>0</span>
                  <span>-6</span>
                  <span>-12</span>
                  <span>-24</span>
                  <span>-48</span>
                  <span>-∞</span>
                </div>

                <div className="h-full min-h-[180px] flex items-center justify-center relative">
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

              {/* Bottom: Channel Readout */}
              <div className="border-t border-[#252730] pt-2 flex flex-col items-center gap-1 select-none">
                <span className="text-xs font-mono font-bold text-zinc-200">
                  {formatDb(state.volume)}
                </span>
                <span className="text-[9px] font-mono text-zinc-500 uppercase">
                  FADER {Math.round(state.volume * 100)}%
                </span>
              </div>
            </div>
          );
        })}

        {/* Master Buss Channel Strip */}
        <div className="w-[190px] bg-[#181920] border-2 border-cyan-500/50 rounded-lg flex flex-col justify-between p-3 shadow-2xl relative">
          <div className="flex flex-col gap-2 border-b border-[#252730] pb-3 select-none">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold">
                MASTER BUSS
              </span>
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            </div>

            {onDjFilterChange && (
              <div className="bg-[#101114] p-2 rounded border border-[#252730] flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[9px] font-mono text-zinc-300">
                  <span>DJ FILTER</span>
                  <span className="text-cyan-400 font-bold">
                    {djFilterCutoff > 1000 ? `${(djFilterCutoff / 1000).toFixed(1)} kHz` : `${djFilterCutoff} Hz`} [
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
                  className="w-full h-1 bg-[#252830] rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex gap-1 pt-0.5">
                  <button
                    onClick={() => onDjFilterChange(djFilterCutoff, "lowpass", djFilterQ)}
                    className={`flex-1 py-0.5 text-[8px] font-mono font-bold rounded ${
                      djFilterType === "lowpass" ? "bg-cyan-500 text-black" : "bg-[#1a1b22] text-zinc-400"
                    }`}
                  >
                    LOWPASS
                  </button>
                  <button
                    onClick={() => onDjFilterChange(djFilterCutoff, "highpass", djFilterQ)}
                    className={`flex-1 py-0.5 text-[8px] font-mono font-bold rounded ${
                      djFilterType === "highpass" ? "bg-amber-500 text-black" : "bg-[#1a1b22] text-zinc-400"
                    }`}
                  >
                    HIGHPASS
                  </button>
                  <button
                    onClick={() => onDjFilterChange(20000, "lowpass", 1.0)}
                    className="px-1.5 py-0.5 text-[8px] font-mono bg-[#1c1d24] text-zinc-400 hover:text-white rounded"
                    title="Reset DJ Filter"
                  >
                    BYPASS
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center gap-3 py-4 select-none">
            <div className="flex gap-1 h-full min-h-[180px]">
              <div className="w-3 h-full bg-[#0a0a0d] rounded border border-[#20222a] p-0.5 flex flex-col-reverse justify-start overflow-hidden relative shadow-inner">
                <div
                  className="w-full rounded-sm transition-all duration-75"
                  style={{
                    height: `${masterVu}%`,
                    background:
                      masterVu > 90
                        ? "linear-gradient(to top, #06b6d4 0%, #f59e0b 70%, #ef4444 100%)"
                        : "#06b6d4",
                    boxShadow: masterVu > 10 ? "0 0 8px #06b6d4" : "none",
                  }}
                />
              </div>
              <div className="w-3 h-full bg-[#0a0a0d] rounded border border-[#20222a] p-0.5 flex flex-col-reverse justify-start overflow-hidden relative shadow-inner">
                <div
                  className="w-full rounded-sm transition-all duration-75"
                  style={{
                    height: `${Math.max(0, masterVu - 2)}%`,
                    background:
                      masterVu > 90
                        ? "linear-gradient(to top, #06b6d4 0%, #f59e0b 70%, #ef4444 100%)"
                        : "#06b6d4",
                    boxShadow: masterVu > 10 ? "0 0 8px #06b6d4" : "none",
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col justify-between text-[8px] font-mono text-zinc-500 h-full min-h-[180px] py-1">
              <span>+6</span>
              <span>0</span>
              <span>-6</span>
              <span>-12</span>
              <span>-24</span>
              <span>-48</span>
              <span>-∞</span>
            </div>

            <div className="h-full min-h-[180px] flex items-center justify-center">
              <input
                type="range"
                min="0"
                max="1.25"
                step="0.01"
                value={masterVolume}
                onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
                className="h-full w-8 appearance-none bg-transparent cursor-pointer [writing-mode:bt-lr] [-webkit-appearance:slider-vertical]"
                style={{
                  accentColor: "#06b6d4",
                }}
              />
            </div>
          </div>

          <div className="border-t border-[#252730] pt-2 flex flex-col items-center gap-1 select-none">
            <span className="text-xs font-mono font-bold text-cyan-300">
              {formatDb(masterVolume)}
            </span>
            <span className="text-[9px] font-mono text-zinc-500 uppercase">
              MAIN OUT {Math.round(masterVolume * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
