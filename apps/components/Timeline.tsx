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
    <section className="flex-1 flex flex-col bg-[#090A0E] overflow-hidden select-none relative">
      {/* 1. Timeline Top Ribbon (Video-Editing Tools & Zoom) */}
      <div className="h-8 bg-[#12141C] border-b border-white/[0.08] flex items-center justify-between px-3 shrink-0 z-30">
        {/* Premiere / Final Cut Pro Editing Tools */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTool('select')}
            className={`p-1 rounded transition-colors ${
              activeTool === 'select' ? 'bg-[#00E5FF]/20 text-[#00E5FF] font-bold shadow-[0_0_6px_#00E5FF]' : 'text-slate-400 hover:text-white'
            }`}
            title="Selection / Pointer Tool (V)"
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('split')}
            className={`p-1 rounded transition-colors ${
              activeTool === 'split' ? 'bg-[#FF1744]/20 text-[#FF1744] font-bold shadow-[0_0_6px_#FF1744]' : 'text-slate-400 hover:text-white'
            }`}
            title="Razor Cut Tool (C) - Click any clip to slice audio"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('slip')}
            className={`p-1 rounded transition-colors ${
              activeTool === 'slip' ? 'bg-amber-400/20 text-amber-400 font-bold shadow-[0_0_6px_#FBBF24]' : 'text-slate-400 hover:text-white'
            }`}
            title="Slip Tool (Y) - Drag to slip audio inside clip"
          >
            <MoveHorizontal className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('curve')}
            className={`p-1 rounded transition-colors ${
              activeTool === 'curve' ? 'bg-purple-400/20 text-purple-400 font-bold shadow-[0_0_6px_#C084FC]' : 'text-slate-400 hover:text-white'
            }`}
            title="Keyframe Bezier Curve Editor Tool (P)"
          >
            <Spline className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('draw')}
            className={`p-1 rounded transition-colors ${
              activeTool === 'draw' ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'text-slate-400 hover:text-white'
            }`}
            title="Pencil / Automation Draw (B)"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('range')}
            className={`p-1 rounded transition-colors ${
              activeTool === 'range' ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'text-slate-400 hover:text-white'
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
            className="flex items-center space-x-1 text-slate-300 bg-[#1A1D27] hover:bg-[#232736] border border-white/[0.08] px-2 py-0.5 rounded cursor-pointer transition-colors"
          >
            <span className="text-[11px] text-slate-400">Snap:</span>
            <span className="text-[11px] font-semibold text-slate-200">{snapGrid}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </div>

          {/* Snap Grid Menu */}
          {isSnapMenuOpen && (
            <div className="absolute right-24 top-7 w-28 bg-[#1A1D27] border border-white/10 rounded-lg shadow-2xl py-1 z-50">
              {(['1/16', '1/8', '1/4', '1 Bar', 'Off'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setSnapGrid(opt);
                    setIsSnapMenuOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1 text-xs hover:bg-[#00E5FF]/20 flex items-center justify-between ${
                    snapGrid === opt ? 'text-[#00E5FF] font-bold' : 'text-slate-300'
                  }`}
                >
                  <span>{opt}</span>
                  {snapGrid === opt && <span>✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* Zoom Buttons */}
          <div className="flex items-center bg-[#1A1D27] border border-white/[0.08] rounded p-0.5">
            <button
              onClick={() => setZoomScale((prev) => Math.max(0.5, prev - 0.25))}
              className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-300 px-1">{Math.round(zoomScale * 100)}%</span>
            <button
              onClick={() => setZoomScale((prev) => Math.min(2.5, prev + 0.25))}
              className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
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
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Timeline: Left Track Headers + Right Scrollable Clips */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Track Headers (Fixed Column) */}
        <div className="w-48 bg-[#12141C] border-r border-white/[0.08] shrink-0 flex flex-col pt-7 z-20 shadow-xl overflow-y-auto">
          {project.tracks.map((track, idx) => {
            const Icon = getTrackIcon(track.stemType, idx);

            return (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track)}
                className="h-16 border-b border-white/[0.06] px-2.5 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-2 overflow-hidden">
                  <span className="text-xs font-mono text-slate-400 w-3">{idx + 1}</span>

                  {/* Colored Icon Circle */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-md"
                    style={{ backgroundColor: `${track.color}25`, border: `1px solid ${track.color}80` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: track.color }} />
                  </div>

                  <div className="overflow-hidden">
                    <span className="text-xs font-semibold text-slate-200 truncate block">
                      {track.name}
                    </span>
                    {/* M, S, Record Controls */}
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTrackMute(track.id);
                        }}
                        className={`text-[9px] font-mono font-bold px-1 rounded ${
                          track.isMuted ? 'bg-red-500 text-white font-black' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        M
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTrackSolo(track.id);
                        }}
                        className={`text-[9px] font-mono font-bold px-1 rounded ${
                          track.isSoloed ? 'bg-amber-400 text-black font-black' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        S
                      </button>
                      <div className="w-2 h-2 rounded-full bg-red-500/80 shadow-[0_0_4px_#EF4444]" />
                    </div>
                  </div>
                </div>

                {/* Track mini level meter */}
                <div className="w-1.5 h-8 bg-black/40 rounded overflow-hidden p-0.5 border border-white/[0.06] flex flex-col justify-end">
                  <div
                    className="w-full bg-emerald-400 rounded-sm transition-all duration-75"
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
              className="m-2 py-2 border border-dashed border-white/20 hover:border-[#00E5FF] hover:bg-[#00E5FF]/10 text-slate-400 hover:text-[#00E5FF] rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Audio Track</span>
            </button>
          )}
        </div>

        {/* Right Scrollable Timeline Canvas */}
        <div
          ref={scrollContainerRef}
          className={`flex-1 overflow-x-auto overflow-y-auto relative bg-[#08090D] ${
            activeTool === 'split' ? 'cursor-crosshair' : activeTool === 'slip' ? 'cursor-ew-resize' : 'cursor-default'
          }`}
        >
          <div className="relative min-h-full" style={{ width: `${timelineWidth}px` }}>
            {/* Top Time Ruler */}
            <div
              onMouseDown={handleRulerMouseDown}
              className="h-7 border-b border-white/[0.08] bg-[#0E0F14] sticky top-0 z-30 cursor-pointer flex items-center select-none shadow-sm"
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
                          className={`absolute top-1 bottom-1 rounded-md overflow-hidden flex flex-col border shadow-lg transition-all ${
                            isSelected
                              ? 'ring-2 ring-white border-white z-20'
                              : 'border-white/10 hover:border-white/30'
                          }`}
                          style={{
                            left: `${clipLeft}px`,
                            width: `${Math.max(30, clipWidth)}px`,
                            backgroundColor: track.color,
                          }}
                        >
                          {/* Left Trim Handle */}
                          <div
                            onMouseDown={(e) => handleClipMouseDown(e, clip, 'trim-left')}
                            className="absolute left-0 top-0 bottom-0 w-2 hover:w-3 bg-white/20 hover:bg-white/60 cursor-ew-resize z-30 transition-all"
                            title="Trim Start (Drag)"
                          />

                          {/* Right Trim Handle */}
                          <div
                            onMouseDown={(e) => handleClipMouseDown(e, clip, 'trim-right')}
                            className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 bg-white/20 hover:bg-white/60 cursor-ew-resize z-30 transition-all"
                            title="Trim End (Drag)"
                          />

                          {/* In-Clip Title Label at Top-Left */}
                          <div className="px-2 py-0.5 text-[10px] font-bold text-black/80 truncate select-none pl-3 flex items-center justify-between">
                            <span>{clip.name}</span>
                            {activeTool === 'slip' && isSelected && (
                              <span className="text-[8px] bg-black/60 text-amber-300 px-1 rounded font-mono">
                                SLIP MODE
                              </span>
                            )}
                          </div>

                          {/* Waveform Drawing directly inside clip */}
                          <div className="flex-1 relative overflow-hidden bg-black/20">
                            <WaveformCanvas
                              sourceAsset={project.sources[clip.sourceId]}
                              sourceIn={activeIn}
                              sourceOut={activeOut}
                              color="#0D0E13"
                              fadeIn={clip.fadeIn}
                              fadeOut={clip.fadeOut}
                              isSelected={isSelected}
                            />

                            {/* Final Cut Pro / Premiere Style Bezier Spline Keyframe Curve Overlay */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                              <path
                                d={`M 0,22 Q ${clipWidth * 0.25},10 ${clipWidth * 0.5},18 T ${clipWidth},14`}
                                fill="none"
                                stroke="rgba(255,255,255,0.9)"
                                strokeWidth="1.6"
                                className="drop-shadow-[0_0_3px_rgba(255,255,255,0.8)]"
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
                                <div className="w-0.5 h-full bg-[#FF1744] shadow-[0_0_8px_#FF1744] relative">
                                  <div className="absolute -top-4 -left-6 bg-red-600 text-white font-mono text-[9px] px-1 py-0.2 rounded shadow">
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
                <div className="bg-[#12141F]/90 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-3 text-center max-w-md shadow-2xl backdrop-blur-sm pointer-events-auto">
                  <div className="w-12 h-12 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/30 flex items-center justify-center">
                    <FolderOpen className="w-6 h-6 text-[#00E5FF]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Clean Timeline Session Ready
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Drag samples from the left Media Browser or import audio from YouTube, Spotify, or local files.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {onOpenURLImport && (
                      <button
                        onClick={onOpenURLImport}
                        className="px-3 py-1.5 bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 border border-[#00E5FF]/50 rounded-lg text-xs font-bold text-[#00E5FF] flex items-center gap-1.5 transition-colors"
                      >
                        <Music className="w-3.5 h-3.5" />
                        <span>Download URL</span>
                      </button>
                    )}
                    {onImportAudioFile && (
                      <button
                        onClick={onImportAudioFile}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-pink-400" />
                        <span>Local Audio</span>
                      </button>
                    )}
                    {onLoadDemoProject && (
                      <button
                        onClick={onLoadDemoProject}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
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
              <div className="w-0.5 h-full bg-[#FF1744] shadow-[0_0_8px_#FF1744] relative">
                <div className="w-3 h-3 bg-[#FF1744] rounded-full absolute -top-1.5 -left-[5px] shadow-[0_0_6px_#FF1744]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
