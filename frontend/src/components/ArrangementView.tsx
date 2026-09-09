import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Music,
  Disc,
  Radio,
  Sliders,
} from 'lucide-react';
import { StemType, STEM_TYPES, StemState, TrackMetadata, GestureState } from '../types';
import { AudioGraphEngine } from '../engine/audioGraph';

export interface ArrangementViewProps {
  audioGraph: AudioGraphEngine | null;
  trackMetadata: TrackMetadata | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isLooping: boolean;
  stemStates: Record<StemType, StemState>;
  gestureState?: GestureState;
  onSeek: (seconds: number) => void;
  onStemVolumeChange: (stem: StemType, val: number) => void;
  onStemMuteToggle: (stem: StemType) => void;
  onStemSoloToggle: (stem: StemType) => void;
  onStemPanChange: (stem: StemType, pan: number) => void;
  className?: string;
}

interface StemTrackConfig {
  name: string;
  shortName: string;
  icon: React.ReactNode;
  gestureTag: string;
  badge: string;
  color: string;
  waveColor: string;
  bgTint: string;
}

const STEM_CONFIGS: Record<StemType, StemTrackConfig> = {
  vocals: {
    name: '01 VOCALS [LEAD]',
    shortName: 'VOCALS',
    icon: <Mic className="w-3.5 h-3.5 text-cyan-400" />,
    gestureTag: 'LEFT HAND HEIGHT & PINCH',
    badge: 'AUDIO 01',
    color: '#00bcd4',
    waveColor: '#22d3ee',
    bgTint: 'rgba(6, 182, 212, 0.08)',
  },
  drums: {
    name: '02 DRUMS [PERC]',
    shortName: 'DRUMS',
    icon: <Disc className="w-3.5 h-3.5 text-orange-400" />,
    gestureTag: 'RIGHT HAND HEIGHT',
    badge: 'AUDIO 02',
    color: '#ff7043',
    waveColor: '#fb923c',
    bgTint: 'rgba(249, 115, 22, 0.08)',
  },
  bass: {
    name: '03 BASS [LOW-END]',
    shortName: 'BASS',
    icon: <Music className="w-3.5 h-3.5 text-purple-400" />,
    gestureTag: 'RIGHT HAND HEIGHT',
    badge: 'AUDIO 03',
    color: '#ab47bc',
    waveColor: '#c084fc',
    bgTint: 'rgba(168, 85, 247, 0.08)',
  },
  other: {
    name: '04 OTHER [SYNTH & INST]',
    shortName: 'OTHER',
    icon: <Radio className="w-3.5 h-3.5 text-emerald-400" />,
    gestureTag: 'RIGHT HAND HEIGHT & FILTER',
    badge: 'AUDIO 04',
    color: '#26a69a',
    waveColor: '#34d399',
    bgTint: 'rgba(16, 185, 129, 0.08)',
  },
};

