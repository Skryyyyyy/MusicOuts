import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Music,
  Disc,
  Radio,
  Sliders,
  Activity,
  Scissors,
  Plus,
  Trash2,
  Copy,
} from 'lucide-react';
import {
  StemType,
  STEM_TYPES,
  StemState,
  TrackMetadata,
  GestureState,
  AutomationPoint,
  AudioClip,
  SongItem,
} from '../types';
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
  automationPoints?: AutomationPoint[];
  showAutomation?: boolean;
  clips?: AudioClip[];
  songs?: SongItem[];
  onToggleAutomation?: () => void;
  onSeek: (seconds: number) => void;
  onStemVolumeChange: (stem: StemType, val: number) => void;
  onStemMuteToggle: (stem: StemType) => void;
  onStemSoloToggle: (stem: StemType) => void;
  onStemPanChange: (stem: StemType, pan: number) => void;
  onSliceClip?: (clipId: string, time: number) => void;
  onTrimClip?: (clipId: string, newStartOffset: number, newDuration: number) => void;
  onMoveClip?: (clipId: string, newStartTime: number) => void;
  onDuplicateClip?: (clipId: string) => void;
  onDeleteClip?: (clipId: string) => void;
  onAddClip?: (songId: string, stem: StemType) => void;
  className?: string;
}

