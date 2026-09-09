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
      className={`bg-[#15161b] border-b border-[#262832] px-3.5 py-1.5 flex flex-wrap items-center justify-between gap-2.5 select-none z-40 ${className}`}
    >
      {/* 1. Left Section: Logo & Mode Pill & Workspaces */}
      <div className="flex items-center space-x-2.5">
        {/* Brand Logo */}
        <div className="flex items-center space-x-2 pr-2 border-r border-[#2a2c36]">
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.4)]">
            <RadioTower className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="font-bold text-xs tracking-wider uppercase text-zinc-100 font-mono hidden sm:inline">
            MusicOuts
          </span>
        </div>

        {/* Studio Mode Selector: PERFORMANCE vs PRODUCER */}
        {onModeChange && (
          <div className="flex items-center bg-[#0c0d10] p-0.5 rounded-lg border border-[#23252f] text-[10px] font-mono">
            <button
              onClick={() => onModeChange("performance")}
              className={`px-2 py-1 rounded-md font-bold uppercase transition-all ${
                mode === "performance"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Performance
            </button>
            <button
              onClick={() => onModeChange("producer")}
              className={`px-2 py-1 rounded-md font-bold uppercase transition-all ${
                mode === "producer"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Producer
            </button>
          </div>
        )}

        {/* Primary Workspace Tabs */}
        {onViewChange && (
          <div className="flex items-center space-x-1 bg-[#0c0d10] p-0.5 rounded-lg border border-[#23252f]">
            {PRIMARY_VIEWS.map((tab) => {
              const isActive = currentView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onViewChange(tab.id)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-all ${
                    isActive
                      ? "bg-[#252834] text-cyan-300 border border-cyan-500/30 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-[#181920]"
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

      {/* 2. Middle Section: Transport & Timecode Display */}
      <div className="flex items-center space-x-2">
        {/* Recessed Timecode Display */}
        <div
          onClick={() => setShowTimeInBars((v) => !v)}
          className="bg-[#090a0d] border border-[#20222a] rounded-lg px-2.5 py-1 flex items-center space-x-2 cursor-pointer hover:border-cyan-500/40 transition-colors shadow-inner"
          title="Click to toggle Timecode vs Bars & Beats"
        >
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <div className="font-mono text-xs font-bold text-cyan-300 tracking-widest min-w-[72px] text-center">
            {showTimeInBars ? formatBarsBeats(currentTime) : formatTimecode(currentTime)}
          </div>
          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/50">
            {showTimeInBars ? "BARS" : "SMPTE"}
          </span>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center space-x-1 bg-[#0c0d10] p-1 rounded-lg border border-[#23252f]">
          {/* Return to 0:00 */}
          <button
            onClick={onReset}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#20222b] rounded transition-all"
            title="Return to 0:00 (Home)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Stop */}
          <button
            onClick={onStop}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#20222b] rounded transition-all"
            title="Stop Playback"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Play / Pause Primary Button */}
          <button
            onClick={onPlayToggle}
            className={`px-3 py-1 rounded-md font-mono font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md ${
              isPlaying
                ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.3)]"
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
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>PLAY</span>
              </>
            )}
          </button>

          {/* Loop Cycle */}
          <button
            onClick={onLoopToggle}
            className={`p-1.5 rounded transition-all ${
              isLooping
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-zinc-400 hover:text-white hover:bg-[#20222b]"
            }`}
            title="Toggle Loop Cycle (L)"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Auto Sidechain Ducking */}
          <button
            onClick={onDuckingToggle}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
              isDucking
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                : "bg-[#16171d] text-zinc-500 hover:text-zinc-300 border border-[#262832]"
            }`}
            title="Auto-Ducking: Lowers backing stems by -9dB when vocals play"
          >
            <Mic className="w-3 h-3" />
            <span>{isDucking ? `DUCK: ${duckingDb}` : "DUCK OFF"}</span>
          </button>
        </div>
      </div>

      {/* 3. Right Section: Production Tools & Project Actions */}
      <div className="flex items-center space-x-1.5">
        {/* Record Automation Button */}
        {onToggleRecordAutomation && (
          <button
            onClick={onToggleRecordAutomation}
            className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
              isRecordingAutomation
                ? "bg-pink-600 text-white animate-pulse shadow-[0_0_12px_rgba(236,72,153,0.7)]"
                : "bg-[#101115] text-pink-400 hover:bg-[#20212b] border border-pink-500/30"
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
            className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
              isCapturingPerformance
                ? "bg-red-600 text-white animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.7)]"
                : "bg-[#101115] text-amber-400 hover:bg-[#20212b] border border-amber-500/30"
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
            className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
              isSynthOpen
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50"
                : "bg-[#101115] text-zinc-400 hover:text-white hover:bg-[#20212b] border border-[#262832]"
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
            className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
              currentView === "ingestion"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50"
                : "bg-[#101115] text-zinc-400 hover:text-white hover:bg-[#20212b] border border-[#262832]"
            }`}
            title="AI Stem Separation & Ingestion"
          >
            <Download className="w-3 h-3 text-cyan-400" />
            <span className="hidden xl:inline">DEMIX</span>
          </button>
        )}

        {/* Save / Open Project Buttons */}
        {onSaveProject && (
          <button
            onClick={onSaveProject}
            className="flex items-center space-x-1 px-2 py-1 bg-[#101115] hover:bg-[#20212b] text-zinc-300 hover:text-white border border-[#262832] rounded-md text-[10px] font-mono font-bold transition-all"
            title="Save Project File (.musicouts)"
          >
            <Save className="w-3 h-3 text-emerald-400" />
            <span className="hidden xl:inline">SAVE</span>
          </button>
        )}

        {onOpenProject && (
          <button
            onClick={onOpenProject}
            className="flex items-center space-x-1 px-2 py-1 bg-[#101115] hover:bg-[#20212b] text-zinc-300 hover:text-white border border-[#262832] rounded-md text-[10px] font-mono font-bold transition-all"
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
            className="p-1 bg-[#101115] hover:bg-[#20212b] text-zinc-400 hover:text-white border border-[#262832] rounded-md text-[10px] font-mono font-bold transition-all"
            title="Studio Tour & Guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Real Hardware Chip Status */}
        <div
          className="flex items-center space-x-1.5 px-2 py-1 rounded bg-[#0b0c0f] border border-[#22242c] text-[10px] font-mono select-none"
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
