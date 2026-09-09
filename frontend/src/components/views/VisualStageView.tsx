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
    <div className={`flex flex-col h-full bg-[#121316] border border-[#262830] rounded-lg shadow-2xl overflow-hidden ${className}`}>
      {/* Top Visual Stage Toolbar */}
      <div className="h-10 px-4 bg-[#18191e] border-b border-[#262830] flex items-center justify-between select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-xs tracking-wider text-zinc-100 font-mono uppercase">
              Audio-Reactive Visual Stage
            </span>
          </div>
          <span className="text-zinc-700">|</span>
          <span className="text-[11px] font-mono text-zinc-400">
            Real-time FFT Frequency & Time-Domain 4-Stem Oscilloscope
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          {trackMetadata && (
            <div className="flex items-center space-x-2 px-2.5 py-1 rounded bg-[#101114] border border-[#22242b] text-zinc-300">
              <Music className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold truncate max-w-[200px]">{trackMetadata.title}</span>
              <span className="text-zinc-500">[{formatTime(currentTime)} / {formatTime(trackMetadata.duration)}]</span>
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-1 rounded bg-[#1c1d22] border border-[#2d303a] text-zinc-400 hover:text-white hover:bg-[#252830] transition-all"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Full-Size Visualizer Canvas */}
      <div className="flex-1 p-3 flex flex-col bg-[#0a0a0d] relative overflow-hidden">
        <VideoPlayer
          audioGraph={audioGraph}
          trackMetadata={trackMetadata}
          currentTime={currentTime}
          isPlaying={isPlaying}
          className="w-full h-full flex-1"
        />
      </div>
    </div>
  );
};