interface StemTrackConfig {
  name: string;
  shortName: string;
  icon: React.ReactNode;
  routing: string;
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
    routing: 'CH 01 • STEREO BUS',
    badge: 'AUDIO 01',
    color: '#00bcd4',
    waveColor: '#22d3ee',
    bgTint: 'rgba(6, 182, 212, 0.08)',
  },
  drums: {
    name: '02 DRUMS [PERC]',
    shortName: 'DRUMS',
    icon: <Disc className="w-3.5 h-3.5 text-orange-400" />,
    routing: 'CH 02 • STEREO BUS',
    badge: 'AUDIO 02',
    color: '#ff7043',
    waveColor: '#fb923c',
    bgTint: 'rgba(249, 115, 22, 0.08)',
  },
  bass: {
    name: '03 BASS [LOW-END]',
    shortName: 'BASS',
    icon: <Music className="w-3.5 h-3.5 text-purple-400" />,
    routing: 'CH 03 • STEREO BUS',
    badge: 'AUDIO 03',
    color: '#ab47bc',
    waveColor: '#c084fc',
    bgTint: 'rgba(168, 85, 247, 0.08)',
  },
  other: {
    name: '04 OTHER [SYNTH & INST]',
    shortName: 'OTHER',
    icon: <Radio className="w-3.5 h-3.5 text-emerald-400" />,
    routing: 'CH 04 • STEREO BUS',
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
  automationPoints = [],
  showAutomation = true,
  clips = [],
  songs = [],
  onToggleAutomation,
  onSeek,
  onStemVolumeChange,
  onStemMuteToggle,
  onStemSoloToggle,
  onStemPanChange,
  onSliceClip,
  onDuplicateClip,
  onDeleteClip,
  onAddClip,
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
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [showMediaPool, setShowMediaPool] = useState<boolean>(false);
  const [vuLevels, setVuLevels] = useState<Record<StemType, number>>({
    vocals: 0,
    drums: 0,
    bass: 0,
    other: 0,
  });

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Real-time timeline scrubbing
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineContainerRef.current) return;
    setIsScrubbing(true);
    updateSeekFromEvent(e);
  };

  const updateSeekFromEvent = (e: MouseEvent | React.MouseEvent) => {
    if (!timelineContainerRef.current) return;
    const rect = timelineContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * (duration || 180));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing) {
        updateSeekFromEvent(e);
      }
    };

    const handleMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
      }
    };

    if (isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, duration]);

  // Real-time LED VU levels
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
          ctx.fillStyle = waveColor;
          ctx.shadowColor = waveColor;
          ctx.shadowBlur = 3;
        } else {
          ctx.fillStyle = 'rgba(161, 161, 170, 0.25)';
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }

        ctx.fillRect(x, y, Math.max(1.2, barWidth - 1), barHeight);
      }

      // Render Automation Curve Overlay
      if (showAutomation && automationPoints && automationPoints.length > 0) {
        const target = `${stem}.volume`;
        const stemAutoPoints = automationPoints
          .filter((p) => p.target === target)
          .sort((a, b) => a.time - b.time);

        if (stemAutoPoints.length > 0) {
          ctx.beginPath();
          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#ec4899';
          ctx.shadowBlur = 8;

          for (let i = 0; i < stemAutoPoints.length; i++) {
            const pt = stemAutoPoints[i];
            const autoX = (pt.time / (duration || 180)) * width;
            const autoY = height - (Math.min(1.5, Math.max(0, pt.value)) / 1.5) * (height * 0.85) - height * 0.08;
            if (i === 0) ctx.moveTo(autoX, autoY);
            else ctx.lineTo(autoX, autoY);
          }
          ctx.stroke();

          for (const pt of stemAutoPoints) {
            const autoX = (pt.time / (duration || 180)) * width;
            const autoY = height - (Math.min(1.5, Math.max(0, pt.value)) / 1.5) * (height * 0.85) - height * 0.08;
            ctx.beginPath();
            ctx.arc(autoX, autoY, 3, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 4;
            ctx.fill();
          }
        }
      }

      ctx.restore();
    }
  }, [audioGraph, progressPercent, duration, showAutomation, automationPoints]);

  const formatRulerTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const rulerTicks = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];

  const sectionMarkers = [
    { name: 'INTRO', ratio: 0.05, color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/30' },
    { name: 'VERSE', ratio: 0.25, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30' },
    { name: 'CHORUS', ratio: 0.50, color: 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30' },
    { name: 'DROP', ratio: 0.70, color: 'bg-purple-500/20 text-purple-300 border-purple-500/50 hover:bg-purple-500/30' },
    { name: 'OUTRO', ratio: 0.90, color: 'bg-zinc-800 text-zinc-300 border-zinc-600 hover:bg-zinc-700' },
  ];

  // Slice clip at playhead handler
  const handleSliceCurrentClip = () => {
    if (!selectedClipId || !onSliceClip) return;
    onSliceClip(selectedClipId, currentTime);
  };

  return (
    <div className={`bg-[#141518] border border-[#262830] rounded-lg flex flex-col overflow-hidden shadow-2xl select-none ${className}`}>
      {/* 1. Cubase Toolbar & Separated 2-Row Timeline Header */}
      <div className="flex flex-col border-b border-[#262830] bg-[#1a1b20] z-20">
        {/* ROW 1: Marker Track / Arranger Section Lane (No overlap with beat ruler!) */}
        <div className="flex border-b border-[#242630] bg-[#16171d] h-7">
          {/* Left Label */}
          <div className="w-72 sm:w-80 px-3 py-1 border-r border-[#242630] flex items-center justify-between text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider shrink-0">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Section Markers</span>
            </div>
            <span className="text-[9px] text-zinc-500 font-mono">SECTIONS</span>
          </div>

          {/* Marker Lane Chips (Separated Row) */}
          <div className="relative flex-1 h-full overflow-hidden flex items-center px-2">
            {sectionMarkers.map((m) => (
              <button
                key={m.name}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(m.ratio * (duration || 180));
                }}
                style={{ left: `calc(${m.ratio * 100}% - 24px)` }}
                className={`absolute px-2 py-0.5 rounded text-[8px] font-mono font-bold border transition-all shadow-sm ${m.color}`}
                title={`Jump to ${m.name} (${formatRulerTime(m.ratio * (duration || 180))})`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* ROW 2: Measure & Timecode Ruler Grid */}
        <div className="flex h-8 bg-[#0c0d10]">
          {/* Left Track Header Title & Tools */}
          <div className="w-72 sm:w-80 px-3 py-1 border-r border-[#262830] flex items-center justify-between text-[11px] font-mono font-bold text-zinc-300 uppercase tracking-wider shrink-0">
            <div className="flex items-center space-x-2">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <span>Stem Tracks</span>
            </div>

            <div className="flex items-center space-x-1">
              {/* Slice Clip Tool Button */}
              {onSliceClip && (
                <button
                  onClick={handleSliceCurrentClip}
                  className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] bg-[#171820] hover:bg-[#252834] text-amber-400 border border-amber-500/30 font-bold transition-all"
                  title="Slice / Split Active Clip at Playhead (S)"
                >
                  <Scissors className="w-2.5 h-2.5" />
                  <span>SPLIT</span>
                </button>
              )}

              {/* Media Pool Drawer Toggle */}
              {songs.length > 1 && (
                <button
                  onClick={() => setShowMediaPool(!showMediaPool)}
                  className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] border font-bold transition-all ${
                    showMediaPool
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                      : 'bg-[#121316] text-zinc-400 border-zinc-700 hover:text-white'
                  }`}
                  title="Open Multi-Song Media Pool"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>POOL</span>
                </button>
              )}

              {/* Automation Toggle Button */}
              {onToggleAutomation && (
                <button
                  onClick={onToggleAutomation}
                  className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] border font-bold transition-all ${
                    showAutomation
                      ? 'bg-pink-500/20 text-pink-300 border-pink-500/50 shadow-sm'
                      : 'bg-[#121316] text-zinc-500 border-zinc-700 hover:text-zinc-300'
                  }`}
                  title="Toggle Automation Curves Overlay"
                >
                  <Activity className="w-2.5 h-2.5" />
                  <span>AUTO</span>
                </button>
              )}
            </div>
          </div>

          {/* Timeline Ruler Grid */}
          <div
            ref={timelineContainerRef}
            onMouseDown={handleMouseDown}
            className={`relative flex-1 h-full bg-[#0a0b0e] overflow-hidden border-b border-[#262830] group ${
              isScrubbing ? 'cursor-grabbing' : 'cursor-pointer'
            }`}
            title="Timeline Ruler - Click or drag to seek"
          >
            {/* Sub-beat Ruler Grid Marks (Clean spacing, no collision) */}
            <div className="absolute inset-0 flex justify-between px-2 pointer-events-none">
              {rulerTicks.map((ratio, idx) => {
                const tickSecs = ratio * (duration || 180);
                const barNum = Math.floor((tickSecs / 60) * 30) + 1;
                return (
                  <div key={idx} className="flex flex-col justify-between h-full py-0.5">
                    <span className="text-[9px] font-mono text-zinc-400 font-bold">
                      {`Bar ${barNum.toString().padStart(2, '0')}`}
                      <span className="text-[8px] text-zinc-500 ml-1 font-normal">
                        {formatRulerTime(tickSecs)}
                      </span>
                    </span>
                    <div className="w-px h-1.5 bg-zinc-700 self-start" />
                  </div>
                );
              })}
            </div>

            {/* Loop Bracket Indicator */}
            {isLooping && (
              <div className="absolute top-0 bottom-0 left-0 right-0 bg-cyan-500/10 border-b-2 border-cyan-400 pointer-events-none" />
            )}

            {/* Master Playhead Locator Flag */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] pointer-events-none z-30"
              style={{ left: `calc(${progressPercent}% - 1px)` }}
            >
              <div className="w-2.5 h-2.5 bg-cyan-400 rotate-45 -translate-x-[3px] -translate-y-1 shadow-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Song Media Pool Drawer */}
      {showMediaPool && songs.length > 0 && (
        <div className="bg-[#101115] border-b border-[#242630] p-2.5 flex items-center space-x-3 overflow-x-auto text-xs font-mono">
          <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] shrink-0">
            Project Song Pool:
          </span>
          {songs.map((song) => (
            <div
              key={song.id}
              className="flex items-center space-x-2 bg-[#171820] border border-[#2b2d38] px-2.5 py-1 rounded-lg shrink-0"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: song.color }} />
              <span className="text-zinc-200 font-bold text-[11px]">{song.title}</span>
              <span className="text-zinc-500 text-[10px]">({formatRulerTime(song.duration)})</span>
              {onAddClip && (
                <div className="flex items-center space-x-1 pl-1 border-l border-zinc-700">
                  {STEM_TYPES.map((s) => (
                    <button
                      key={s}
                      onClick={() => onAddClip(song.id, s)}
                      className="px-1 py-0.2 bg-[#20222c] hover:bg-cyan-700 text-[9px] text-zinc-300 hover:text-white rounded uppercase"
                      title={`Add ${s} clip to timeline`}
                    >
                      +{s[0]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 2. 4-Stem Multi-Track Arrangement Lanes */}
      <div className="flex-1 flex flex-col divide-y divide-[#22242c] bg-[#0d0e11]">
        {STEM_TYPES.map((stem) => {
          const config = STEM_CONFIGS[stem];
          const state = stemStates[stem] || { volume: 1.0, muted: false, solo: false, pan: 0 };
          const vu = vuLevels[stem] || 0;
          const stemClips = clips.filter((c) => c.stem === stem);

          const isLeftHandControlled = stem === 'vocals' && gestureState?.leftHand.present;
          const isRightHandControlled = stem !== 'vocals' && gestureState?.rightHand.present;

          return (
            <div key={stem} className="flex min-h-[105px] group transition-colors hover:bg-[#14151a]">
              {/* Left Column: Track Header Strip */}
              <div className="w-72 sm:w-80 p-3 bg-[#17181d] border-r border-[#262830] flex flex-col justify-between space-y-1.5 relative shrink-0">
                {/* Left Colored Spine Bar */}
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
                        {config.routing}
                      </span>
                    </div>
                  </div>

                  {(isLeftHandControlled || isRightHandControlled) && (
                    <span className="text-[7px] font-mono font-bold px-1 py-0.2 rounded bg-red-600 text-white animate-pulse">
                      GESTURE LINK
                    </span>
                  )}
                </div>

                {/* Quick Track Controls: Mute, Solo, Volume, Pan */}
                <div className="flex items-center space-x-1.5 text-xs font-mono pl-1.5">
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
                    />
                    <span className="text-[8px] text-zinc-200 font-mono w-6 text-right">
                      {Math.round(state.volume * 100)}%
                    </span>
                  </div>

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

              {/* Right Column: Audio Clips Timeline Lane & Independent Laser Playhead */}
              <div
                onMouseDown={handleMouseDown}
                className="relative flex-1 bg-[#0a0b0d] cursor-pointer overflow-hidden p-1.5"
                title={`Click or drag to seek across ${config.shortName} timeline`}
              >
                <div
                  className="relative w-full h-full rounded border border-zinc-800/80 overflow-hidden"
                  style={{ backgroundColor: config.bgTint }}
                >
                  {/* Stem Background Waveform Canvas */}
                  <canvas
                    ref={(el) => (canvasRefs.current[stem] = el)}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />

                  {/* Interactive Audio Clips (if clips exist) */}
                  {stemClips.map((clip) => {
                    const clipStartRatio = (clip.startTime / (duration || 180)) * 100;
                    const clipWidthRatio = (clip.duration / (duration || 180)) * 100;
                    const isSelected = selectedClipId === clip.id;

                    return (
                      <div
                        key={clip.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClipId(clip.id);
                        }}
                        style={{
                          left: `${clipStartRatio}%`,
                          width: `${clipWidthRatio}%`,
                        }}
                        className={`absolute top-1 bottom-1 rounded border shadow-md flex flex-col justify-between p-1 z-10 transition-all ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-950/70 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                            : 'border-zinc-700/80 bg-[#15161c]/80 hover:border-zinc-500'
                        }`}
                      >
                        {/* Clip Header Bar */}
                        <div className="flex items-center justify-between text-[8px] font-mono font-bold text-zinc-300">
                          <span className="truncate max-w-[90px]">{clip.name || clip.songTitle}</span>
                          <div className="flex items-center space-x-1">
                            {onDuplicateClip && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDuplicateClip(clip.id);
                                }}
                                className="p-0.5 hover:text-cyan-300"
                                title="Duplicate Clip"
                              >
                                <Copy className="w-2.5 h-2.5" />
                              </button>
                            )}
                            {onDeleteClip && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteClip(clip.id);
                                }}
                                className="p-0.5 hover:text-red-400"
                                title="Delete Clip Slice"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Clip Time Duration Badge */}
                        <div className="text-[7px] text-zinc-500 font-mono flex justify-between items-center">
                          <span>{formatRulerTime(clip.startTime)}</span>
                          <span>{clip.duration.toFixed(1)}s</span>
                        </div>
                      </div>
                    );
                  })}

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

                  {/* Independent Moving Playhead Laser Bar (Separate on each stem!) */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,1)] pointer-events-none z-20 transition-all duration-75"
                    style={{ left: `calc(${progressPercent}% - 1px)` }}
                  >
                    <div className="w-1.5 h-3 bg-white -translate-x-[1px] rounded-full shadow-sm" />
                  </div>

                  {/* Default Track Info Tag */}
                  <div className="absolute top-1.5 left-2 pointer-events-none flex items-center space-x-1.5 text-[8px] font-mono font-bold text-zinc-400 bg-black/75 px-1.5 py-0.5 rounded border border-zinc-800 z-10">
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
