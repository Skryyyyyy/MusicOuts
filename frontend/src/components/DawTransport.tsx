import React, { useState } from "react";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Repeat,
  Sliders,
  Cpu,
  Mic,
  Layers,
  Sparkles,
  Activity,
  Download,
  HelpCircle,
  FolderOpen,
  Save,
  Music,
  Clock,
  RadioTower,
  Wand2,
} from "lucide-react";
import { AudioGraphEngine } from "../engine/audioGraph";
import { ProcessStatus, StudioView, StudioMode, HardwareInfo } from "../types";

export interface DawTransportProps {
  isPlaying: boolean;
  currentTime: number;
  duration?: number;
  isLooping: boolean;
  isReady?: boolean;
  isLoadingStems?: boolean;
  processStatus?: ProcessStatus;
  masterVolume?: number;
  djFilterCutoff?: number;
  djFilterType?: "lowpass" | "highpass";
  isDucking: boolean;
  duckingReduction: number;
  audioGraph?: AudioGraphEngine | null;
  currentView?: StudioView;
  mode?: StudioMode;
  hardwareInfo?: HardwareInfo | null;
  isRecordingAutomation?: boolean;
  isCapturingPerformance?: boolean;
  isSynthOpen?: boolean;
  onModeChange?: (mode: StudioMode) => void;
  onViewChange?: (view: StudioView) => void;
  onOpenGuide?: () => void;
  onOpenSynth?: () => void;
  onSaveProject?: () => void;
  onOpenProject?: () => void;
  onToggleRecordAutomation?: () => void;
  onToggleCapturePerformance?: () => void;
  onPlayToggle: () => void;
  onStop: () => void;
  onSeek?: (seconds: number) => void;
  onReset: () => void;
  onLoopToggle: () => void;
  onDuckingToggle: () => void;
  onMasterVolumeChange?: (vol: number) => void;
  onDjFilterChange?: (cutoff: number, type: "lowpass" | "highpass") => void;
  className?: string;
}

const PRIMARY_VIEWS: { id: StudioView; label: string; icon: React.ReactNode; hotkey: string }[] = [
  { id: "arrangement", label: "Arrangement", icon: <Layers className="w-3.5 h-3.5" />, hotkey: "1" },
  { id: "mixer", label: "MixConsole", icon: <Sliders className="w-3.5 h-3.5" />, hotkey: "2" },
  { id: "fxrack", label: "FX Rack", icon: <Wand2 className="w-3.5 h-3.5" />, hotkey: "3" },
  { id: "gesture", label: "Gesture Lab", icon: <Sparkles className="w-3.5 h-3.5" />, hotkey: "4" },
  { id: "visualizer", label: "Visual Stage", icon: <Activity className="w-3.5 h-3.5" />, hotkey: "5" },
];

