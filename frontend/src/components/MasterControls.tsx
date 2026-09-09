import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Repeat, Cpu, Zap, Mic, VolumeX } from 'lucide-react';
import { AudioGraphEngine } from '../engine/audioGraph';

export interface MasterControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLooping: boolean;
  isReady: boolean;
  audioGraph?: AudioGraphEngine | null;
  isDucking?: boolean;
  duckingReduction?: number;
  onPlayToggle: () => void;
  onSeek: (seconds: number) => void;
  onReset: () => void;
  onLoopToggle: () => void;
  onDuckingToggle?: () => void;
  className?: string;
}

export const MasterControls: React.FC<MasterControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  isLooping,
  isReady,
  audioGraph = null,
  isDucking = false,
  duckingReduction = 1.0,
  onPlayToggle,
  onSeek,
  onReset,
  onLoopToggle,
  onDuckingToggle,
  className = '',
}) => {
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

  // Render Vocals Waveform Peaks onto Scrubber Canvas
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const numBars = 160;
    const peakData = audioGraph?.getStemPeakData('vocals', numBars) || new Float32Array(numBars);
    const barWidth = Math.max(1.5, width / numBars);
    const progressIndex = Math.floor((progressPercent / 100) * numBars);

    for (let i = 0; i < numBars; i++) {
      const peak = peakData[i] || 0.15; // default fallback minimal bar if silence
      const barHeight = Math.max(3, peak * (height * 0.85));
      const x = i * (width / numBars);
      const y = (height - barHeight) / 2;

      if (i <= progressIndex) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        ctx.shadowBlur = 3;
      } else {
        ctx.fillStyle = 'rgba(113, 113, 122, 0.45)';
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    }

    ctx.restore();
  }, [audioGraph, progressPercent, duration]);

  // Calculate dB reduction for ducking badge display
  const duckingDb = duckingReduction < 0.99
    ? `${(20 * Math.log10(Math.max(0.01, duckingReduction))).toFixed(1)} dB`
    : 'ACTIVE';

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
              ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-800'
              : isPlaying
              ? 'bg-zinc-800 text-white border border-zinc-500 shadow-mono-glow hover:scale-105'
              : 'bg-white text-black shadow-mono-glow hover:scale-105 hover:bg-zinc-200'
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
          className="p-2.5 rounded-lg bg-deck-dark hover:bg-zinc-800 border border-deck-border text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
          title="Reset to 0:00"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Loop Toggle */}
        <button
          onClick={onLoopToggle}
          className={`p-2.5 rounded-lg border transition-all ${
            isLooping
              ? 'bg-white text-black border-white shadow-mono-glow'
              : 'bg-deck-dark border-deck-border text-zinc-400 hover:text-white'
          }`}
          title={isLooping ? 'Loop Enabled' : 'Loop Disabled'}
        >
          <Repeat className="w-4 h-4" />
        </button>

        {/* Sidechain Auto-Ducking Toggle Pill */}
        {onDuckingToggle && (
          <button
            onClick={onDuckingToggle}
            className={`px-3 py-2 rounded-lg border text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
              isDucking
                ? 'bg-white text-black border-white shadow-mono-glow'
                : 'bg-deck-dark border-deck-border text-zinc-400 hover:text-white'
            }`}
            title="Auto Sidechain Ducking: Attenuates backing instruments when vocals are present"
          >
            {isDucking ? <Mic className="w-3.5 h-3.5 fill-current" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>DUCKING {isDucking ? 'ON' : 'OFF'}</span>
            {isDucking && duckingReduction < 0.95 && (
              <span className="ml-1 text-[10px] px-1 py-0.2 bg-black text-white rounded font-mono font-bold animate-pulse">
                {duckingDb}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Center: Interactive Scrubber Timeline with Vocal Waveform Canvas */}
      <div className="flex-1 w-full max-w-2xl flex items-center space-x-3">
        <span className="text-xs font-mono font-bold text-white w-10 text-right">
          {formatTime(currentTime)}
        </span>

        {/* Progress & Waveform Track */}
        <div
          ref={progressBarRef}
          onMouseDown={handleMouseDown}
          className={`relative flex-1 h-8 bg-zinc-950 rounded-lg cursor-pointer overflow-hidden border border-zinc-800 group transition-all ${
            isScrubbing ? 'ring-1 ring-white' : ''
          }`}
          title="Timeline Scrubber with Vocals Waveform Overview"
        >
          {/* Vocals Waveform Peaks Canvas Background */}
          <canvas
            ref={waveformCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Transparent Progress Tint Overlay */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-white/10 pointer-events-none transition-all duration-75 border-r border-white/60"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Scrubber Playhead Line */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] pointer-events-none group-hover:w-1.5 transition-all"
            style={{ left: `calc(${progressPercent}% - 1px)` }}
          />

          {/* Vocal Track Identifier Badge */}
          <div className="absolute top-1 left-2 pointer-events-none flex items-center space-x-1 text-[9px] font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">
            <Mic className="w-2.5 h-2.5" />
            <span>VOCALS WAVEFORM</span>
          </div>
        </div>

        <span className="text-xs font-mono text-zinc-400 w-10">
          {formatTime(duration)}
        </span>
      </div>

      {/* Right: Telemetry & GPU Accelerator Badges */}
      <div className="flex items-center space-x-2 text-xs font-mono">
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-deck-dark rounded-lg border border-deck-border">
          <Cpu className="w-3.5 h-3.5 text-white" />
          <span className="text-zinc-400">Demucs:</span>
          <span className="text-white font-bold">CUDA GPU</span>
        </div>

        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-deck-dark rounded-lg border border-deck-border">
          <Zap className="w-3.5 h-3.5 text-white" />
          <span className="text-zinc-400">Latency:</span>
          <span className="text-white font-bold">12ms</span>
        </div>
      </div>
    </div>
  );
};

export default MasterControls;

