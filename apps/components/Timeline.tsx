import React, { useRef, useState, useEffect } from 'react';
import { Project, Clip, Track, SourceAsset, SongSection } from '../../core/project-model/types';
import { WaveformCanvas } from './WaveformCanvas';
import {
  MousePointer,
  Scissors,
  Pencil,
  Spline,
  MoveHorizontal,
  ArrowRight,
  ChevronDown,
  Maximize2,
  Drum,
  Guitar,
  Mic,
  Piano,
  Activity,
  Music,
  Plus,
  ZoomIn,
  ZoomOut,
  FolderOpen,
} from 'lucide-react';

interface TimelineProps {
  project: Project;
  currentTime: number;
  selectedClipId: string | null;
  meterLevels: { left: number; right: number };
  onSelectClip: (clip: Clip | null) => void;
  onSelectTrack: (track: Track | null) => void;
  onSeek: (time: number) => void;
  onDoubleClickClip?: (clip: Clip) => void;
  onSplitClip?: (clipId: string, time: number) => void;
  onMoveClip?: (clipId: string, newStartTime: number, newTrackId?: string) => void;
  onTrimClip?: (clipId: string, newSourceIn: number, newSourceOut: number, newStartTime?: number) => void;
  onToggleTrackMute: (trackId: string) => void;
  onToggleTrackSolo: (trackId: string) => void;
  onDropSampleOnTrack: (trackId: string, time: number, asset: SourceAsset, section?: SongSection) => void;
  onAddTrack?: () => void;
  onLoadDemoProject?: () => void;
  onImportAudioFile?: () => void;
  onOpenURLImport?: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  project,
  currentTime,
  selectedClipId,
  meterLevels,
  onSelectClip,
  onSelectTrack,
  onSeek,
  onDoubleClickClip,
  onSplitClip,
  onMoveClip,
  onTrimClip,
  onToggleTrackMute,
  onToggleTrackSolo,
  onDropSampleOnTrack,
  onAddTrack,
  onLoadDemoProject,
  onImportAudioFile,
  onOpenURLImport,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'split' | 'draw' | 'curve' | 'slip' | 'range'>('select');
  const [snapGrid, setSnapGrid] = useState<'1/16' | '1/8' | '1/4' | '1 Bar' | 'Off'>('1/4');
  const [isSnapMenuOpen, setIsSnapMenuOpen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [zoomScale, setZoomScale] = useState<number>(1.0); // 0.5x to 2.5x

  // Track razor hover position for blade guide preview
  const [razorHover, setRazorHover] = useState<{ clipId: string; time: number; x: number } | null>(null);

  // Dragging state for moving, trimming, and slipping clips
  const [draggingClip, setDraggingClip] = useState<{
    clipId: string;
    type: 'move' | 'trim-left' | 'trim-right' | 'slip';
    startX: number;
    originalStartTime: number;
    originalSourceIn: number;
    originalSourceOut: number;
    originalTrackId: string;
    targetStartTime: number;
    targetTrackId: string;
    targetSourceIn: number;
    targetSourceOut: number;
  } | null>(null);

  const basePxPerSec = 10.5;
  const pxPerSec = basePxPerSec * zoomScale;
  const timelineWidth = Math.max(1200, 120 * pxPerSec);

  const timeToPx = (time: number) => time * pxPerSec;
  const pxToTime = (px: number) => Math.max(0, px / pxPerSec);

  const calculateSnapTime = (time: number): number => {
    if (snapGrid === 'Off') return time;
    const beatSec = 60 / (project.bpm || 120);
    let stepSec = beatSec;
    if (snapGrid === '1/16') stepSec = beatSec / 4;
    else if (snapGrid === '1/8') stepSec = beatSec / 2;
    else if (snapGrid === '1/4') stepSec = beatSec;
    else if (snapGrid === '1 Bar') stepSec = beatSec * 4;

    return Math.max(0, Math.round(time / stepSec) * stepSec);
  };

  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + scrollContainerRef.current.scrollLeft;
    const targetTime = pxToTime(Math.max(0, clickX));
    onSeek(calculateSnapTime(targetTime));
    setIsScrubbing(true);
  };

