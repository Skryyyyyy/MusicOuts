import React from "react";
import {
  Play,
  Pause,
  Square,
  SkipBack,
  RotateCcw,
  Repeat,
  Sliders,
  Cpu,
  Zap,
  Mic,
  VolumeX,
  Radio,
  CircleDot,
  RefreshCw,
  Layers,
  Sparkles,
  Activity,
  Download,
} from "lucide-react";
import { AudioGraphEngine } from "../engine/audioGraph";
import { ProcessStatus, StudioView } from "../types";

export interface DawTransportProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLooping: boolean;
  isReady: boolean;
  isLoadingStems?: boolean;
  processStatus?: ProcessStatus;
  masterVolume: number;
  djFilterCutoff: number;
  djFilterType: "lowpass" | "highpass";
  isDucking: boolean;
  duckingReduction: number;
  audioGraph?: AudioGraphEngine | null;
  currentView?: StudioView;
  onViewChange?: (view: StudioView) => void;
  onPlayToggle: () => void;
  onStop: () => void;
  onSeek: (seconds: number) => void;
  onReset: () => void;
  onLoopToggle: () => void;
  onDuckingToggle: () => void;
  onMasterVolumeChange: (vol: number) => void;
  onDjFilterChange: (cutoff: number, type: "lowpass" | "highpass") => void;
  className?: string;
}

const VIEW_TABS: { id: StudioView; label: string; icon: React.ReactNode; hotkey: string }[] = [
  { id: "arrangement", label: "Arrangement", icon: <Layers className="w-3.5 h-3.5" />, hotkey: "1" },
  { id: "mixer", label: "MixConsole", icon: <Sliders className="w-3.5 h-3.5" />, hotkey: "2" },
  { id: "gesture", label: "Gesture Lab", icon: <Sparkles className="w-3.5 h-3.5" />, hotkey: "3" },
  { id: "visualizer", label: "Visual Stage", icon: <Activity className="w-3.5 h-3.5" />, hotkey: "4" },
  { id: "ingestion", label: "Demix Lab", icon: <Download className="w-3.5 h-3.5" />, hotkey: "5" },
];

