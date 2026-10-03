import React from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Volume2,
  Magnet,
} from 'lucide-react';

interface TransportProps {
  isPlaying: boolean;
  currentTime: number;
  duration?: number;
  bpm: number;
  keySignature: string;
  snapToGrid: boolean;
  masterVolume: number;
  meterLevels: { left: number; right: number; lufsEstimate: number };
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onToggleSnap: () => void;
  onMasterVolumeChange: (vol: number) => void;
}

export const Transport: React.FC<TransportProps> = ({
  isPlaying,
  currentTime,
  bpm,
  keySignature,
  snapToGrid,
  masterVolume,
  meterLevels,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onToggleSnap,
  onMasterVolumeChange,
}) => {
  // Timecode formatter: MM:SS:ms or Bars:Beats:Ticks
  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
  };

  const formatBars = (seconds: number, targetBpm: number) => {
    const totalBeats = (seconds * targetBpm) / 60;
    const bar = Math.floor(totalBeats / 4) + 1;
    const beat = (Math.floor(totalBeats) % 4) + 1;
    const sub = Math.floor((totalBeats % 1) * 4) + 1;
    return `${bar}.${beat}.${sub}`;
  };

  return (
    <footer className="h-16 bg-pro-panel border-t border-pro-border flex items-center justify-between px-4 select-none">
      {/* Left: Transport Controls & Timecode */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1.5 bg-pro-surface p-1 rounded-lg border border-pro-border">
          <button
            onClick={() => onSeek(0)}
            className="p-2 hover:bg-pro-surface/80 rounded-md text-slate-300 hover:text-white transition-colors"
            title="Return to Start (Home / Enter)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={isPlaying ? onPause : onPlay}
            className={`p-2 rounded-md transition-colors ${
              isPlaying
                ? 'bg-amber-500 text-black font-semibold'
                : 'bg-pro-accent text-white hover:bg-blue-600'
            }`}
            title="Play / Pause (Spacebar)"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <button
            onClick={onStop}
            className="p-2 hover:bg-pro-surface/80 rounded-md text-slate-300 hover:text-white transition-colors"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>
        </div>

        {/* Pro Timecode Display (Logic/Final Cut feel) */}
        <div className="flex items-center space-x-2 bg-black/60 px-3.5 py-1.5 rounded-md border border-white/5 font-mono">
          <div className="text-center">
            <span className="text-[9px] text-slate-400 block uppercase tracking-wider">Time</span>
            <span className="text-sm font-semibold text-pro-accent tracking-wider">
              {formatTimecode(currentTime)}
            </span>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="text-center">
            <span className="text-[9px] text-slate-400 block uppercase tracking-wider">Bar.Beat</span>
            <span className="text-sm font-semibold text-emerald-400 tracking-wider">
              {formatBars(currentTime, bpm)}
            </span>
          </div>
        </div>

        {/* Project Tempo & Key Pill */}
        <div className="flex items-center space-x-2 bg-pro-surface/60 px-3 py-1.5 rounded-md border border-pro-border text-xs">
          <span className="font-semibold text-slate-200">{bpm} BPM</span>
          <span className="text-slate-400">•</span>
          <span className="font-medium text-slate-300">{keySignature}</span>
          <span className="text-slate-400">•</span>
          <span className="font-mono text-slate-400">4/4</span>
        </div>
      </div>

      {/* Center: Editing Tools & Grid Snapping */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onToggleSnap}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            snapToGrid
              ? 'bg-blue-500/20 text-pro-accent border-blue-500/40'
              : 'bg-pro-surface text-slate-400 border-pro-border hover:text-white'
          }`}
          title="Toggle Snap to Grid / Beat (S)"
        >
          <Magnet className="w-3.5 h-3.5" />
          <span>Snap: 1/16 Beat</span>
        </button>
      </div>

      {/* Right: Master Output, Peak & LUFS Loudness Meters */}
      <div className="flex items-center space-x-5">
        {/* LUFS Meter */}
        <div className="flex items-center space-x-2 bg-black/40 px-3 py-1 rounded-md border border-white/5">
          <span className="text-[10px] text-slate-400 font-mono uppercase">LUFS</span>
          <span className="text-xs font-mono font-semibold text-amber-300">
            {meterLevels.lufsEstimate.toFixed(1)}
          </span>
          <span className="text-[9px] text-slate-400">Target: -14.0</span>
        </div>

        {/* Dual Peak LED Meters */}
        <div className="flex items-center space-x-1">
          {/* L Channel */}
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-8 bg-black/80 rounded-sm overflow-hidden flex flex-col justify-end p-0.5 border border-white/5">
              <div
                className="w-full bg-gradient-to-t from-emerald-500 via-amber-400 to-red-500 rounded-sm transition-all duration-75"
                style={{ height: `${Math.min(100, meterLevels.left * 100)}%` }}
              />
            </div>
            <span className="text-[8px] text-slate-400 font-mono mt-0.5">L</span>
          </div>

          {/* R Channel */}
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-8 bg-black/80 rounded-sm overflow-hidden flex flex-col justify-end p-0.5 border border-white/5">
              <div
                className="w-full bg-gradient-to-t from-emerald-500 via-amber-400 to-red-500 rounded-sm transition-all duration-75"
                style={{ height: `${Math.min(100, meterLevels.right * 100)}%` }}
              />
            </div>
            <span className="text-[8px] text-slate-400 font-mono mt-0.5">R</span>
          </div>
        </div>

        {/* Master Volume Slider */}
        <div className="flex items-center space-x-2">
          <Volume2 className="w-4 h-4 text-slate-400" />
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.01"
            value={masterVolume}
            onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
            className="w-20 accent-pro-accent h-1.5 bg-pro-surface rounded cursor-pointer"
            title="Master Output Gain"
          />
        </div>
      </div>
    </footer>
  );
};
