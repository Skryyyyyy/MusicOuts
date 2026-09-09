import React, { useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Repeat, Cpu, Zap } from 'lucide-react';

export interface MasterControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLooping: boolean;
  isReady: boolean;
  onPlayToggle: () => void;
  onSeek: (seconds: number) => void;
  onReset: () => void;
  onLoopToggle: () => void;
  className?: string;
}

export const MasterControls: React.FC<MasterControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  isLooping,
  isReady,
  onPlayToggle,
  onSeek,
  onReset,
  onLoopToggle,
  className = '',
}) => {
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

  const formatTime = (secs: number): string => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const calculateSeekTarget = (clientX: number): number => {
    const bar = progressBarRef.current;
    if (!bar || duration <= 0) return 0;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isReady || duration <= 0) return;
    setIsScrubbing(true);
    const target = calculateSeekTarget(e.clientX);
    onSeek(target);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const scrubTarget = calculateSeekTarget(moveEvent.clientX);
      onSeek(scrubTarget);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className={`bg-deck-card border border-deck-border rounded-xl px-6 py-3.5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      {/* Left: Transport Buttons */}
      <div className="flex items-center space-x-3">
        {/* Play/Pause Button */}
        <button
          onClick={onPlayToggle}
          disabled={!isReady}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            !isReady
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-deck-border'
              : isPlaying
              ? 'bg-neon-magenta text-white shadow-neon-magenta shadow-lg hover:scale-105'
              : 'bg-neon-cyan text-deck-dark shadow-neon-cyan shadow-lg hover:scale-105'
          }`}
          title={isPlaying ? 'Pause Playback' : 'Start Playback'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>

        {/* Reset / Rewind */}
        <button
          onClick={onReset}
          disabled={!isReady}
          className="p-2.5 rounded-lg bg-deck-dark hover:bg-deck-hover border border-deck-border text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
          title="Reset to 0:00"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Loop Toggle */}
        <button
          onClick={onLoopToggle}
          className={`p-2.5 rounded-lg border transition-all ${
            isLooping
              ? 'bg-neon-cyan/20 border-neon-cyan/60 text-neon-cyan shadow-neon-cyan/30 shadow-md'
              : 'bg-deck-dark border-deck-border text-slate-400 hover:text-slate-200'
          }`}
          title={isLooping ? 'Loop Enabled' : 'Loop Disabled'}
        >
          <Repeat className="w-4 h-4" />
        </button>
      </div>

      {/* Center: Interactive Scrubber Timeline */}
      <div className="flex-1 w-full max-w-2xl flex items-center space-x-3">
        <span className="text-xs font-mono font-bold text-neon-cyan w-10 text-right">
          {formatTime(currentTime)}
        </span>

        {/* Progress Track */}
        <div
          ref={progressBarRef}
          onMouseDown={handleMouseDown}
          className={`relative flex-1 h-3.5 bg-slate-950 rounded-full cursor-pointer overflow-hidden border border-deck-border group ${
            isScrubbing ? 'ring-1 ring-neon-cyan' : ''
          }`}
        >
          {/* Fill Bar */}
          <div
            className="h-full bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-yellow transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Scrubber Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md border-2 border-deck-dark pointer-events-none group-hover:scale-125 transition-transform"
            style={{ left: `calc(${progressPercent}% - 7px)` }}
          />
        </div>

        <span className="text-xs font-mono text-slate-400 w-10">
          {formatTime(duration)}
        </span>
      </div>

      {/* Right: Telemetry & GPU Accelerator Badges */}
      <div className="flex items-center space-x-2 text-xs font-mono">
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-deck-dark rounded-lg border border-deck-border">
          <Cpu className="w-3.5 h-3.5 text-neon-green" />
          <span className="text-slate-400">Demucs:</span>
          <span className="text-neon-green font-bold">CUDA GPU</span>
        </div>

        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-deck-dark rounded-lg border border-deck-border">
          <Zap className="w-3.5 h-3.5 text-neon-cyan" />
          <span className="text-slate-400">Latency:</span>
          <span className="text-neon-cyan font-bold">12ms</span>
        </div>
      </div>
    </div>
  );
};

export default MasterControls;
