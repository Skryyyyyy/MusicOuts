import React, { useState } from "react";
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
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  isInspectorOpen?: boolean;
  isMediaBayOpen?: boolean;
  isFooterCollapsed?: boolean;
  onToggleInspector?: () => void;
  onToggleMediaBay?: () => void;
  onToggleFooter?: () => void;
  className?: string;
}

export const DawTransport: React.FC<DawTransportProps> = ({
  isPlaying,
  currentTime,
  duration = 0,
  isLooping,
  isDucking,
  duckingReduction,
  currentView: _currentView = "arrangement",
  mode = "producer",
  hardwareInfo,
  isRecordingAutomation = false,
  isCapturingPerformance = false,
  isSynthOpen: _isSynthOpen = false,
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
  onSeek,
  onReset,
  onLoopToggle,
  onDuckingToggle,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  isInspectorOpen,
  isMediaBayOpen,
  isFooterCollapsed,
  onToggleInspector,
  onToggleMediaBay,
  onToggleFooter,
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

  const [selectedTool, setSelectedTool] = useState<string>("arrow");

  const formatTimecodeSMPTE = (secs: number): string => {
    if (isNaN(secs) || secs < 0) return "00:00:00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const frames = Math.floor((secs % 1) * 24);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

  return (
    <header className={`fixed top-0 left-channel-w-standard right-0 z-40 bg-surface-container-lowest shadow-[0_2px_10px_rgba(0,0,0,0.4)] flex flex-col select-none ${className}`}>
      {/* Row 1: Title Bar & App Menu */}
      <div className="h-6 px-pad-sm bg-surface-container-lowest flex items-center justify-between font-label-md text-label-md border-b border-surface-container-highest/30">
        <div className="flex items-center gap-pad-md">
          <div className="flex items-center gap-pad-xs cursor-pointer" onClick={onOpenGuide}>
            <span className="material-symbols-outlined text-secondary text-[16px]">file_download_done</span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
              MusicOuts Pro 13
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-pad-micro ml-pad-sm text-on-surface-variant">
            <button onClick={onOpenProject} className="px-pad-xs py-pad-micro rounded hover:bg-surface-container hover:text-on-surface">File</button>
            <button className="px-pad-xs py-pad-micro rounded hover:bg-surface-container hover:text-on-surface">Edit</button>
            <button className="px-pad-xs py-pad-micro rounded hover:bg-surface-container hover:text-on-surface">Project</button>
            <button className="px-pad-xs py-pad-micro rounded hover:bg-surface-container hover:text-on-surface">Audio</button>
            <button className="px-pad-xs py-pad-micro rounded hover:bg-surface-container hover:text-on-surface">MIDI</button>
            <button onClick={onOpenSynth} className="px-pad-xs py-pad-micro rounded hover:bg-surface-container hover:text-on-surface">Synth</button>
            <button onClick={() => onViewChange && onViewChange("ingestion")} className="px-pad-xs py-pad-micro rounded hover:bg-surface-container hover:text-on-surface">Media</button>
            <button onClick={() => onViewChange && onViewChange("mixer")} className="px-pad-xs py-pad-micro rounded hover:bg-surface-container hover:text-on-surface">Studio</button>
            <button onClick={onOpenGuide} className="px-pad-xs py-pad-micro rounded hover:bg-surface-container hover:text-on-surface">Help</button>
          </nav>
        </div>

        {/* Project Info Badge */}
        <div className="hidden lg:flex items-center gap-pad-xs px-pad-sm py-pad-micro rounded bg-surface-container-high">
          <span className="text-on-surface font-headline-sm text-headline-sm font-medium">Project: “Neon Horizons”</span>
          <span className="text-on-surface-variant font-label-sm text-label-sm">[48.0 kHz / 24-bit • 120.000 BPM • 4/4]</span>
        </div>

        {/* Hardware Status & Window Controls */}
        <div className="flex items-center gap-pad-md">
          <div className="flex items-center gap-pad-sm font-label-sm text-label-sm text-on-surface-variant">
            <div className="flex items-center gap-pad-xs">
              <span className="w-pad-xs h-pad-xs rounded-full bg-tertiary-fixed-dim shadow-[0_0_4px_#4ae176]"></span>
              <span className="text-tertiary font-bold">{hardwareInfo?.cuda_available ? "CUDA" : "CPU"}</span>
            </div>
            <span className="hidden sm:inline text-on-surface">48k OK</span>
            <span className="hidden sm:inline text-on-surface">CPU {hardwareInfo?.cpu_threads ? `${hardwareInfo.cpu_threads * 2}%` : "18%"}</span>
            <span className="hidden md:inline text-on-surface">RAM {hardwareInfo?.vram_gb ? `${hardwareInfo.vram_gb}GB` : "3.4/8GB"}</span>
            <span className="hidden lg:inline text-on-surface-variant">64 spls (1.3ms)</span>
          </div>

          <div className="flex items-center gap-pad-micro text-on-surface-variant ml-pad-sm">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`w-pad-lg h-pad-lg flex items-center justify-center rounded transition-all ${
                canUndo
                  ? "hover:bg-surface-container text-on-surface cursor-pointer"
                  : "text-on-surface-variant/30 cursor-not-allowed opacity-40"
              }`}
              title="Undo Action (Ctrl+Z)"
            >
              <span className="material-symbols-outlined text-[15px]">undo</span>
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`w-pad-lg h-pad-lg flex items-center justify-center rounded transition-all ${
                canRedo
                  ? "hover:bg-surface-container text-on-surface cursor-pointer"
                  : "text-on-surface-variant/30 cursor-not-allowed opacity-40"
              }`}
              title="Redo Action (Ctrl+Y / Ctrl+Shift+Z)"
            >
              <span className="material-symbols-outlined text-[15px]">redo</span>
            </button>
            <button onClick={onSaveProject} className="w-pad-lg h-pad-lg flex items-center justify-center hover:bg-surface-container hover:text-on-surface rounded" title="Save Project">
              <span className="material-symbols-outlined text-[14px]">save</span>
            </button>
            <button onClick={onOpenGuide} className="w-pad-lg h-pad-lg flex items-center justify-center hover:bg-surface-container hover:text-on-surface rounded" title="Help & Shortcuts">
              <span className="material-symbols-outlined text-[14px]">help</span>
            </button>
          </div>

          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-[11px] shadow-sm">
            MO
          </div>
        </div>
      </div>

      {/* Row 2: Tool Palette & Transport Controls */}
      <div className="h-header-transport-h px-pad-sm bg-surface-container-low flex items-center justify-between gap-pad-md border-b border-surface-container-highest/30 overflow-x-auto">
        {/* Tool Palette */}
        <div className="flex items-center gap-pad-micro bg-surface-container p-pad-micro rounded shrink-0">
          {[
            { id: "arrow", icon: "near_me", title: "Selection Arrow (1)" },
            { id: "range", icon: "highlight_alt", title: "Range Tool (2)" },
            { id: "split", icon: "content_cut", title: "Split Tool (3)" },
            { id: "glue", icon: "join_inner", title: "Glue Tool (4)" },
            { id: "eraser", icon: "ink_eraser", title: "Eraser (5)" },
            { id: "zoom", icon: "search", title: "Zoom (6)" },
            { id: "mute", icon: "volume_off", title: "Mute Tool (7)" },
            { id: "draw", icon: "edit", title: "Draw / Pencil (8)" },
            { id: "color", icon: "palette", title: "Color Tool (9)" },
            { id: "scrub", icon: "headphones", title: "Scrub (0)" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTool(t.id)}
              className={`w-7 h-7 flex items-center justify-center rounded transition-all ${
                selectedTool === t.id
                  ? "bg-surface-container-highest text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] font-bold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              title={t.title}
            >
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            </button>
          ))}
        </div>

        {/* Undo / Redo Actions Button Group */}
        <div className="flex items-center gap-pad-micro bg-surface-container p-pad-micro rounded shrink-0 border border-surface-container-highest/40">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-all ${
              canUndo
                ? "bg-surface-container-high hover:bg-surface-container-highest text-on-surface cursor-pointer shadow-sm active:scale-95"
                : "text-on-surface-variant/30 cursor-not-allowed opacity-40"
            }`}
            title="Undo Action (Ctrl+Z)"
          >
            <span className="material-symbols-outlined text-[15px]">undo</span>
            <span className="font-mono text-[10px] font-bold">UNDO</span>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-all ${
              canRedo
                ? "bg-surface-container-high hover:bg-surface-container-highest text-on-surface cursor-pointer shadow-sm active:scale-95"
                : "text-on-surface-variant/30 cursor-not-allowed opacity-40"
            }`}
            title="Redo Action (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <span className="material-symbols-outlined text-[15px]">redo</span>
            <span className="font-mono text-[10px] font-bold">REDO</span>
          </button>
        </div>

        {/* Transport Control Buttons */}
        <div className="flex items-center gap-pad-xs bg-surface-container-lowest p-pad-micro rounded shrink-0 shadow-inner">
          <button
            onClick={onReset}
            className="w-8 h-8 flex items-center justify-center rounded bg-surface-container hover:bg-surface-container-high text-on-surface transition-all"
            title="Return to Zero (Home / R)"
          >
            <span className="material-symbols-outlined text-[18px]">skip_previous</span>
          </button>
          <button
            onClick={() => onSeek && onSeek(Math.max(0, currentTime - 5))}
            className="w-8 h-8 flex items-center justify-center rounded bg-surface-container hover:bg-surface-container-high text-on-surface transition-all"
            title="Rewind 5s"
          >
            <span className="material-symbols-outlined text-[18px]">fast_rewind</span>
          </button>
          <button
            onClick={() => onSeek && onSeek(Math.min(duration, currentTime + 5))}
            className="w-8 h-8 flex items-center justify-center rounded bg-surface-container hover:bg-surface-container-high text-on-surface transition-all"
            title="Fast Forward 5s"
          >
            <span className="material-symbols-outlined text-[18px]">fast_forward</span>
          </button>
          <button
            onClick={onLoopToggle}
            className={`w-8 h-8 flex items-center justify-center rounded transition-all ${
              isLooping
                ? "bg-secondary-container text-on-secondary-container shadow-[0_0_8px_rgba(236,106,6,0.6)] font-bold"
                : "bg-surface-container hover:bg-surface-container-high text-on-surface"
            }`}
            title="Loop Cycle (L)"
          >
            <span className="material-symbols-outlined text-[18px]">repeat</span>
          </button>
          <button
            onClick={onStop}
            className="w-8 h-8 flex items-center justify-center rounded bg-surface-container hover:bg-surface-container-high text-on-surface transition-all"
            title="Stop Playback"
          >
            <span className="material-symbols-outlined text-[18px]">stop</span>
          </button>
          <button
            onClick={onPlayToggle}
            className="w-16 h-8 flex items-center justify-center rounded bg-tertiary-container text-on-tertiary shadow-[0_0_10px_rgba(0,179,81,0.7)] font-bold transition-all active:scale-95 gap-1 px-2"
            title="Play / Pause (Space)"
          >
            <span className="material-symbols-outlined text-[20px]">{isPlaying ? "pause" : "play_arrow"}</span>
            <span className="font-bold text-[11px]">{isPlaying ? "PAUSE" : "PLAY"}</span>
          </button>
          <button
            onClick={onToggleCapturePerformance || onToggleRecordAutomation}
            className={`w-9 h-8 flex items-center justify-center rounded transition-all font-bold ${
              isCapturingPerformance || isRecordingAutomation
                ? "bg-error text-on-error shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse"
                : "bg-error-container text-on-error shadow-[0_0_10px_rgba(239,68,68,0.7)]"
            }`}
            title="Record Automation / Take"
          >
            <span className="material-symbols-outlined text-[18px]">fiber_manual_record</span>
          </button>

          {/* Ducking Pill */}
          <button
            onClick={onDuckingToggle}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ml-1 ${
              isDucking
                ? "bg-secondary-container text-on-secondary-container shadow-[0_0_6px_rgba(236,106,6,0.5)]"
                : "bg-surface-container text-on-surface-variant hover:text-on-surface"
            }`}
            title="Toggle Auto-Ducking"
          >
            DUCK: {duckingDb}
          </button>
        </div>

        {/* Metronome, Tempo, & Timecode */}
        <div className="flex items-center gap-pad-sm shrink-0">
          <div className="hidden sm:flex items-center gap-pad-xs bg-surface-container p-pad-xs rounded font-label-md text-label-md">
            <button className="px-pad-xs py-pad-micro rounded bg-secondary-container text-on-secondary-container font-semibold">CLICK</button>
            <span className="px-pad-xs py-pad-micro text-on-surface font-mono">120.000</span>
            <span className="px-pad-xs py-pad-micro text-on-surface-variant font-mono">4/4</span>
            <button className="px-pad-micro py-pad-micro rounded text-primary font-bold hover:bg-surface-container-high">TAP</button>
          </div>

          <div
            onClick={() => setShowTimeInBars(!showTimeInBars)}
            className="flex flex-col bg-surface-container-lowest px-pad-sm py-pad-micro rounded cursor-pointer hover:bg-surface-container shadow-inner"
            title="Click to toggle Timecode vs Bars/Beats"
          >
            <div className="flex items-center justify-between gap-pad-sm font-meter-tick text-meter-tick text-on-surface-variant">
              <span>L 01.01.01.000</span>
              <span className="text-primary font-mono">{formatTimecode(currentTime)}</span>
              <span>R 65.01.01.000</span>
            </div>
            <div className="flex items-center gap-pad-md">
              <span className="font-timecode-display text-timecode-display text-primary tracking-widest leading-none">
                {showTimeInBars ? formatBarsBeats(currentTime) : formatTimecodeSMPTE(currentTime)}
              </span>
              <span className="font-timecode-sub text-timecode-sub text-tertiary-fixed-dim leading-none font-mono">
                {formatBarsBeats(currentTime)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Grid, Snap, Quantize, Workspace status */}
      <div className="h-6 px-pad-sm bg-surface-container flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant border-b border-surface-container-highest/40">
        <div className="flex items-center gap-pad-md">
          <div className="flex items-center gap-pad-xs">
            <span className="material-symbols-outlined text-[14px]">grid_4x4</span>
            <span>Grid: <strong className="text-on-surface">1/16</strong></span>
          </div>
          <div className="flex items-center gap-pad-xs">
            <span className="material-symbols-outlined text-[14px]">qr_code_2</span>
            <span>Snap: <strong className="text-on-surface">Bar/Beat</strong></span>
          </div>
          <div className="flex items-center gap-pad-xs">
            <span className="material-symbols-outlined text-[14px]">straighten</span>
            <span>Quantize: <strong className="text-on-surface">1/16 Note</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-pad-md">
          <span className="hidden md:inline text-on-surface-variant">
            Auto-Scroll: <strong className="text-tertiary">Follow</strong>
          </span>
          <span className="hidden lg:inline text-on-surface-variant">
            Constrain: <strong className="text-on-surface">OFF</strong>
          </span>
          {onModeChange && (
            <button
              onClick={() => onModeChange(mode === "producer" ? "performance" : "producer")}
              className="text-primary cursor-pointer hover:underline uppercase font-bold"
            >
              Mode: {mode}
            </button>
          )}

          {/* Cubase Zone Windows Minimize/Toggle Options */}
          {(onToggleInspector || onToggleFooter || onToggleMediaBay) && (
            <div className="flex items-center gap-1 border-l border-surface-container-highest/60 pl-2">
              {onToggleInspector && (
                <button
                  onClick={onToggleInspector}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1 transition-all ${
                    isInspectorOpen
                      ? "bg-primary-container text-on-primary-container shadow-sm"
                      : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                  }`}
                  title={isInspectorOpen ? "Minimize Left Inspector Window" : "Open Left Inspector Window"}
                >
                  <span className="material-symbols-outlined text-[12px]">dock_to_right</span>
                  <span className="hidden sm:inline">INSP</span>
                </button>
              )}
              {onToggleFooter && (
                <button
                  onClick={onToggleFooter}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1 transition-all ${
                    !isFooterCollapsed
                      ? "bg-primary-container text-on-primary-container shadow-sm"
                      : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                  }`}
                  title={isFooterCollapsed ? "Expand Bottom MixConsole" : "Minimize Bottom MixConsole"}
                >
                  <span className="material-symbols-outlined text-[12px]">dock_to_bottom</span>
                  <span className="hidden sm:inline">MIX</span>
                </button>
              )}
              {onToggleMediaBay && (
                <button
                  onClick={onToggleMediaBay}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1 transition-all ${
                    isMediaBayOpen
                      ? "bg-primary-container text-on-primary-container shadow-sm"
                      : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                  }`}
                  title={isMediaBayOpen ? "Minimize Right MediaBay Window" : "Open Right MediaBay Window"}
                >
                  <span className="material-symbols-outlined text-[12px]">dock_to_left</span>
                  <span className="hidden sm:inline">MEDIA</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default DawTransport;
