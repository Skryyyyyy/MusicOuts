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
    icon: <Mic className="w-3.5 h-3.5 text-violet-400" />,
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
  isLooping: _isLooping,
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
  const [scrubbingStem, setScrubbingStem] = useState<StemType | null>(null);
  const [isIndependentMode, setIsIndependentMode] = useState<boolean>(true);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [showMediaPool, setShowMediaPool] = useState<boolean>(false);
  const [stemTimes, setStemTimes] = useState<Record<StemType, number>>({
    vocals: 0,
    drums: 0,
    bass: 0,
    other: 0,
  });
  const [vuLevels, setVuLevels] = useState<Record<StemType, number>>({
    vocals: 0,
    drums: 0,
    bass: 0,
    other: 0,
  });

  const stemLaneRefs = useRef<Record<StemType, HTMLDivElement | null>>({
    vocals: null,
    drums: null,
    bass: null,
    other: null,
  });

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Real-time Global timeline scrubbing (Top Master Ruler)
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
    const targetTime = ratio * (duration || 180);
    onSeek(targetTime);
  };

  // Independent Per-Stem Timeline Scrubbing
  const handleStemMouseDown = (stem: StemType, e: React.MouseEvent<HTMLDivElement>) => {
    if (isIndependentMode) {
      setScrubbingStem(stem);
      updateStemSeekFromEvent(stem, e);
    } else {
      setIsScrubbing(true);
      updateSeekFromEvent(e);
    }
  };

  const updateStemSeekFromEvent = (stem: StemType, e: MouseEvent | React.MouseEvent) => {
    const laneEl = stemLaneRefs.current[stem];
    if (!laneEl) return;
    const rect = laneEl.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSec = ratio * (duration || 180);

    if (audioGraph) {
      audioGraph.seekStem(stem, targetSec);
    }
    setStemTimes((prev) => ({
      ...prev,
      [stem]: targetSec,
    }));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (scrubbingStem) {
        updateStemSeekFromEvent(scrubbingStem, e);
      } else if (isScrubbing) {
        updateSeekFromEvent(e);
      }
    };

    const handleMouseUp = () => {
      if (scrubbingStem) {
        setScrubbingStem(null);
      }
      if (isScrubbing) {
        setIsScrubbing(false);
      }
    };

    if (scrubbingStem || isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [scrubbingStem, isScrubbing, duration, audioGraph, isIndependentMode]);

  // Sync real-time per-stem timestamps & LED VU levels
  useEffect(() => {
    let animId: number;

    const tick = () => {
      if (audioGraph && isPlaying) {
        const times = audioGraph.getStemTimes();
        setStemTimes(times);

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
      } else if (!isPlaying) {
        if (audioGraph) {
          setStemTimes(audioGraph.getStemTimes());
        } else {
          setStemTimes({
            vocals: currentTime,
            drums: currentTime,
            bass: currentTime,
            other: currentTime,
          });
        }
        setVuLevels({ vocals: 0, drums: 0, bass: 0, other: 0 });
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [audioGraph, isPlaying, stemStates, currentTime]);

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
      const stemTime = stemTimes[stem] !== undefined ? stemTimes[stem] : currentTime;
      const stemPercent = duration > 0 ? (stemTime / duration) * 100 : 0;
      const progressIndex = Math.floor((stemPercent / 100) * numBars);
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
  }, [audioGraph, stemTimes, currentTime, duration, showAutomation, automationPoints]);

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

  // Reset single stem offset back to 0
  const handleResetSingleStem = (stem: StemType) => {
    if (audioGraph) {
      audioGraph.seekStem(stem, currentTime);
    }
    setStemTimes((prev) => ({
      ...prev,
      [stem]: currentTime,
    }));
  };

  return (
    <div className={`bg-surface-container-lowest border border-surface-container-highest/50 flex flex-col overflow-hidden select-none ${className}`}>
      {/* 1. Primary Full-Width Arrangement Studio Action Toolbar */}
      <div className="h-8 px-3 bg-surface-container border-b border-surface-container-highest flex items-center justify-between z-30 shrink-0 select-none">
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-2 text-xs font-mono font-extrabold text-on-surface">
            <Sliders className="w-3.5 h-3.5 text-primary" />
            <span className="uppercase tracking-wider font-sans">Arrangement Timeline</span>
          </div>

          <span className="text-outline-variant">|</span>

          {/* Independent / Linked Mode Toggle Button */}
          <button
            onClick={() => setIsIndependentMode(!isIndependentMode)}
            className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono border font-bold transition-all active:scale-95 ${
              isIndependentMode
                ? 'bg-secondary-container text-on-secondary-container border-secondary-container shadow-[0_0_6px_rgba(236,106,6,0.6)]'
                : 'bg-surface-container-high text-primary border-outline-variant'
            }`}
            title="Toggle Independent Stem Playhead Scrubbing vs Linked Playheads"
          >
            <Sliders className="w-3 h-3" />
            <span>{isIndependentMode ? '⚡ INDEPENDENT STEM BARS' : '🔗 LINKED PLAYHEADS'}</span>
          </button>

          {/* Re-align All Stem Offsets */}
          {audioGraph && (
            <button
              onClick={() => {
                audioGraph.resetStemOffsets();
                const now = audioGraph.getCurrentTime();
                setStemTimes({ vocals: now, drums: now, bass: now, other: now });
              }}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] bg-violet-500/[0.06] hover:bg-violet-500/[0.14] text-violet-200/70 hover:text-violet-100 border border-violet-500/[0.15] font-bold transition-all active:scale-95"
              title="Re-align all stem playheads back to sync with master playhead"
            >
              <span>↺ ALIGN ALL</span>
            </button>
          )}

          {/* Slice Clip Tool Button */}
          {onSliceClip && (
            <button
              onClick={handleSliceCurrentClip}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] bg-white/[0.04] hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 font-bold transition-all active:scale-95"
              title="Slice / Split Active Clip at Playhead (S)"
            >
              <Scissors className="w-3 h-3" />
              <span>SPLIT</span>
            </button>
          )}

          {/* Media Pool Drawer Toggle */}
          {songs.length > 0 && (
            <button
              onClick={() => setShowMediaPool(!showMediaPool)}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] border font-bold transition-all active:scale-95 ${
                showMediaPool
                  ? 'bg-violet-600 text-white border-violet-400 shadow-[0_0_12px_rgba(124,58,237,0.5)]'
                  : 'bg-white/[0.04] text-zinc-300 border-white/[0.08] hover:text-white'
              }`}
              title="Open Multi-Song Media Pool"
            >
              <Plus className="w-3 h-3" />
              <span>SONG POOL ({songs.length})</span>
            </button>
          )}

          {/* Automation Toggle Button */}
          {onToggleAutomation && (
            <button
              onClick={onToggleAutomation}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] border font-bold transition-all active:scale-95 ${
                showAutomation
                  ? 'bg-pink-500/20 text-pink-300 border-pink-500/50 shadow-sm'
                  : 'bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:text-zinc-200'
              }`}
              title="Toggle Automation Curves Overlay"
            >
              <Activity className="w-3 h-3" />
              <span>AUTO</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-400">
          <span className="text-zinc-500">GRID: <strong className="text-zinc-300">1/16 BAR</strong></span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-500">MASTER: <strong className="text-cyan-400">{formatRulerTime(currentTime)}</strong> / {formatRulerTime(duration || 180)}</span>
        </div>
      </div>

      {/* Multi-Song Media Pool Drawer */}
      {showMediaPool && songs.length > 0 && (
        <div className="bg-[#07061a] border-b border-violet-500/[0.1] p-2.5 flex items-center space-x-3 overflow-x-auto text-xs font-mono shrink-0">
          <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] shrink-0">
            Project Song Pool:
          </span>
          {songs.map((song) => (
            <div
              key={song.id}
              className="flex items-center space-x-2 bg-[#0e0c20] border border-violet-500/[0.12] px-3 py-1 rounded-full shrink-0"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: song.color }} />
              <span className="text-zinc-200 font-bold text-[11px]">{song.title}</span>
              <span className="text-zinc-500 text-[10px]">({formatRulerTime(song.duration)})</span>
              {onAddClip && (
                <div className="flex items-center space-x-1 pl-1.5 border-l border-zinc-700">
                  {STEM_TYPES.map((s) => (
                    <button
                      key={s}
                      onClick={() => onAddClip(song.id, s)}
                      className="px-1.5 py-0.5 bg-white/[0.05] hover:bg-cyan-500 hover:text-black text-[9px] text-zinc-300 rounded uppercase font-bold transition-all"
                      title={`Add ${s} clip to timeline`}
                    >
                      +{s[0].toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 2. Structured Multi-Row Timeline Container */}
      <div className="flex flex-col flex-1 overflow-y-auto bg-[#13151b]">
        {/* ROW 1: Marker Track / Arranger Section Lane */}
        <div className="flex border-b border-surface-container-highest/60 bg-surface-container-low h-7 shrink-0">
          {/* Left Label */}
          <div className="w-56 sm:w-64 px-3 py-1 border-r border-surface-container-highest/60 bg-surface-container-low flex items-center justify-between text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider shrink-0">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_#89ceff]" />
              <span className="text-on-surface">Section Markers</span>
            </div>
            <span className="text-[9px] text-outline font-mono">SECTIONS</span>
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
                className={`absolute px-2.5 py-0.5 rounded text-[8px] font-mono font-extrabold border transition-all shadow-sm active:scale-95 ${m.color}`}
                title={`Jump to ${m.name} (${formatRulerTime(m.ratio * (duration || 180))})`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* ROW 2: Measure & Timecode Ruler Grid */}
        <div className="flex h-7 bg-surface-container-low border-b border-surface-container-highest shrink-0">
          {/* Left Ruler Header */}
          <div className="w-56 sm:w-64 px-3 py-1 border-r border-surface-container-highest/60 bg-surface-container flex items-center justify-between text-[10px] font-mono font-bold text-on-surface uppercase tracking-wider shrink-0">
            <span className="font-semibold text-on-surface">Tracks (5 Active)</span>
            <span className="text-[9px] text-outline">BAR / TIME</span>
          </div>

          {/* Timeline Ruler Grid */}
          <div
            ref={timelineContainerRef}
            onMouseDown={handleMouseDown}
            className={`relative flex-1 h-full bg-surface-container-lowest overflow-hidden group ${
              isScrubbing ? 'cursor-grabbing' : 'cursor-pointer'
            }`}
            title="Global Timeline Ruler - Click or drag to seek master timeline"
          >
            {/* Sub-beat Ruler Grid Marks */}
            <div className="absolute inset-0 flex justify-between px-2 pointer-events-none">
              {rulerTicks.map((ratio, idx) => {
                const tickSecs = ratio * (duration || 180);
                const barNum = Math.floor((tickSecs / 60) * 30) + 1;
                return (
                  <div key={idx} className="flex flex-col justify-between h-full py-0.5">
                    <span className="text-[9px] font-mono text-on-surface-variant font-bold">
                      {barNum}
                      <span className="text-[8px] text-outline ml-1 font-normal">
                        {formatRulerTime(tickSecs)}
                      </span>
                    </span>
                    <div className="w-px h-1.5 bg-outline-variant self-start" />
                  </div>
                );
              })}
            </div>

            {/* Loop Bracket Indicator (Bar 33 to 49) */}
            <div className="absolute top-0 bottom-0 left-[26%] w-[48%] bg-secondary-container/20 border-l-2 border-r-2 border-secondary-container z-10 pointer-events-none flex items-start justify-between px-pad-xs font-label-sm text-secondary font-bold">
              <span className="bg-secondary-container text-on-secondary-container px-pad-micro rounded-b">L 33</span>
              <span className="bg-secondary-container text-on-secondary-container px-pad-micro rounded-b">R 49</span>
            </div>

            {/* Glowing Cyan Playhead Locator Flag */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_8px_#89ceff] pointer-events-none z-30"
              style={{ left: `calc(${progressPercent}% - 1px)` }}
            >
              <div className="w-3 h-3 bg-primary rotate-45 -translate-x-[5px] -translate-y-1 shadow-md" />
            </div>
          </div>
        </div>

        {/* ROWS 3-6: 4-Stem Multi-Track Arrangement Lanes */}
        <div className="flex-1 flex flex-col divide-y divide-surface-container-highest/60 bg-[#13151b]">
          {STEM_TYPES.map((stem) => {
            const config = STEM_CONFIGS[stem];
            const state = stemStates[stem] || { volume: 1.0, muted: false, solo: false, pan: 0 };
            const vu = vuLevels[stem] || 0;
            const stemClips = clips.filter((c) => c.stem === stem);
            const stemCurrentTime = stemTimes[stem] !== undefined ? stemTimes[stem] : currentTime;
            const stemProgress = duration > 0 ? (stemCurrentTime / duration) * 100 : 0;
            const stemOffset = stemCurrentTime - currentTime;
            const hasOffset = Math.abs(stemOffset) > 0.08;

            const isLeftHandControlled = stem === 'vocals' && gestureState?.leftHand.present;
            const isRightHandControlled = stem !== 'vocals' && gestureState?.rightHand.present;

            return (
              <div key={stem} className="flex min-h-[72px] h-track-h-expanded border-b border-surface-container-highest/60 hover:bg-surface-container/20 group transition-colors">
                {/* Left Column: Cubase Track Header Box */}
                <div className="w-56 sm:w-64 p-2 bg-surface-container-low border-r border-surface-container-highest/60 flex flex-col justify-between relative shrink-0 shadow-sm">
                  {/* Left Colored Spine Bar */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1.5 shadow-sm"
                    style={{ backgroundColor: config.color, boxShadow: `0 0 8px ${config.color}60` }}
                  />

                  {/* Track Title, Routing, Timecode & Quick Alignment Reset */}
                  <div className="flex items-center justify-between pl-1.5">
                    <div className="flex items-center space-x-2 truncate">
                      <div
                        className="p-1 rounded border flex items-center justify-center shrink-0 shadow-sm"
                        style={{ backgroundColor: `${config.color}20`, borderColor: `${config.color}50` }}
                      >
                        {config.icon}
                      </div>
                      <div className="truncate">
                        <h4 className="text-[11px] font-mono font-bold text-on-surface tracking-wide leading-none truncate">
                          {config.name}
                        </h4>
                        <span className="text-[9px] font-mono text-on-surface-variant truncate block mt-0.5">
                          {config.routing}
                        </span>
                      </div>
                    </div>

                    {/* Time Badge + Single Stem Align Reset Button */}
                    <div className="flex items-center space-x-1 shrink-0">
                      <span
                        className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-surface-container-lowest border border-surface-container-highest text-on-surface shadow-inner"
                        style={{ color: config.color }}
                        title={`${config.shortName} Playback Position`}
                      >
                        {formatRulerTime(stemCurrentTime)}
                      </span>
                      {hasOffset && (
                        <button
                          onClick={() => handleResetSingleStem(stem)}
                          className="text-[8px] font-mono font-bold px-1 py-0.2 rounded bg-secondary-container text-on-secondary-container border border-secondary-container transition-all shadow-sm"
                          title="Reset offset to master (0.0s)"
                        >
                          ↺ 0s
                        </button>
                      )}
                      {(isLeftHandControlled || isRightHandControlled) && (
                        <span className="text-[7px] font-mono font-bold px-1 py-0.2 rounded bg-error text-on-error animate-pulse shadow-sm">
                          GESTURE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Track Controls: Mute, Solo, Volume, Pan */}
                  <div className="flex items-center space-x-1.5 text-xs font-mono pl-1.5">
                    <button
                      onClick={() => onStemMuteToggle(stem)}
                      className={`w-6 h-5 rounded-sm text-[10px] font-bold border transition-all flex items-center justify-center ${
                        state.muted
                          ? 'bg-error-container text-on-error border-error shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                          : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
                      }`}
                      title={`Mute ${config.shortName}`}
                    >
                      M
                    </button>

                    <button
                      onClick={() => onStemSoloToggle(stem)}
                      className={`w-6 h-5 rounded-sm text-[10px] font-bold border transition-all flex items-center justify-center ${
                        state.solo
                          ? 'bg-secondary-container text-on-secondary-container shadow-[0_0_8px_rgba(236,106,6,0.6)] font-bold'
                          : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
                      }`}
                      title={`Solo ${config.shortName}`}
                    >
                      S
                    </button>

                    {/* Volume Slider Capsule */}
                    <div className="flex-1 flex items-center space-x-1 bg-surface-container-lowest px-1.5 py-0.5 rounded border border-surface-container-highest/60 shadow-inner">
                      <span className="text-[7px] text-outline font-bold">VOL</span>
                      <input
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.01"
                        value={state.volume}
                        onChange={(e) => onStemVolumeChange(stem, parseFloat(e.target.value))}
                        className="w-full h-1 bg-surface-container-highest rounded appearance-none cursor-pointer accent-primary"
                      />
                      <span className="text-[8px] text-on-surface font-mono w-6 text-right font-bold">
                        {Math.round(state.volume * 100)}%
                      </span>
                    </div>

                    {/* Pan Slider Capsule */}
                    <div className="flex items-center space-x-0.5 bg-surface-container-lowest px-1 py-0.5 rounded border border-surface-container-highest/60 shadow-inner">
                      <span className="text-[7px] text-outline font-bold">PAN</span>
                      <input
                        type="range"
                        min="-1.0"
                        max="1.0"
                        step="0.05"
                        value={state.pan}
                        onChange={(e) => onStemPanChange(stem, parseFloat(e.target.value))}
                        className="w-7 h-1 bg-surface-container-highest rounded appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  </div>

                  {/* Real-time Peak VU Meter Strip */}
                  <div className="w-full h-1 bg-surface-container-lowest rounded-full overflow-hidden border border-surface-container-highest/60 pl-1.5 shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-tertiary via-secondary to-error transition-all duration-75 shadow-[0_0_6px_rgba(74,225,118,0.5)]"
                      style={{ width: `${Math.min(100, vu * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Right Column: Audio Clips Timeline Lane */}
                <div
                  ref={(el) => (stemLaneRefs.current[stem] = el)}
                  onMouseDown={(e) => handleStemMouseDown(stem, e)}
                  className={`relative flex-1 bg-[#13151b] overflow-hidden p-1 group ${
                    scrubbingStem === stem ? 'cursor-grabbing' : 'cursor-pointer'
                  }`}
                  title={`Click or drag to seek ${config.shortName} independently (${formatRulerTime(stemCurrentTime)})`}
                >
                  <div
                    className="relative w-full h-full rounded border border-surface-container-highest/40 overflow-hidden shadow-inner bg-[#13151b]"
                    style={{ backgroundColor: config.bgTint }}
                  >
                    {/* Stem Background Waveform Canvas */}
                    <canvas
                      ref={(el) => (canvasRefs.current[stem] = el)}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    />

                    {/* Interactive Audio Clips */}
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
                              ? 'border-primary bg-surface-container-highest shadow-[0_0_12px_rgba(137,206,255,0.4)]'
                              : 'border-surface-container-highest/80 bg-surface-container-high hover:border-primary/50'
                          }`}
                        >
                          {/* Clip Header Bar */}
                          <div className="h-3.5 bg-primary-container/20 px-1 rounded-sm flex items-center justify-between text-[9px] font-mono font-bold text-on-surface">
                            <span className="truncate max-w-[100px] text-primary">{clip.name || clip.songTitle}</span>
                            <div className="flex items-center space-x-1">
                              {onDuplicateClip && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDuplicateClip(clip.id);
                                  }}
                                  className="p-0.5 hover:text-primary transition-colors"
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
                                  className="p-0.5 hover:text-error transition-colors"
                                  title="Delete Clip Slice"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Clip Time Duration Badge */}
                          <div className="text-[8px] text-on-surface-variant font-mono flex justify-between items-center px-0.5">
                            <span>{formatRulerTime(clip.startTime)}</span>
                            <span className="px-1 rounded bg-surface-container-lowest border border-surface-container-highest/50 text-primary">
                              {clip.duration.toFixed(1)}s
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Played Region Shading Overlay */}
                    <div
                      className="absolute top-0 bottom-0 left-0 bg-white/[0.02] pointer-events-none border-r transition-all duration-75"
                      style={{
                        width: `${stemProgress}%`,
                        borderColor: config.color,
                      }}
                    />

                    {/* Grid Lines Overlay */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none px-2 opacity-10">
                      {rulerTicks.map((_, i) => (
                        <div key={i} className="w-px h-full bg-outline" />
                      ))}
                    </div>

                    {/* Playhead Indicator Line */}
                    <div
                      className="absolute top-0 bottom-0 w-[2px] pointer-events-none z-20 transition-all duration-75"
                      style={{
                        left: `calc(${stemProgress}% - 1px)`,
                        backgroundColor: config.color,
                        boxShadow: `0 0 8px ${config.color}`,
                      }}
                    >
                      <div
                        className="w-2.5 h-3 -translate-x-[4px] -translate-y-0.5 rounded-sm shadow-sm flex items-center justify-center text-[7px] font-extrabold text-black"
                        style={{ backgroundColor: config.color }}
                      >
                        ▼
                      </div>
                    </div>

                    {/* Default Track Info Tag */}
                    <div className="absolute top-1.5 left-2 pointer-events-none flex items-center space-x-1.5 text-[8px] font-mono font-bold text-on-surface-variant bg-surface-container-lowest/90 px-1.5 py-0.5 rounded border border-surface-container-highest/60 z-10 shadow-sm">
                      <span style={{ color: config.color }}>●</span>
                      <span className="text-on-surface font-extrabold">{trackMetadata?.title || 'DEMUCS_STEM'}</span>
                      <span className="text-outline">[{config.shortName}.WAV]</span>
                      <span className="font-mono text-primary ml-1 font-extrabold">[{formatRulerTime(stemCurrentTime)}]</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ArrangementView;