export const ArrangementView: React.FC<ArrangementViewProps> = ({
  audioGraph,
  trackMetadata,
  currentTime,
  duration,
  isPlaying,
  isLooping,
  stemStates,
  gestureState,
  onSeek,
  onStemVolumeChange,
  onStemMuteToggle,
  onStemSoloToggle,
  onStemPanChange,
  className = '',
}) => {
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Record<StemType, HTMLCanvasElement | null>>({
    vocals: null,
    drums: null,
    bass: null,
    other: null,
  });

  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [vuLevels, setVuLevels] = useState<Record<StemType, number>>({
    vocals: 0,
    drums: 0,
    bass: 0,
    other: 0,
  });

  // Calculate seek percentage from mouse clientX on timeline
  const handleTimelineInteraction = (clientX: number) => {
    const container = timelineContainerRef.current;
    if (!container || duration <= 0) return;
    const rect = container.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    setIsScrubbing(true);
    handleTimelineInteraction(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleTimelineInteraction(moveEvent.clientX);
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

  // Real-time Peak LED VU Meters
  useEffect(() => {
    let animId: number;

    const updateVUs = () => {
      if (audioGraph && isPlaying) {
        const nextLevels: Record<StemType, number> = {
          vocals: 0,
          drums: 0,
          bass: 0,
          other: 0,
        };

        for (const stem of STEM_TYPES) {
          const wave = audioGraph.getWaveformData(stem);
          let sumSquares = 0;
          for (let i = 0; i < wave.length; i++) {
            const norm = (wave[i] - 128) / 128;
            sumSquares += norm * norm;
          }
          const rms = Math.sqrt(sumSquares / wave.length);
          nextLevels[stem] = Math.min(1.0, rms * 2.8 * (stemStates[stem]?.volume || 1.0));
        }
        setVuLevels(nextLevels);
      } else {
        setVuLevels({ vocals: 0, drums: 0, bass: 0, other: 0 });
      }

      animId = requestAnimationFrame(updateVUs);
    };

    animId = requestAnimationFrame(updateVUs);
    return () => cancelAnimationFrame(animId);
  }, [audioGraph, isPlaying, stemStates]);

  // Render High-Definition Waveform Canvases for each Stem Track
  useEffect(() => {
    for (const stem of STEM_TYPES) {
      const canvas = canvasRefs.current[stem];
      if (!canvas) continue;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) continue;

      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Subtle horizontal center line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      const numBars = Math.max(120, Math.floor(width / 3.5));
      const peakData = audioGraph?.getStemPeakData(stem, numBars) || new Float32Array(numBars);
      const barWidth = width / numBars;
      const progressIndex = Math.floor((progressPercent / 100) * numBars);
      const waveColor = STEM_CONFIGS[stem].waveColor;

      for (let i = 0; i < numBars; i++) {
        const peak = peakData[i] || 0.08;
        const barHeight = Math.max(2, peak * (height * 0.82));
        const x = i * barWidth;
        const y = (height - barHeight) / 2;

        if (i <= progressIndex) {
          // Played region: crisp high-contrast stem color
          ctx.fillStyle = waveColor;
          ctx.shadowColor = waveColor;
          ctx.shadowBlur = 3;
        } else {
          // Unplayed region: semi-transparent stem color
          ctx.fillStyle = 'rgba(161, 161, 170, 0.25)';
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }

        ctx.fillRect(x, y, Math.max(1.2, barWidth - 1), barHeight);
      }

      ctx.restore();
    }
  }, [audioGraph, progressPercent, duration]);

  // Format ruler seconds to standard DAW time mark (e.g. 0:00, 0:30, 1:00)
  const formatRulerTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const rulerTicks = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];

  return (
    <div
      className={`bg-[#141518] border border-[#262830] rounded-lg flex flex-col overflow-hidden shadow-2xl ${className}`}
    >
      {/* 1. Cubase Project Window Toolbar & Timeline Ruler */}
      <div className="flex border-b border-[#262830] bg-[#1a1b20] z-20">
        {/* Left Track Header Column Title */}
        <div className="w-72 sm:w-80 px-3 py-2 border-r border-[#262830] flex items-center justify-between text-[11px] font-mono font-bold text-zinc-300 uppercase tracking-wider">
          <div className="flex items-center space-x-2">
            <Sliders className="w-3.5 h-3.5 text-zinc-400" />
            <span>Stem Tracks (4-Ch)</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-zinc-400 border border-zinc-700">
            AUDIO
          </span>
        </div>

        {/* Timeline Ruler Area (Bars / Timecode Ticks) */}
        <div
          ref={timelineContainerRef}
          onMouseDown={handleMouseDown}
          className={`relative flex-1 h-9 bg-[#0e0f12] overflow-hidden border-b border-[#262830] group ${
            isScrubbing ? 'cursor-grabbing' : 'cursor-pointer'
          }`}
          title="Cubase Timeline Ruler - Click or drag to seek"
        >
          {/* Sub-beat Ruler Grid Marks */}
          <div className="absolute inset-0 flex justify-between px-2 pointer-events-none">
            {rulerTicks.map((ratio, idx) => {
              const tickSecs = ratio * (duration || 180);
              const barNum = Math.floor((tickSecs / 60) * 30) + 1;
              return (
                <div key={idx} className="flex flex-col justify-between h-full py-1">
                  <span className="text-[9px] font-mono text-zinc-500 font-bold">
                    {`B${barNum.toString().padStart(2, '0')}`}
                    <span className="text-[8px] text-zinc-600 ml-1">
                      {formatRulerTime(tickSecs)}
                    </span>
                  </span>
                  <div className="w-px h-1.5 bg-zinc-700 self-start" />
                </div>
              );
            })}
          </div>

          {/* Loop Region Bracket Indicator */}
          {isLooping && (
            <div className="absolute top-0 bottom-0 left-0 right-0 bg-cyan-500/10 border-b-2 border-cyan-400 pointer-events-none" />
          )}

          {/* Timeline Playhead Laser Line (Ruler Section) */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] pointer-events-none z-30"
            style={{ left: `calc(${progressPercent}% - 1px)` }}
          >
            {/* Playhead Flag Locator Thumb */}
            <div className="w-2.5 h-2.5 bg-cyan-400 rotate-45 -translate-x-[3px] -translate-y-1 shadow-md" />
          </div>
        </div>
      </div>

      {/* 2. Cubase 4-Stem Multi-Track Arrangement Lanes */}
      <div className="flex-1 flex flex-col divide-y divide-[#22242c] bg-[#0d0e11]">
        {STEM_TYPES.map((stem) => {
          const config = STEM_CONFIGS[stem];
          const state = stemStates[stem] || { volume: 1.0, muted: false, solo: false, pan: 0 };
          const vu = vuLevels[stem] || 0;

          const isLeftHandControlled = stem === 'vocals' && gestureState?.leftHand.present;
          const isRightHandControlled = stem !== 'vocals' && gestureState?.rightHand.present;

          return (
            <div key={stem} className="flex min-h-[92px] group transition-colors hover:bg-[#14151a]">
              {/* Left Column: Cubase Track Header Strip */}
              <div className="w-72 sm:w-80 p-3 bg-[#17181d] border-r border-[#262830] flex flex-col justify-between space-y-1.5 relative">
                {/* Left Colored Spine Bar (Cubase Track ID) */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: config.color }}
                />

                {/* Track Title & Badges */}
                <div className="flex items-center justify-between pl-1.5">
                  <div className="flex items-center space-x-2">
                    <div className="p-1 rounded bg-[#101114] border border-[#262830]">
                      {config.icon}
                    </div>
                    <div>
                      <h4 className="text-[11px] font-mono font-bold text-zinc-100 tracking-wide leading-none">
                        {config.name}
                      </h4>
                      <span className="text-[8px] font-mono text-zinc-500">
                        {config.gestureTag}
                      </span>
                    </div>
                  </div>

                  {/* Gesture Active Indicator Tag */}
                  {(isLeftHandControlled || isRightHandControlled) && (
                    <span className="text-[7px] font-mono font-bold px-1 py-0.2 rounded bg-red-600 text-white animate-pulse">
                      GESTURE LINK
                    </span>
                  )}
                </div>

                {/* Cubase Quick Track Buttons: Solo, Mute, Volume Fader, Pan Slider */}
                <div className="flex items-center space-x-1.5 text-xs font-mono pl-1.5">
                  {/* Mute Button [M] (Cubase Red when Active) */}
                  <button
                    onClick={() => onStemMuteToggle(stem)}
                    className={`w-6 h-6 rounded text-[10px] font-bold border transition-all flex items-center justify-center ${
                      state.muted
                        ? 'bg-red-600 text-white border-red-500 shadow-[0_0_8px_rgba(220,38,38,0.5)]'
                        : 'bg-[#1c1e24] border-[#2d303a] text-zinc-400 hover:text-white'
                    }`}
                    title={`Mute ${config.shortName}`}
                  >
                    M
                  </button>

                  {/* Solo Button [S] (Cubase Amber/Yellow when Active) */}
                  <button
                    onClick={() => onStemSoloToggle(stem)}
                    className={`w-6 h-6 rounded text-[10px] font-bold border transition-all flex items-center justify-center ${
                      state.solo
                        ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                        : 'bg-[#1c1e24] border-[#2d303a] text-zinc-400 hover:text-white'
                    }`}
                    title={`Solo ${config.shortName}`}
                  >
                    S
                  </button>

                  {/* Volume Slider & numerical dB readout */}
                  <div className="flex-1 flex items-center space-x-1 bg-[#101114] px-1.5 py-1 rounded border border-[#24262e]">
                    <span className="text-[8px] text-zinc-400 font-bold">VOL</span>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.01"
                      value={state.volume}
                      onChange={(e) => onStemVolumeChange(stem, parseFloat(e.target.value))}
                      className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-cyan-400"
                      title={`${config.shortName} Volume: ${Math.round(state.volume * 100)}%`}
                    />
                    <span className="text-[8px] text-zinc-200 font-mono w-6 text-right">
                      {Math.round(state.volume * 100)}%
                    </span>
                  </div>

                  {/* Pan Slider */}
                  <div className="flex items-center space-x-1 bg-[#101114] px-1 py-1 rounded border border-[#24262e]">
                    <span className="text-[7px] text-zinc-400 font-bold">PAN</span>
                    <input
                      type="range"
                      min="-1.0"
                      max="1.0"
                      step="0.05"
                      value={state.pan}
                      onChange={(e) => onStemPanChange(stem, parseFloat(e.target.value))}
                      className="w-8 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
                      title={`${config.shortName} Pan: ${state.pan.toFixed(2)}`}
                    />
                  </div>
                </div>

                {/* Real-time LED Peak VU Meter Strip */}
                <div className="w-full h-1 bg-black rounded-full overflow-hidden border border-[#22242c] pl-1.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, vu * 100)}%` }}
                  />
                </div>
              </div>

              {/* Right Column: Cubase Audio Event Clip & Real-time Waveform Canvas */}
              <div
                onMouseDown={handleMouseDown}
                className="relative flex-1 bg-[#0a0b0d] cursor-pointer overflow-hidden p-1.5"
                title={`Click or drag to seek across ${config.shortName} timeline`}
              >
                {/* Cubase Audio Event Container Box */}
                <div
                  className="relative w-full h-full rounded border border-zinc-800/80 overflow-hidden"
                  style={{ backgroundColor: config.bgTint }}
                >
                  {/* Stem Waveform Canvas */}
                  <canvas
                    ref={(el) => (canvasRefs.current[stem] = el)}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />

                  {/* Played Region Shading Overlay */}
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-white/5 pointer-events-none border-r border-cyan-400/80 transition-all duration-75"
                    style={{ width: `${progressPercent}%` }}
                  />

                  {/* Grid Lines Overlay */}
                  <div className="absolute inset-0 flex justify-between pointer-events-none px-2 opacity-20">
                    {rulerTicks.map((_, i) => (
                      <div key={i} className="w-px h-full bg-zinc-700" />
                    ))}
                  </div>

                  {/* Full-Height Synchronized Playhead Laser Line */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)] pointer-events-none z-20"
                    style={{ left: `calc(${progressPercent}% - 1px)` }}
                  />

                  {/* Audio Clip Header Strip */}
                  <div className="absolute top-1.5 left-2 pointer-events-none flex items-center space-x-1.5 text-[8px] font-mono font-bold text-zinc-400 bg-black/70 px-1.5 py-0.5 rounded border border-zinc-800">
                    <span style={{ color: config.color }}>●</span>
                    <span className="text-zinc-200">{trackMetadata?.title || 'DEMUCS_STEM'}</span>
                    <span className="text-zinc-500">[{config.shortName}.WAV]</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArrangementView;