  // Global mouse move & up listeners for scrubbing, clip moving & trimming
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing && scrollContainerRef.current) {
        const rect = scrollContainerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left + scrollContainerRef.current.scrollLeft;
        const targetTime = pxToTime(Math.max(0, clickX));
        onSeek(targetTime);
      }

      if (draggingClip && scrollContainerRef.current) {
        const deltaX = e.clientX - draggingClip.startX;
        const deltaTime = deltaX / pxPerSec;

        if (draggingClip.type === 'move') {
          const rawNewStart = Math.max(0, draggingClip.originalStartTime + deltaTime);
          const snappedStart = calculateSnapTime(rawNewStart);
          setDraggingClip((prev) => (prev ? { ...prev, targetStartTime: snappedStart } : null));
        } else if (draggingClip.type === 'trim-left') {
          const rawDelta = deltaTime;
          const maxShift = draggingClip.originalSourceOut - draggingClip.originalSourceIn - 0.2;
          const shift = Math.max(-draggingClip.originalStartTime, Math.min(maxShift, rawDelta));
          setDraggingClip((prev) =>
            prev
              ? {
                  ...prev,
                  targetStartTime: prev.originalStartTime + shift,
                  targetSourceIn: prev.originalSourceIn + shift,
                }
              : null
          );
        } else if (draggingClip.type === 'trim-right') {
          const rawDelta = deltaTime;
          const newSourceOut = Math.max(
            draggingClip.originalSourceIn + 0.2,
            draggingClip.originalSourceOut + rawDelta
          );
          setDraggingClip((prev) => (prev ? { ...prev, targetSourceOut: newSourceOut } : null));
        } else if (draggingClip.type === 'slip') {
          // Slip tool: shift source in/out while keeping clip position fixed
          const rawDelta = deltaTime;
          const newIn = Math.max(0, draggingClip.originalSourceIn - rawDelta);
          const duration = draggingClip.originalSourceOut - draggingClip.originalSourceIn;
          setDraggingClip((prev) =>
            prev
              ? {
                  ...prev,
                  targetSourceIn: newIn,
                  targetSourceOut: newIn + duration,
                }
              : null
          );
        }
      }
    };

    const handleMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
      }

      if (draggingClip) {
        if (draggingClip.type === 'move' && onMoveClip) {
          onMoveClip(draggingClip.clipId, draggingClip.targetStartTime, draggingClip.targetTrackId);
        } else if (
          (draggingClip.type === 'trim-left' || draggingClip.type === 'trim-right' || draggingClip.type === 'slip') &&
          onTrimClip
        ) {
          onTrimClip(
            draggingClip.clipId,
            draggingClip.targetSourceIn,
            draggingClip.targetSourceOut,
            draggingClip.targetStartTime
          );
        }
        setDraggingClip(null);
      }
    };

    if (isScrubbing || draggingClip) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, draggingClip, project.bpm, snapGrid, pxPerSec]);

  const rulerMarks = [
    '0:00', '0:10', '0:20', '0:30', '0:40', '0:50', '1:00', '1:10', '1:20', '1:30', '1:40', '1:50', '2:00'
  ];

  const getTrackIcon = (_stemType: string, index: number) => {
    switch (index % 7) {
      case 0: return Drum;
      case 1: return Guitar;
      case 2: return Guitar;
      case 3: return Mic;
      case 4: return Piano;
      case 5: return Activity;
      case 6: return Music;
      default: return Music;
    }
  };

  const handleClipMouseDown = (
    e: React.MouseEvent,
    clip: Clip,
    type: 'move' | 'trim-left' | 'trim-right' | 'slip'
  ) => {
    e.stopPropagation();
    onSelectClip(clip);

    // If Razor tool is active, clicking splits the clip!
    if (activeTool === 'split') {
      if (!scrollContainerRef.current) return;
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left + scrollContainerRef.current.scrollLeft;
      const splitTime = pxToTime(clickX);
      if (onSplitClip && splitTime > clip.startTime && splitTime < clip.startTime + (clip.sourceOut - clip.sourceIn)) {
        onSplitClip(clip.id, splitTime);
        return;
      }
    }

    const currentToolType = activeTool === 'slip' ? 'slip' : type;

    setDraggingClip({
      clipId: clip.id,
      type: currentToolType,
      startX: e.clientX,
      originalStartTime: clip.startTime,
      originalSourceIn: clip.sourceIn,
      originalSourceOut: clip.sourceOut,
      originalTrackId: clip.trackId,
      targetStartTime: clip.startTime,
      targetTrackId: clip.trackId,
      targetSourceIn: clip.sourceIn,
      targetSourceOut: clip.sourceOut,
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDropOnTrack = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (dataStr) {
        const payload = JSON.parse(dataStr);
        if (payload.asset) {
          if (!scrollContainerRef.current) return;
          const rect = scrollContainerRef.current.getBoundingClientRect();
          const dropX = e.clientX - rect.left + scrollContainerRef.current.scrollLeft;
          const dropTime = calculateSnapTime(pxToTime(dropX));
          onDropSampleOnTrack(trackId, dropTime, payload.asset, payload.section);
        }
      }
    } catch {
      // Ignored
    }
  };

  return (
    <section className="flex-1 flex flex-col bg-[#08090E]/90 overflow-hidden select-none relative">
      {/* 1. Timeline Top Ribbon (Video-Editing Tools & Zoom) */}
      <div className="h-9 apple-glass-toolbar border-b border-white/[0.08] flex items-center justify-between px-3 shrink-0 z-30">
        {/* Premiere / Final Cut Pro Editing Tools */}
        <div className="flex items-center space-x-1 apple-glass-capsule px-1 py-0.5">
          <button
            onClick={() => setActiveTool('select')}
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'select' ? 'bg-[#00E5FF]/20 text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.4)] border border-[#00E5FF]/40' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
            title="Selection / Pointer Tool (V)"
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('split')}
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'split' ? 'bg-[#FF1744]/20 text-[#FF1744] shadow-[0_0_12px_rgba(255,23,68,0.4)] border border-[#FF1744]/40' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
            title="Razor Cut Tool (C) - Click any clip to slice audio"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('slip')}
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'slip' ? 'bg-amber-400/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.4)] border border-amber-400/40' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
            title="Slip Tool (Y) - Drag to slip audio inside clip"
          >
            <MoveHorizontal className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('curve')}
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'curve' ? 'bg-purple-400/20 text-purple-300 shadow-[0_0_12px_rgba(192,132,252,0.4)] border border-purple-400/40' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
            title="Keyframe Bezier Curve Editor Tool (P)"
          >
            <Spline className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('draw')}
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'draw' ? 'bg-[#00E5FF]/20 text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.4)] border border-[#00E5FF]/40' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
            title="Pencil / Automation Draw (B)"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('range')}
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'range' ? 'bg-[#00E5FF]/20 text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.4)] border border-[#00E5FF]/40' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
            title="Range Selection Tool (R)"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Tools: Snap Dropdown, Zoom In/Out, Expand */}
        <div className="flex items-center space-x-2 text-xs relative">
          <div
            onClick={() => setIsSnapMenuOpen(!isSnapMenuOpen)}
            className="apple-glass-btn flex items-center space-x-1.5 text-slate-200 px-2.5 py-1 rounded-full cursor-pointer transition-all"
          >
            <span className="text-[11px] text-slate-400">Snap:</span>
            <span className="text-[11px] font-semibold text-white">{snapGrid}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </div>

          {/* Snap Grid Menu */}
          {isSnapMenuOpen && (
            <div className="absolute right-24 top-8 w-32 apple-glass-card rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              {(['1/16', '1/8', '1/4', '1 Bar', 'Off'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setSnapGrid(opt);
                    setIsSnapMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-white/10 flex items-center justify-between ${
                    snapGrid === opt ? 'text-[#00E5FF] font-bold bg-[#00E5FF]/10' : 'text-slate-300'
                  }`}
                >
                  <span>{opt}</span>
                  {snapGrid === opt && <span className="text-[#00E5FF]">✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* Zoom Buttons */}
          <div className="flex items-center apple-glass-capsule p-0.5">
            <button
              onClick={() => setZoomScale((prev) => Math.max(0.5, prev - 0.25))}
              className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono font-medium text-slate-300 px-1.5">{Math.round(zoomScale * 100)}%</span>
            <button
              onClick={() => setZoomScale((prev) => Math.min(2.5, prev + 0.25))}
              className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
              } else {
                document.exitFullscreen();
              }
            }}
            className="apple-glass-btn p-1.5 rounded-full text-slate-400 hover:text-white transition-all"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Timeline: Left Track Headers + Right Scrollable Clips */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Track Headers (Fixed Column) */}
        <div className="w-48 bg-[#0D0F18]/95 backdrop-blur-xl border-r border-white/[0.08] shrink-0 flex flex-col pt-7 z-20 shadow-xl overflow-y-auto">
          {project.tracks.map((track, idx) => {
            const Icon = getTrackIcon(track.stemType, idx);

            return (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track)}
                className="h-16 border-b border-white/[0.06] px-2.5 flex items-center justify-between hover:bg-white/[0.04] transition-all cursor-pointer group"
              >
                <div className="flex items-center space-x-2 overflow-hidden">
                  <span className="text-xs font-mono text-slate-500 w-3">{idx + 1}</span>

                  {/* Colored Icon Circle */}
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: `${track.color}25`,
                      border: `1px solid ${track.color}60`,
                      boxShadow: `0 0 12px ${track.color}20`,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: track.color }} />
                  </div>

                  <div className="overflow-hidden">
                    <span className="text-xs font-semibold text-slate-200 truncate block group-hover:text-white">
                      {track.name}
                    </span>
                    {/* M, S, Record Controls */}
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTrackMute(track.id);
                        }}
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-all ${
                          track.isMuted
                            ? 'bg-red-500 text-white font-black shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                            : 'text-slate-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        M
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTrackSolo(track.id);
                        }}
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-all ${
                          track.isSoloed
                            ? 'bg-amber-400 text-black font-black shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                            : 'text-slate-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        S
                      </button>
                      <div className="w-2 h-2 rounded-full bg-red-500/80 shadow-[0_0_6px_#EF4444]" />
                    </div>
                  </div>
                </div>

                {/* Track mini level meter */}
                <div className="w-1.5 h-8 bg-black/50 rounded-full overflow-hidden p-0.5 border border-white/[0.08] flex flex-col justify-end">
                  <div
                    className="w-full bg-gradient-to-t from-emerald-500 via-lime-400 to-amber-300 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.min(100, Math.max(10, meterLevels.left * (100 - idx * 10)))}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* Full-width Add Track Button */}
          {onAddTrack && (
            <button
              onClick={onAddTrack}
              className="m-2.5 py-2 apple-glass-btn border-dashed border-white/20 hover:border-[#00E5FF]/60 hover:bg-[#00E5FF]/10 text-slate-300 hover:text-[#00E5FF] rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Audio Track</span>
            </button>
          )}
        </div>

        {/* Right Scrollable Timeline Canvas */}
        <div
          ref={scrollContainerRef}
          className={`flex-1 overflow-x-auto overflow-y-auto relative bg-[#06070B] ${
            activeTool === 'split' ? 'cursor-crosshair' : activeTool === 'slip' ? 'cursor-ew-resize' : 'cursor-default'
          }`}
        >
          <div className="relative min-h-full" style={{ width: `${timelineWidth}px` }}>
            {/* Top Time Ruler */}
            <div
              onMouseDown={handleRulerMouseDown}
              className="h-7 border-b border-white/[0.08] bg-[#0A0C13]/90 backdrop-blur-md sticky top-0 z-30 cursor-pointer flex items-center select-none shadow-sm"
            >
              {rulerMarks.map((mark, i) => (
                <div
                  key={mark}
                  className="absolute text-[10px] font-mono text-slate-400 flex flex-col items-center transform -translate-x-1/2"
                  style={{ left: `${i * 10 * pxPerSec}px` }}
                >
                  <span>{mark}</span>
                  <div className="w-px h-1.5 bg-white/20 mt-0.5" />
                </div>
              ))}
            </div>

            {/* Vertical Grid Lines */}
            <div className="absolute inset-0 top-7 pointer-events-none">
              {rulerMarks.map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-white/[0.03]"
                  style={{ left: `${i * 10 * pxPerSec}px` }}
                />
              ))}
            </div>

            {/* Track Rows and Clips */}
            <div className="flex flex-col">
              {project.tracks.map((track, _trackIdx) => {
                const trackClips = project.clips.filter((c) => c.trackId === track.id);

                return (
                  <div
                    key={track.id}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnTrack(e, track.id)}
                    className="h-16 border-b border-white/[0.06] relative flex items-center group"
                  >
                    {trackClips.map((clip) => {
                      const isBeingDragged = draggingClip && draggingClip.clipId === clip.id;
                      const activeStart = isBeingDragged ? draggingClip.targetStartTime : clip.startTime;
                      const activeIn = isBeingDragged ? draggingClip.targetSourceIn : clip.sourceIn;
                      const activeOut = isBeingDragged ? draggingClip.targetSourceOut : clip.sourceOut;

                      const clipLeft = timeToPx(activeStart);
                      const clipDuration = activeOut - activeIn;
                      const clipWidth = timeToPx(clipDuration);
                      const isSelected = selectedClipId === clip.id;

                      return (
                        <div
                          key={clip.id}
                          onMouseDown={(e) => handleClipMouseDown(e, clip, 'move')}
                          onMouseMove={(e) => {
                            if (activeTool === 'split') {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const x = e.clientX - rect.left;
                              setRazorHover({
                                clipId: clip.id,
                                time: activeStart + pxToTime(x),
                                x: x,
                              });
                            }
                          }}
                          onMouseLeave={() => setRazorHover(null)}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (onDoubleClickClip) onDoubleClickClip(clip);
                          }}
                          className={`absolute top-1 bottom-1 rounded-xl overflow-hidden flex flex-col apple-clip-glass transition-all ${
                            isSelected
                              ? 'ring-2 ring-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.3)] z-20'
                              : 'hover:brightness-110 shadow-lg'
                          }`}
                          style={{
                            left: `${clipLeft}px`,
                            width: `${Math.max(30, clipWidth)}px`,
                            backgroundColor: `${track.color}40`,
                            borderColor: `${track.color}80`,
                            boxShadow: isSelected
                              ? `0 0 20px ${track.color}60, inset 0 1px 0 0 rgba(255,255,255,0.4)`
                              : `inset 0 1px 0 0 rgba(255,255,255,0.25)`,
                          }}
                        >
                          {/* Left Trim Handle */}
                          <div
                            onMouseDown={(e) => handleClipMouseDown(e, clip, 'trim-left')}
                            className="absolute left-0 top-0 bottom-0 w-2 hover:w-3 bg-white/20 hover:bg-white/70 cursor-ew-resize z-30 transition-all rounded-l-xl"
                            title="Trim Start (Drag)"
                          />

                          {/* Right Trim Handle */}
                          <div
                            onMouseDown={(e) => handleClipMouseDown(e, clip, 'trim-right')}
                            className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 bg-white/20 hover:bg-white/70 cursor-ew-resize z-30 transition-all rounded-r-xl"
                            title="Trim End (Drag)"
                          />

                          {/* In-Clip Title Label at Top-Left */}
                          <div className="px-2.5 py-0.5 text-[10px] font-bold text-white tracking-wide truncate select-none pl-3 flex items-center justify-between bg-black/30 backdrop-blur-sm border-b border-white/[0.08]">
                            <span className="drop-shadow-sm">{clip.name}</span>
                            {activeTool === 'slip' && isSelected && (
                              <span className="text-[8px] bg-amber-500/80 text-black px-1.5 py-0.2 rounded-full font-mono font-bold shadow">
                                SLIP
                              </span>
                            )}
                          </div>

                          {/* Waveform Drawing directly inside clip */}
                          <div className="flex-1 relative overflow-hidden bg-black/20">
                            <WaveformCanvas
                              sourceAsset={project.sources[clip.sourceId]}
                              sourceIn={activeIn}
                              sourceOut={activeOut}
                              color="#FFFFFF"
                              fadeIn={clip.fadeIn}
                              fadeOut={clip.fadeOut}
                              isSelected={isSelected}
                            />

                            {/* Final Cut Pro / Premiere Style Bezier Spline Keyframe Curve Overlay */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-80">
                              <path
                                d={`M 0,22 Q ${clipWidth * 0.25},10 ${clipWidth * 0.5},18 T ${clipWidth},14`}
                                fill="none"
                                stroke="rgba(255,255,255,0.85)"
                                strokeWidth="1.6"
                                className="drop-shadow-[0_0_4px_rgba(255,255,255,0.9)]"
                              />
                              <polygon
                                points={`${clipWidth * 0.25 - 3},10 ${clipWidth * 0.25},7 ${clipWidth * 0.25 + 3},10 ${clipWidth * 0.25},13`}
                                fill="#00E5FF"
                              />
                              <polygon
                                points={`${clipWidth * 0.5 - 3},18 ${clipWidth * 0.5},15 ${clipWidth * 0.5 + 3},18 ${clipWidth * 0.5},21`}
                                fill="#00E5FF"
                              />
                            </svg>

                            {/* Razor Split Tool Hover Blade Preview */}
                            {activeTool === 'split' && razorHover && razorHover.clipId === clip.id && (
                              <div
                                className="absolute top-0 bottom-0 pointer-events-none z-40"
                                style={{ left: `${razorHover.x}px` }}
                              >
                                <div className="w-0.5 h-full bg-[#FF1744] shadow-[0_0_10px_#FF1744] relative">
                                  <div className="absolute -top-4 -left-6 bg-red-600/90 backdrop-blur-md text-white font-mono text-[9px] px-1.5 py-0.5 rounded-md shadow-lg border border-white/20">
                                    ✂ {razorHover.time.toFixed(1)}s
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Empty Timeline Pristine Dropzone Banner */}
            {project.clips.length === 0 && (
              <div className="absolute inset-0 top-16 flex flex-col items-center justify-center pointer-events-none z-10">
                <div className="apple-glass-card rounded-3xl p-8 flex flex-col items-center gap-4 text-center max-w-md shadow-2xl pointer-events-auto border border-white/15 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00E5FF]/20 to-[#7000FF]/20 border border-white/20 flex items-center justify-center shadow-lg shadow-[#00E5FF]/10">
                    <FolderOpen className="w-7 h-7 text-[#00E5FF]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-wide">
                      Clean Timeline Session Ready
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Drag samples from the left Media Browser or import audio from YouTube, Spotify, or local files.
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 mt-2">
                    {onOpenURLImport && (
                      <button
                        onClick={onOpenURLImport}
                        className="apple-glass-btn-primary px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
                      >
                        <Music className="w-3.5 h-3.5" />
                        <span>Download URL</span>
                      </button>
                    )}
                    {onImportAudioFile && (
                      <button
                        onClick={onImportAudioFile}
                        className="apple-glass-btn px-3.5 py-2 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-pink-400" />
                        <span>Local Audio</span>
                      </button>
                    )}
                    {onLoadDemoProject && (
                      <button
                        onClick={onLoadDemoProject}
                        className="apple-glass-btn px-3.5 py-2 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
                      >
                        <span>Demo Studio</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Glowing Red Playhead Line */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-40 transition-transform duration-75"
              style={{ transform: `translateX(${timeToPx(currentTime)}px)` }}
            >
              <div className="w-0.5 h-full bg-[#FF1744] shadow-[0_0_10px_#FF1744] relative">
                <div className="w-3.5 h-3.5 bg-[#FF1744] rounded-full absolute -top-1.5 -left-[6px] shadow-[0_0_8px_#FF1744] border border-white/50" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