export const DawTransport: React.FC<DawTransportProps> = ({
  isPlaying,
  currentTime,
  isLooping,
  isDucking,
  duckingReduction,
  currentView = "arrangement",
  mode = "producer",
  hardwareInfo,
  isRecordingAutomation = false,
  isCapturingPerformance = false,
  isSynthOpen = false,
  onModeChange,
  onViewChange,
  onOpenGuide,
  onOpenSynth,
  onSaveProject,
  onOpenProject,
  onToggleRecordAutomation,
  onToggleCapturePerformance,
  onPlayToggle,
  onStop,
  onReset,
  onLoopToggle,
  onDuckingToggle,
  className = "",
}) => {
  const [showTimeInBars, setShowTimeInBars] = useState<boolean>(false);

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

  return (
    <header
      className={`mx-3 mt-2.5 mb-1.5 px-4 py-2 bg-[#14161f]/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-wrap items-center justify-between gap-3 select-none z-40 transition-all ${className}`}
    >
      {/* 1. Left Section: Splice Brand & Workspace Navigation Capsule */}
      <div className="flex items-center space-x-3">
        {/* Brand Logo & Splice Badge */}
        <div className="flex items-center space-x-2.5 pr-3 border-r border-white/[0.08]">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-400 to-blue-600 flex items-center justify-center shadow-[0_0_16px_rgba(6,182,212,0.5)]">
            <RadioTower className="w-4 h-4 text-black" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-[13px] tracking-wider uppercase text-white font-mono leading-none">
              MusicOuts
            </span>
            <span className="text-[8px] font-mono font-bold text-cyan-400 tracking-widest leading-tight">
              IPAD DAW
            </span>
          </div>
        </div>

        {/* Studio Mode Switcher: PERFORMANCE vs PRODUCER */}
        {onModeChange && (
          <div className="flex items-center bg-[#0a0b10] p-0.5 rounded-xl border border-white/[0.06] text-[10px] font-mono">
            <button
              onClick={() => onModeChange("performance")}
              className={`px-2.5 py-1 rounded-lg font-bold uppercase transition-all ${
                mode === "performance"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Perform
            </button>
            <button
              onClick={() => onModeChange("producer")}
              className={`px-2.5 py-1 rounded-lg font-bold uppercase transition-all ${
                mode === "producer"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Studio
            </button>
          </div>
        )}

        {/* Primary Workspace Pill Tabs (Splice DAW Tab Bar) */}
        {onViewChange && (
          <div className="flex items-center space-x-1 bg-[#0a0b10] p-1 rounded-xl border border-white/[0.06]">
            {PRIMARY_VIEWS.map((tab) => {
              const isActive = currentView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onViewChange(tab.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
                  }`}
                  title={`${tab.label} (Press ${tab.hotkey})`}
                >
                  {tab.icon}
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Middle Section: OLED Timecode & Tactile Transport Controls */}
      <div className="flex items-center space-x-2.5">
        {/* Glossy OLED Timecode & BPM Display Screen */}
        <div
          onClick={() => setShowTimeInBars((v) => !v)}
          className="bg-black/90 border border-cyan-500/30 rounded-xl px-3.5 py-1.5 flex items-center space-x-2.5 cursor-pointer hover:border-cyan-400 transition-all shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]"
          title="Click to toggle Timecode vs Bars & Beats"
        >
          <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <div className="font-mono text-xs font-extrabold text-cyan-300 tracking-widest min-w-[76px] text-center">
            {showTimeInBars ? formatBarsBeats(currentTime) : formatTimecode(currentTime)}
          </div>
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-bold">
            {showTimeInBars ? "BARS" : "SMPTE"}
          </span>
        </div>

        {/* Transport Control Buttons */}
        <div className="flex items-center space-x-1 bg-[#0a0b10] p-1 rounded-xl border border-white/[0.06]">
          {/* Return to 0:00 */}
          <button
            onClick={onReset}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
            title="Return to 0:00 (Home / R)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Stop */}
          <button
            onClick={onStop}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
            title="Stop Playback"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Play / Pause Glow Button */}
          <button
            onClick={onPlayToggle}
            className={`px-4 py-1.5 rounded-xl font-mono font-extrabold text-xs flex items-center space-x-2 transition-all ${
              isPlaying
                ? "bg-gradient-to-r from-emerald-400 to-teal-500 text-black shadow-[0_0_20px_rgba(52,211,153,0.6)] hover:scale-105"
                : "bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 text-black shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:scale-105"
            }`}
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-black" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>PLAY</span>
              </>
            )}
          </button>

          {/* Loop Toggle */}
          <button
            onClick={onLoopToggle}
            className={`p-2 rounded-lg transition-all ${
              isLooping
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
            }`}
            title="Toggle Loop Cycle (L)"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Auto Sidechain Ducking Pill */}
          <button
            onClick={onDuckingToggle}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
              isDucking
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                : "bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border border-white/[0.06]"
            }`}
            title="Auto-Ducking: Lowers backing stems when vocals play"
          >
            <Mic className="w-3 h-3" />
            <span>{isDucking ? `DUCK: ${duckingDb}` : "DUCK OFF"}</span>
          </button>
        </div>
      </div>

      {/* 3. Right Section: Splice Studio Actions & Telemetry */}
      <div className="flex items-center space-x-2">
        {/* Record Automation Button */}
        {onToggleRecordAutomation && (
          <button
            onClick={onToggleRecordAutomation}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all ${
              isRecordingAutomation
                ? "bg-pink-600 text-white animate-pulse shadow-[0_0_16px_rgba(236,72,153,0.8)]"
                : "bg-[#0a0b10] text-pink-400 hover:bg-pink-500/10 border border-pink-500/30"
            }`}
            title="Record Gestures & Mixer Automation in Real-Time"
          >
            <div className={`w-2 h-2 rounded-full ${isRecordingAutomation ? "bg-white" : "bg-pink-500"}`} />
            <span className="hidden lg:inline">{isRecordingAutomation ? "REC AUTO" : "AUTO"}</span>
          </button>
        )}

        {/* Capture Performance Button */}
        {onToggleCapturePerformance && (
          <button
            onClick={onToggleCapturePerformance}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all ${
              isCapturingPerformance
                ? "bg-red-600 text-white animate-pulse shadow-[0_0_16px_rgba(239,68,68,0.8)]"
                : "bg-[#0a0b10] text-amber-400 hover:bg-amber-500/10 border border-amber-500/30"
            }`}
            title="Capture Full Live Gesture & Mixer Performance Session"
          >
            <div className={`w-2 h-2 rounded-full ${isCapturingPerformance ? "bg-white" : "bg-amber-500"}`} />
            <span className="hidden lg:inline">{isCapturingPerformance ? "CAPTURING" : "CAPTURE"}</span>
          </button>
        )}

        {/* Virtual Synth Drawer Button */}
        {onOpenSynth && (
          <button
            onClick={onOpenSynth}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all ${
              isSynthOpen
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50"
                : "bg-[#0a0b10] text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-white/[0.06]"
            }`}
            title="Virtual Web Synthesizer & Piano Roll"
          >
            <Music className="w-3 h-3 text-cyan-400" />
            <span className="hidden xl:inline">SYNTH</span>
          </button>
        )}

        {/* Demix Lab Shortcut */}
        {onViewChange && (
          <button
            onClick={() => onViewChange("ingestion")}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all ${
              currentView === "ingestion"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50"
                : "bg-[#0a0b10] text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-white/[0.06]"
            }`}
            title="AI Stem Separation & Ingestion"
          >
            <Download className="w-3 h-3 text-cyan-400" />
            <span className="hidden xl:inline">DEMIX</span>
          </button>
        )}

        {/* Project Actions: Save / Open */}
        {onSaveProject && (
          <button
            onClick={onSaveProject}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-[#0a0b10] hover:bg-white/[0.04] text-zinc-300 hover:text-white border border-white/[0.06] rounded-xl text-[10px] font-mono font-bold transition-all"
            title="Save Project File (.musicouts)"
          >
            <Save className="w-3 h-3 text-emerald-400" />
            <span className="hidden xl:inline">SAVE</span>
          </button>
        )}

        {onOpenProject && (
          <button
            onClick={onOpenProject}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-[#0a0b10] hover:bg-white/[0.04] text-zinc-300 hover:text-white border border-white/[0.06] rounded-xl text-[10px] font-mono font-bold transition-all"
            title="Open Project File (.musicouts)"
          >
            <FolderOpen className="w-3 h-3 text-cyan-400" />
            <span className="hidden xl:inline">OPEN</span>
          </button>
        )}

        {/* Guide Modal Button */}
        {onOpenGuide && (
          <button
            onClick={onOpenGuide}
            className="p-2 bg-[#0a0b10] hover:bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06] rounded-xl text-[10px] font-mono font-bold transition-all"
            title="Studio Tour & Guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Real Hardware Acceleration Chip */}
        <div
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-black/60 border border-white/[0.08] text-[10px] font-mono select-none"
          title={`Hardware: ${hardwareInfo?.device_name || "CPU Engine"} (${hardwareInfo?.vram_gb || 0}GB VRAM, ${hardwareInfo?.cpu_threads || 8} Cores)`}
        >
          <Cpu className={`w-3 h-3 ${hardwareInfo?.cuda_available ? "text-cyan-400" : "text-amber-400"}`} />
          <span className="text-zinc-200 font-bold hidden sm:inline">
            {hardwareInfo?.cuda_available ? "CUDA" : "CPU"}
          </span>
          <span className="text-[9px] text-zinc-500 hidden md:inline">
            {hardwareInfo?.vram_gb ? `${hardwareInfo.vram_gb}GB` : "8GB"}
          </span>
        </div>
      </div>
    </header>
  );
};

export default DawTransport;