export const DawTransport: React.FC<DawTransportProps> = ({
  isPlaying,
  currentTime,
  duration,
  isLooping,
  isReady,
  isLoadingStems = false,
  processStatus,
  masterVolume,
  djFilterCutoff,
  djFilterType,
  isDucking,
  duckingReduction,
  currentView = "arrangement",
  onViewChange,
  onPlayToggle,
  onStop,
  onReset,
  onLoopToggle,
  onDuckingToggle,
  onMasterVolumeChange,
  onDjFilterChange,
  className = "",
}) => {
  const formatTimecode = (secs: number): string => {
    if (isNaN(secs) || secs < 0) return "00:00.00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  const formatBarsBeats = (secs: number): string => {
    if (isNaN(secs) || secs < 0) return "001.01.00";
    const totalBeats = (secs / 60) * 120;
    const bar = Math.floor(totalBeats / 4) + 1;
    const beat = Math.floor(totalBeats % 4) + 1;
    const sub = Math.floor((totalBeats % 1) * 16);
    return `${bar.toString().padStart(3, "0")}.${beat.toString().padStart(2, "0")}.${sub.toString().padStart(2, "0")}`;
  };

  const duckingDb =
    duckingReduction < 0.99
      ? `${(20 * Math.log10(Math.max(0.01, duckingReduction))).toFixed(1)} dB`
      : "ACTIVE";

  const masterDb =
    masterVolume > 0.01
      ? `${(20 * Math.log10(masterVolume)).toFixed(1)} dB`
      : "-∞ dB";

  return (
    <header
      className={`bg-[#17181c] border-b border-[#282a32] px-4 py-2 flex flex-wrap items-center justify-between gap-3 select-none z-40 ${className}`}
    >
      {/* 1. Left Section: Logo & Timecode Recessed LCD Display */}
      <div className="flex items-center space-x-3">
        {/* Brand Logo & Project Tag */}
        <div className="flex items-center space-x-2.5 pr-3 border-r border-[#282a32]">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-white to-zinc-400 flex items-center justify-center shadow-sm">
            <Radio className="w-4 h-4 text-black stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-black text-sm tracking-wider text-zinc-100 font-mono">
                MUSICOUTS
              </span>
              <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                PRO STUDIO
              </span>
            </div>
            <p className="text-[9px] text-zinc-500 font-mono tracking-tight leading-none mt-0.5">
              Neural Demucs &amp; Spatial Engine
            </p>
          </div>
        </div>

        {/* Recessed LCD Telemetry Display */}
        <div className="flex items-center space-x-2 bg-[#0d0e11] px-3 py-1 rounded border border-[#22242c] shadow-inner">
          {/* Timecode */}
          <div className="flex flex-col min-w-[72px]">
            <div className="flex items-center justify-between text-[7px] font-mono uppercase text-zinc-500 font-semibold tracking-wider">
              <span>TIMECODE</span>
              <span className="text-zinc-600 font-normal">/{formatTimecode(duration)}</span>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-300 tracking-wider leading-none pt-0.5">
              {formatTimecode(currentTime)}
            </span>
          </div>

          <div className="h-5 w-px bg-[#22242c]" />

          {/* Bar & Beat */}
          <div className="flex flex-col min-w-[65px]">
            <span className="text-[7px] font-mono uppercase text-zinc-500 font-semibold tracking-wider">
              BAR.BEAT
            </span>
            <span className="text-xs font-mono font-bold text-amber-300 tracking-wider leading-none pt-0.5">
              {formatBarsBeats(currentTime)}
            </span>
          </div>

          <div className="h-5 w-px bg-[#22242c]" />

          {/* Tempo & Signature */}
          <div className="flex flex-col min-w-[60px]">
            <span className="text-[7px] font-mono uppercase text-zinc-500 font-semibold tracking-wider">
              TEMPO / SIG
            </span>
            <span className="text-[11px] font-mono font-bold text-zinc-300 tracking-wide leading-none pt-0.5">
              120.00 <span className="text-zinc-500">4/4</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Workspace View Tabs (Page Switcher) */}
      {onViewChange && (
        <nav className="flex items-center bg-[#101114] p-1 rounded-lg border border-[#252830] space-x-1">
          {VIEW_TABS.map((tab) => {
            const isActive = currentView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onViewChange(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all flex items-center space-x-1.5 ${
                  isActive
                    ? "bg-cyan-600 text-white shadow-md border border-cyan-400/50"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-[#1a1b22]"
                }`}
                title={`Switch to ${tab.label} (Press ${tab.hotkey})`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded ${
                    isActive ? "bg-cyan-700/50 text-cyan-200" : "bg-[#181920] text-zinc-500"
                  }`}
                >
                  {tab.hotkey}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* 3. Transport Controls */}
      <div className="flex items-center space-x-1.5 bg-[#121316] p-1 rounded-lg border border-[#262830]">
        {/* Return to Left Locator (0:00) */}
        <button
          onClick={onReset}
          disabled={!isReady}
          className="p-1.5 rounded bg-[#1c1e24] hover:bg-[#252830] border border-[#2d303a] text-zinc-300 hover:text-white transition-all disabled:opacity-30"
          title="Return to Zero (Home)"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        {/* Rewind */}
        <button
          onClick={() => onReset()}
          disabled={!isReady}
          className="p-1.5 rounded bg-[#1c1e24] hover:bg-[#252830] border border-[#2d303a] text-zinc-300 hover:text-white transition-all disabled:opacity-30"
          title="Rewind to Beginning"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Stop Button */}
        <button
          onClick={onStop}
          disabled={!isReady}
          className={`p-1.5 rounded border transition-all ${
            !isPlaying
              ? "bg-[#252830] border-zinc-500 text-white shadow-sm"
              : "bg-[#1c1e24] border-[#2d303a] text-zinc-400 hover:text-white"
          }`}
          title="Stop Playback"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
        </button>

        {/* Play / Pause Main Button */}
        {(() => {
          const isProcessing =
            processStatus?.stage === "downloading" ||
            processStatus?.stage === "separating" ||
            processStatus?.stage === "queued";

          return (
            <button
              onClick={onPlayToggle}
              disabled={isProcessing || isLoadingStems}
              className={`px-3.5 py-1.5 rounded flex items-center space-x-1.5 font-mono text-xs font-bold transition-all ${
                isProcessing
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.3)] animate-pulse cursor-wait"
                  : isLoadingStems
                  ? "bg-amber-950 text-amber-300 border border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse cursor-wait"
                  : isPlaying
                  ? "bg-emerald-600 text-white border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:bg-emerald-500"
                  : isReady
                  ? "bg-zinc-100 text-black hover:bg-white border border-white hover:scale-105"
                  : "bg-[#1c1e24] text-zinc-400 hover:text-white border border-[#2d303a]"
              }`}
              title={
                isProcessing
                  ? `Demucs Pipeline: ${processStatus?.message}`
                  : isLoadingStems
                  ? "Decoding 4 audio stems into Web Audio Graph..."
                  : isPlaying
                  ? "Pause Playback"
                  : isReady
                  ? "Start Playback"
                  : "No audio stems loaded yet. Paste a link or drop a file to demix stems."
              }
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span>
                    {processStatus?.stage === "downloading" ? "DOWNLOADING" : "DEMIXING"}{" "}
                    {Math.round(processStatus?.progress || 0)}%
                  </span>
                </>
              ) : isLoadingStems ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>DECODING STEMS...</span>
                </>
              ) : isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>PAUSE</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isReady ? "PLAY" : "DEMIX TO PLAY"}</span>
                </>
              )}
            </button>
          );
        })()}

        {/* Gesture Record Arm Indicator */}
        <div
          className="p-1.5 rounded bg-[#1c1e24] border border-[#2d303a] text-red-500 flex items-center justify-center"
          title="Gesture Link Tracking Ready"
        >
          <CircleDot className="w-3.5 h-3.5 animate-pulse" />
        </div>

        {/* Cycle / Loop Toggle */}
        <button
          onClick={onLoopToggle}
          className={`px-2.5 py-1.5 rounded border text-xs font-mono font-semibold transition-all flex items-center space-x-1 ${
            isLooping
              ? "bg-cyan-600 text-white border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
              : "bg-[#1c1e24] border-[#2d303a] text-zinc-400 hover:text-white"
          }`}
          title={isLooping ? "Cycle / Loop Enabled" : "Cycle / Loop Disabled"}
        >
          <Repeat className="w-3 h-3" />
          <span className="text-[11px]">CYCLE</span>
        </button>

        {/* Auto Sidechain Ducking Toggle */}
        <button
          onClick={onDuckingToggle}
          className={`px-2.5 py-1.5 rounded border text-xs font-mono font-semibold transition-all flex items-center space-x-1 ${
            isDucking
              ? "bg-purple-600 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
              : "bg-[#1c1e24] border-[#2d303a] text-zinc-400 hover:text-white"
          }`}
          title="Auto Sidechain Ducking: Attenuates backing instruments when lead vocals appear"
        >
          {isDucking ? <Mic className="w-3 h-3 fill-current" /> : <VolumeX className="w-3 h-3" />}
          <span className="text-[11px]">DUCKING {isDucking ? "AUTO" : "OFF"}</span>
          {isDucking && duckingReduction < 0.95 && (
            <span className="ml-1 text-[8px] px-1 py-0.2 bg-black text-purple-200 rounded font-mono font-bold">
              {duckingDb}
            </span>
          )}
        </button>
      </div>

      {/* 4. Right Section: Master Output Strip & DJ Filter Sweep */}
      <div className="flex items-center space-x-3">
        {/* DJ Biquad Filter Sweep */}
        <div className="flex items-center space-x-2 bg-[#121316] px-2.5 py-1 rounded border border-[#262830]">
          <Sliders className="w-3.5 h-3.5 text-zinc-400" />
          <div className="flex flex-col">
            <div className="flex items-center justify-between text-[7px] font-mono text-zinc-400 space-x-2">
              <span>DJ FILTER ({djFilterType === "highpass" ? "HP" : "LP"})</span>
              <span className="text-zinc-200 font-bold">
                {djFilterCutoff < 1000
                  ? `${Math.round(djFilterCutoff)} Hz`
                  : `${(djFilterCutoff / 1000).toFixed(1)} kHz`}
              </span>
            </div>
            <input
              type="range"
              min="200"
              max="20000"
              step="100"
              value={djFilterCutoff}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onDjFilterChange(val, val < 2000 ? "highpass" : "lowpass");
              }}
              className="w-16 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-cyan-400"
              title="Master DJ Filter Sweep"
            />
          </div>
        </div>

        {/* Master Output Gain Fader */}
        <div className="flex items-center space-x-2 bg-[#121316] px-2.5 py-1 rounded border border-[#262830]">
          <div className="flex flex-col">
            <div className="flex items-center justify-between text-[7px] font-mono text-zinc-400 space-x-2">
              <span>MASTER OUT</span>
              <span className="text-zinc-200 font-bold">{masterDb}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.01"
              value={masterVolume}
              onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
              className="w-16 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
              title="Master Output Level"
            />
          </div>
        </div>

        {/* Hardware & DSP Telemetry */}
        <div className="hidden 2xl:flex items-center space-x-1.5 text-[9px] font-mono">
          <div className="flex items-center space-x-1 px-2 py-1 bg-[#121316] rounded border border-[#262830]">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span className="text-zinc-400">CUDA:</span>
            <span className="text-zinc-200 font-bold">RTX 2050</span>
          </div>
          <div className="flex items-center space-x-1 px-2 py-1 bg-[#121316] rounded border border-[#262830]">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-zinc-400">DSP:</span>
            <span className="text-zinc-200 font-bold">60 FPS</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DawTransport;
