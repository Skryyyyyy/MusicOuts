import React, { useEffect, useState } from "react";
import { Sliders, Disc, Radio, Mic, Music, Zap, Volume2 } from "lucide-react";
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
    icon: <Mic className="w-4 h-4 text-violet-400" />,
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
  duckingReduction: _duckingReduction = 1.0,
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
    <div className={`flex flex-col h-full bg-surface-container-low border-t border-surface-container-highest shadow-[0_-4px_16px_rgba(0,0,0,0.6)] select-none overflow-hidden ${className}`}>
      {/* Dock Navigation & Console Toolbar */}
      <div className="h-7 bg-surface-container px-pad-sm flex items-center justify-between border-b border-surface-container-highest shrink-0">
        <div className="flex items-center gap-pad-micro font-label-sm text-label-sm">
          <button className="px-pad-sm py-pad-micro rounded-t bg-surface-container-high text-primary font-bold shadow-sm flex items-center gap-pad-micro">
            <Sliders className="w-3.5 h-3.5" /> MixConsole (F3)
          </button>
          <span className="px-1.5 py-0.2 rounded bg-primary/10 border border-primary/30 text-[9px] font-mono text-primary font-bold hidden sm:inline">
            Splice Console
          </span>
          <button className="hidden md:flex px-pad-sm py-pad-micro rounded hover:bg-surface-container-high text-on-surface-variant items-center gap-pad-micro">
            Sampler Control
          </button>
          <button className="hidden lg:flex px-pad-sm py-pad-micro rounded hover:bg-surface-container-high text-on-surface-variant items-center gap-pad-micro">
            Chord Pads
          </button>
          <button className="hidden xl:flex px-pad-sm py-pad-micro rounded hover:bg-surface-container-high text-on-surface-variant items-center gap-pad-micro">
            Audio Editor
          </button>
          <button className="hidden xl:flex px-pad-sm py-pad-micro rounded hover:bg-surface-container-high text-on-surface-variant items-center gap-pad-micro">
            Control Room
          </button>
        </div>

        <div className="flex items-center gap-pad-sm font-meter-tick text-meter-tick text-on-surface-variant">
          {onDuckingToggle && (
            <button
              onClick={onDuckingToggle}
              className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all flex items-center space-x-1 ${
                isDucking
                  ? "bg-secondary-container text-on-secondary-container border-secondary-container shadow-[0_0_6px_rgba(236,106,6,0.5)]"
                  : "bg-surface-container-highest border-outline-variant text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Zap className="w-3 h-3 text-secondary" />
              <span>Auto-Ducking: {isDucking ? "ON" : "OFF"}</span>
            </button>
          )}

          <span className="hidden sm:inline">FADER SCALE: +6dB</span>
          <span className="hidden md:inline">LINK GROUPS: 0</span>

          <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-surface-container-lowest border border-surface-container-highest">
            <Volume2 className="w-3 h-3 text-primary" />
            <span className="text-primary font-mono font-bold">{formatDb(masterVolume)}</span>
          </div>
        </div>
      </div>

      {/* 6 Channel Strips Rack */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex bg-surface-container-lowest">
        {/* 4 Stems Channel Strips */}
        {STEM_TYPES.map((stem) => {
          const config = CHANNEL_CONFIGS[stem];
          const state = stemStates[stem];
          const vu = vuLevels[stem];

          const inserts = {
            vocals: ["Pro-Q 3", "CLA-2A", "Soothe2", "VVerb"],
            drums: ["Drum Buss", "Tape Sat", "Limiter", "+ Insert"],
            bass: ["Omnisphere", "Chorus", "+ Insert", "+ Insert"],
            other: ["Amp Sim", "Pro-Q 3", "+ Insert", "+ Insert"],
          }[stem];

          return (
            <div
              key={stem}
              className="w-channel-w-wide shrink-0 bg-surface-container flex flex-col justify-between border-r border-surface-container-highest p-1 shadow-inner"
            >
              {/* Top Gain & Routing */}
              <div className="flex flex-col items-center gap-0.5 bg-surface-container-low p-1 rounded">
                <span className="font-meter-tick text-meter-tick text-on-surface-variant">GAIN</span>
                <div className="w-6 h-6 rounded-full bg-surface-container-lowest flex items-center justify-center shadow">
                  <div className="w-0.5 h-2.5 bg-primary -rotate-12" />
                </div>
                <span className="font-meter-tick text-meter-tick text-primary font-mono">{formatDb(state.volume)}</span>
              </div>

              {/* 4 Inserts Miniature Stack */}
              <div className="flex flex-col gap-0.5 my-1 font-label-sm text-[9px]">
                {inserts.map((ins, i) => (
                  <div
                    key={i}
                    className={`px-1 py-0.5 rounded truncate ${
                      ins.startsWith("+")
                        ? "bg-surface-container-lowest text-on-surface-variant/60"
                        : "bg-surface-container-high text-on-surface font-semibold"
                    }`}
                  >
                    {ins}
                  </div>
                ))}
              </div>

              {/* Pan Knob & Readout */}
              <div
                onClick={() => {
                  const nextPan = state.pan === 0 ? 0.5 : state.pan > 0 ? -0.5 : 0;
                  onStemPanChange(stem, nextPan);
                }}
                className="flex flex-col items-center bg-surface-container-low py-0.5 rounded cursor-pointer hover:bg-surface-container-high transition-colors"
                title={`Pan: ${formatPan(state.pan)} (click to cycle L / C / R)`}
              >
                <div className="w-5 h-5 rounded-full bg-surface-container-lowest flex items-center justify-center shadow">
                  <div
                    className="w-0.5 h-2 bg-secondary"
                    style={{ transform: `rotate(${state.pan * 90}deg)` }}
                  />
                </div>
                <span className="font-meter-tick text-meter-tick text-secondary font-mono">
                  {formatPan(state.pan)}
                </span>
              </div>

              {/* Mute / Solo Tactile Group */}
              <div className="grid grid-cols-2 gap-0.5 my-1">
                <button
                  onClick={() => onStemMuteToggle(stem)}
                  className={`h-5 flex items-center justify-center font-bold text-[10px] rounded-sm transition-all ${
                    state.muted
                      ? "bg-error-container text-on-error shadow-[0_0_6px_rgba(239,68,68,0.7)]"
                      : "bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
                  }`}
                  title={`Mute ${config.name}`}
                >
                  M
                </button>
                <button
                  onClick={() => onStemSoloToggle(stem)}
                  className={`h-5 flex items-center justify-center font-bold text-[10px] rounded-sm transition-all ${
                    state.solo
                      ? "bg-secondary-container text-on-secondary-container shadow-[0_0_6px_rgba(236,106,6,0.6)]"
                      : "bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
                  }`}
                  title={`Solo ${config.name}`}
                >
                  S
                </button>
              </div>

              {/* Fader & LED Meter Section */}
              <div className="flex-1 flex items-center justify-center gap-1 px-1 py-1 relative min-h-[140px]">
                {/* dB Reference Scale */}
                <div className="flex flex-col justify-between h-full font-meter-tick text-[8px] text-on-surface-variant/60 py-1">
                  <span>+6</span>
                  <span>0</span>
                  <span>-6</span>
                  <span>-12</span>
                  <span>-24</span>
                  <span>-48</span>
                  <span>-∞</span>
                </div>

                {/* Long-Throw Tactile Fader Groove & Thumb Cap */}
                <div className="w-6 h-full bg-surface-container-lowest rounded relative flex justify-center shadow-inner py-1">
                  <div className="w-1 h-full bg-surface-container-high rounded-full" />
                  <input
                    type="range"
                    min="0"
                    max="1.25"
                    step="0.01"
                    value={state.volume}
                    onChange={(e) => onStemVolumeChange(stem, parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize"
                  />
                  {/* Visual Fader Cap */}
                  <div
                    className="absolute w-8 h-4 bg-gradient-to-b from-surface-bright to-surface-container-high rounded shadow-md border-t border-white/20 flex items-center justify-center pointer-events-none"
                    style={{
                      bottom: `calc(${Math.min(100, (state.volume / 1.25) * 100)}% - 8px)`,
                    }}
                  >
                    <div
                      className="w-full h-0.5 shadow-[0_0_4px_currentColor]"
                      style={{ backgroundColor: config.accent, color: config.accent }}
                    />
                  </div>
                </div>

                {/* Multi-Segment Vertical LED VU Meter (Stereo Left & Right) */}
                <div className="flex gap-0.5 h-full py-1">
                  <div className="w-1.5 h-full bg-surface-container-lowest rounded-sm flex flex-col-reverse justify-start gap-0.5 p-0.5">
                    <div
                      className="w-full rounded-sm transition-all duration-75"
                      style={{
                        height: `${vu}%`,
                        background:
                          vu > 85
                            ? "linear-gradient(to top, #22c55e 0%, #f59e0b 70%, #ef4444 100%)"
                            : vu > 65
                            ? "linear-gradient(to top, #22c55e 0%, #f59e0b 100%)"
                            : "#22c55e",
                        boxShadow: vu > 10 ? `0 0 6px ${config.accent}` : "none",
                      }}
                    />
                  </div>
                  <div className="w-1.5 h-full bg-surface-container-lowest rounded-sm flex flex-col-reverse justify-start gap-0.5 p-0.5">
                    <div
                      className="w-full rounded-sm transition-all duration-75"
                      style={{
                        height: `${Math.max(0, vu - 3)}%`,
                        background:
                          vu > 85
                            ? "linear-gradient(to top, #22c55e 0%, #f59e0b 70%, #ef4444 100%)"
                            : vu > 65
                            ? "linear-gradient(to top, #22c55e 0%, #f59e0b 100%)"
                            : "#22c55e",
                        boxShadow: vu > 10 ? `0 0 6px ${config.accent}` : "none",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Digital Peak Hold Readout */}
              <div
                className="bg-surface-container-lowest py-0.5 text-center font-meter-tick text-meter-tick rounded font-mono"
                style={{ color: config.accent }}
              >
                {formatDb(state.volume)}
              </div>

              {/* Bottom Identification Plate */}
              <div className="bg-surface-container-low p-1 rounded mt-1 flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-on-surface-variant">{config.badge}</span>
                  <div className="flex gap-1 text-[9px] font-mono">
                    <span className="text-tertiary">R</span>
                    <span className="text-on-surface-variant">W</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className="w-1.5 h-3 rounded-sm"
                    style={{ backgroundColor: config.accent }}
                  />
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface truncate">
                    {config.name}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Master Buss Channel Strip - Grand Master */}
        <div className="w-channel-w-wide shrink-0 bg-surface-container-high flex flex-col justify-between border-r-2 border-surface-container-highest p-1 shadow-lg">
          <div className="flex flex-col items-center gap-0.5 bg-surface-container-lowest p-1 rounded">
            <span className="font-meter-tick text-meter-tick text-primary font-bold">MASTER BUS</span>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary shadow-[0_0_4px_#4ae176]" />
              <span className="font-meter-tick text-meter-tick text-on-surface">48 kHz</span>
            </div>
          </div>

          <div className="flex flex-col gap-0.5 my-1 font-label-sm text-[9px]">
            <div className="px-1 py-0.5 bg-surface-container-lowest rounded text-primary truncate">SSL Bus+</div>
            <div className="px-1 py-0.5 bg-surface-container-lowest rounded text-secondary truncate">Ozone 11</div>
            <div className="px-1 py-0.5 bg-surface-container-lowest rounded text-tertiary truncate">Pro-L 2</div>
            <div className="px-1 py-0.5 bg-surface-container-lowest rounded text-on-surface truncate">Insight 2</div>
          </div>

          {onDjFilterChange && (
            <div className="bg-surface-container-lowest p-1 rounded flex flex-col gap-1">
              <div className="flex items-center justify-between text-[9px] font-mono text-on-surface-variant">
                <span>FILTER</span>
                <span className="text-primary font-bold">
                  {djFilterCutoff > 1000 ? `${(djFilterCutoff / 1000).toFixed(1)}k` : `${djFilterCutoff}`}
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="20000"
                step="50"
                value={djFilterCutoff}
                onChange={(e) => onDjFilterChange(parseFloat(e.target.value), djFilterType, djFilterQ)}
                className="w-full h-1 bg-surface-container-highest rounded cursor-pointer accent-primary"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-0.5 my-1">
            <button className="h-5 flex items-center justify-center font-bold text-[10px] bg-surface-container text-on-surface-variant rounded-sm">M</button>
            <button className="h-5 flex items-center justify-center font-bold text-[10px] bg-surface-container text-on-surface-variant rounded-sm">DIM</button>
          </div>

          {/* Master Long Throw Fader */}
          <div className="flex-1 flex items-center justify-center gap-1 px-1 py-1 relative min-h-[140px]">
            <div className="w-7 h-full bg-surface-container-lowest rounded relative flex justify-center shadow-inner py-1">
              <div className="w-1.5 h-full bg-surface-container rounded-full" />
              <input
                type="range"
                min="0"
                max="1.25"
                step="0.01"
                value={masterVolume}
                onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize"
              />
              {/* Large Red/White Master Fader Cap */}
              <div
                className="absolute w-9 h-5 bg-gradient-to-b from-error to-error-container rounded shadow-xl border-t border-white/40 flex items-center justify-center pointer-events-none"
                style={{
                  bottom: `calc(${Math.min(100, (masterVolume / 1.25) * 100)}% - 10px)`,
                }}
              >
                <div className="w-full h-0.5 bg-white shadow-[0_0_6px_#ffffff]" />
              </div>
            </div>

            {/* Master High-Density Stereophonic LED VU Ladder */}
            <div className="flex gap-0.5 h-full py-1">
              <div className="w-2 h-full bg-surface-container-lowest rounded-sm flex flex-col-reverse justify-start gap-0.5 p-0.5">
                <div
                  className="w-full rounded-sm transition-all duration-75"
                  style={{
                    height: `${masterVu}%`,
                    background:
                      masterVu > 85
                        ? "linear-gradient(to top, #22c55e 0%, #f59e0b 70%, #ef4444 100%)"
                        : masterVu > 65
                        ? "linear-gradient(to top, #22c55e 0%, #f59e0b 100%)"
                        : "#22c55e",
                    boxShadow: masterVu > 10 ? "0 0 6px #4ae176" : "none",
                  }}
                />
              </div>
              <div className="w-2 h-full bg-surface-container-lowest rounded-sm flex flex-col-reverse justify-start gap-0.5 p-0.5">
                <div
                  className="w-full rounded-sm transition-all duration-75"
                  style={{
                    height: `${Math.max(0, masterVu - 2)}%`,
                    background:
                      masterVu > 85
                        ? "linear-gradient(to top, #22c55e 0%, #f59e0b 70%, #ef4444 100%)"
                        : masterVu > 65
                        ? "linear-gradient(to top, #22c55e 0%, #f59e0b 100%)"
                        : "#22c55e",
                    boxShadow: masterVu > 10 ? "0 0 6px #4ae176" : "none",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest py-0.5 text-center font-meter-tick text-meter-tick text-error rounded font-mono font-bold shadow-[0_0_6px_rgba(239,68,68,0.4)]">
            {formatDb(masterVolume)} PEAK
          </div>

          <div className="bg-surface-container-lowest p-1 rounded mt-1 flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-mono text-primary font-bold">MAIN</span>
              <span className="text-tertiary font-mono text-[9px]">MAIN BUSS</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-3 bg-primary rounded-sm shadow-[0_0_4px_#89ceff]" />
              <span className="font-headline-sm text-headline-sm font-bold text-primary truncate">
                STEREO OUT
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

