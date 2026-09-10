import React, { useState } from "react";
import { Activity, Maximize2, Minimize2, Music } from "lucide-react";
import { VideoPlayer } from "../VideoPlayer";
import { AudioGraphEngine } from "../../engine/audioGraph";
import { TrackMetadata } from "../../types";

export interface VisualStageViewProps {
  audioGraph: AudioGraphEngine | null;
  trackMetadata: TrackMetadata | null;
  currentTime: number;
  isPlaying: boolean;
  className?: string;
}

export const VisualStageView: React.FC<VisualStageViewProps> = ({
  audioGraph,
  trackMetadata,
  currentTime,
  isPlaying,
  className = "",
}) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const formatTime = (secs: number): string => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`flex flex-col h-full bg-[#0b0c10] rounded-2xl border border-white/[0.08] shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl overflow-hidden ${className}`}>
      {/* Top Visual Stage Toolbar - Splice Glass Capsule Header */}
      <div className="h-14 px-5 bg-gradient-to-r from-[#14161f]/95 via-[#161822]/90 to-[#14161f]/95 border-b border-white/[0.06] flex items-center justify-between select-none shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.2)]">
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xs tracking-wider text-white uppercase font-sans">
                Audio-Reactive Stage
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-mono text-cyan-300 font-bold">
                FFT GPU
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 block -mt-0.5">
              Live Spectrum &amp; 4-Stem Oscilloscope Render Engine
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          {trackMetadata && (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#0b0c12]/90 border border-white/[0.08] text-zinc-300 shadow-inner">
              <Music className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold truncate max-w-[220px] text-white">{trackMetadata.title}</span>
              <span className="text-zinc-500 font-mono">[{formatTime(currentTime)} / {formatTime(trackMetadata.duration)}]</span>
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all active:scale-95 shadow-sm"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-cyan-400" /> : <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />}
          </button>
        </div>
      </div>

      {/* Main Full-Size Visualizer Canvas */}
      <div className="flex-1 p-4 flex flex-col bg-gradient-to-b from-[#0b0c10] to-[#08090c] relative overflow-hidden">
        <VideoPlayer
          audioGraph={audioGraph}
          trackMetadata={trackMetadata}
          currentTime={currentTime}
          isPlaying={isPlaying}
          className="w-full h-full flex-1 rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl"
        />
      </div>
    </div>
  );
};

