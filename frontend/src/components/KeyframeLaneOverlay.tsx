import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AutomationPoint, KeyframeInterpolation } from '../types';

export interface KeyframeLaneOverlayProps {
  target: string;
  points: AutomationPoint[];
  duration: number;
  currentTime: number;
  minVal?: number;
  maxVal?: number;
  defaultVal?: number;
  color?: string;
  currentParamValue?: number;
  onAddPoint: (point: AutomationPoint) => void;
  onUpdatePoint: (pointId: string, updates: Partial<AutomationPoint>) => void;
  onDeletePoint: (pointId: string) => void;
  onSeek?: (time: number) => void;
}

interface DragState {
  pointId: string;
  startX: number;
  startY: number;
  originalTime: number;
  originalValue: number;
  currentTime: number;
  currentValue: number;
  isSnapped: boolean;
  constrain: 'none' | 'time' | 'value';
}

export const KeyframeLaneOverlay: React.FC<KeyframeLaneOverlayProps> = ({
  target,
  points,
  duration,
  currentTime,
  minVal = 0.0,
  maxVal = 1.5,
  defaultVal = 1.0,
  color = '#00f2ff',
  currentParamValue = 1.0,
  onAddPoint,
  onUpdatePoint,
  onDeletePoint,
  onSeek: _onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const hasJustDraggedRef = useRef<boolean>(false);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    pointId: string;
    curve: KeyframeInterpolation;
  } | null>(null);

  const totalDuration = Math.max(duration || 180, 1);

  // Derive points with live dragging position applied in real time
  const targetPoints = points
    .filter((p) => p.target === target)
    .map((p) => {
      if (dragState && p.id === dragState.pointId) {
        return {
          ...p,
          time: dragState.currentTime,
          value: dragState.currentValue,
        };
      }
      return p;
    })
    .sort((a, b) => a.time - b.time);

  // Convert time and value to pixel coordinates
  const getCoordinates = useCallback(
    (time: number, value: number, width: number, height: number) => {
      const clampedTime = Math.max(0, Math.min(totalDuration, time));
      const x = (clampedTime / totalDuration) * width;

      const normalizedVal = (Math.max(minVal, Math.min(maxVal, value)) - minVal) / (maxVal - minVal);
      // Invert Y so higher value is higher on screen
      const y = height - (normalizedVal * (height * 0.76) + height * 0.12);
      return { x, y };
    },
    [totalDuration, minVal, maxVal]
  );

  // Convert pixel coordinates to time and parameter value
  const getValuesFromCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { time: 0, value: defaultVal };
      const rect = containerRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const relX = Math.max(0, Math.min(width, clientX - rect.left));
      const rawTime = Math.max(0, Math.min(totalDuration, (relX / width) * totalDuration));

      const relY = Math.max(0, Math.min(height, clientY - rect.top));
      const normalized = 1 - (relY - height * 0.12) / (height * 0.76);
      const rawVal = minVal + normalized * (maxVal - minVal);
      const value = Math.max(minVal, Math.min(maxVal, Math.round(rawVal * 100) / 100));

      return {
        time: Math.round(rawTime * 100) / 100,
        value,
      };
    },
    [totalDuration, minVal, maxVal, defaultVal]
  );

  // Mouse Dragging Keyframe Position and Value (Pro Cut / Premiere 2D Mover)
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { time: rawTime, value: rawVal } = getValuesFromCoords(e.clientX, e.clientY);

      let targetTime = rawTime;
      let targetValue = rawVal;
      let constrain: 'none' | 'time' | 'value' = 'none';

      // Shift-key constraint (Horizontal / Vertical axis lock)
      if (e.shiftKey) {
        const deltaX = Math.abs(e.clientX - dragState.startX);
        const deltaY = Math.abs(e.clientY - dragState.startY);
        if (deltaX >= deltaY) {
          constrain = 'time';
          targetValue = dragState.originalValue; // lock value
        } else {
          constrain = 'value';
          targetTime = dragState.originalTime; // lock time
        }
      }

      // Magnetic snap to playhead within 0.5s threshold
      let isSnapped = false;
      if (constrain !== 'value' && Math.abs(targetTime - currentTime) < 0.5) {
        targetTime = Math.round(currentTime * 100) / 100;
        isSnapped = true;
      }

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              currentTime: targetTime,
              currentValue: targetValue,
              isSnapped,
              constrain,
            }
          : null
      );
    };

    const handleMouseUp = () => {
      if (dragState) {
        const hasMoved =
          dragState.currentTime !== dragState.originalTime ||
          dragState.currentValue !== dragState.originalValue;

        if (hasMoved) {
          onUpdatePoint(dragState.pointId, {
            time: dragState.currentTime,
            value: dragState.currentValue,
          });
        }

        hasJustDraggedRef.current = true;
        setTimeout(() => {
          hasJustDraggedRef.current = false;
        }, 150);
      }

      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, getValuesFromCoords, onUpdatePoint, currentTime]);

  // Keyboard Delete listener for selected keyframe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPointId) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        e.preventDefault();
        onDeletePoint(selectedPointId);
        setSelectedPointId(null);
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPointId, onDeletePoint]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleOutsideClick = () => setContextMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [contextMenu]);

  // Handle clicking empty area on lane to add new keyframe
  const handleLaneClick = (e: React.MouseEvent) => {
    if (hasJustDraggedRef.current || dragState || contextMenu) return;
    const { time, value } = getValuesFromCoords(e.clientX, e.clientY);

    const newPoint: AutomationPoint = {
      id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time,
      target,
      value,
      curve: 'bezier',
    };

    onAddPoint(newPoint);
    setSelectedPointId(newPoint.id);
  };

  // Build SVG Path string for automation rubber band
  const buildSvgPath = (width: number, height: number) => {
    if (targetPoints.length === 0) {
      const { y } = getCoordinates(0, currentParamValue, width, height);
      return `M 0 ${y} L ${width} ${y}`;
    }

    const first = targetPoints[0];
    const firstCoord = getCoordinates(first.time, first.value, width, height);

    let path = `M 0 ${firstCoord.y} L ${firstCoord.x} ${firstCoord.y}`;

    for (let i = 0; i < targetPoints.length - 1; i++) {
      const p1 = targetPoints[i];
      const p2 = targetPoints[i + 1];
      const c1 = getCoordinates(p1.time, p1.value, width, height);
      const c2 = getCoordinates(p2.time, p2.value, width, height);
      const curve = p1.curve || 'linear';

      if (curve === 'hold') {
        path += ` L ${c2.x} ${c1.y} L ${c2.x} ${c2.y}`;
      } else if (curve === 'bezier') {
        const cp1x = c1.x + (c2.x - c1.x) * 0.45;
        const cp1y = c1.y;
        const cp2x = c2.x - (c2.x - c1.x) * 0.45;
        const cp2y = c2.y;
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${c2.x} ${c2.y}`;
      } else {
        path += ` L ${c2.x} ${c2.y}`;
      }
    }

    const last = targetPoints[targetPoints.length - 1];
    const lastCoord = getCoordinates(last.time, last.value, width, height);
    path += ` L ${width} ${lastCoord.y}`;

    return path;
  };

  const rect = containerRef.current?.getBoundingClientRect();
  const width = rect?.width || 800;
  const height = rect?.height || 72;
  const pathD = buildSvgPath(width, height);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms < 10 ? '0' : ''}${ms}`;
  };

  const activeDraggedPoint = dragState
    ? targetPoints.find((p) => p.id === dragState.pointId)
    : null;
  const activeDragCoords =
    dragState && activeDraggedPoint
      ? getCoordinates(dragState.currentTime, dragState.currentValue, width, height)
      : null;

  return (
    <div
      ref={containerRef}
      onClick={handleLaneClick}
      className={`absolute inset-0 w-full h-full z-20 select-none ${
        dragState ? 'cursor-grabbing' : 'cursor-crosshair'
      }`}
      title="Adobe Keyframe Automation Lane: Click empty space to add keyframe. Drag existing diamonds to move time/value. Shift+Drag to constrain axis."
    >
      <svg className="w-full h-full overflow-visible pointer-events-none">
        <defs>
          <linearGradient id={`grad-${target.replace('.', '_')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
          <filter id="kf-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Shaded area under the curve */}
        {targetPoints.length > 0 && (
          <path
            d={`${pathD} L ${width} ${height} L 0 ${height} Z`}
            fill={`url(#grad-${target.replace('.', '_')})`}
          />
        )}

        {/* Automation Rubber Band Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={targetPoints.length > 0 ? '2.5' : '1.5'}
          strokeDasharray={targetPoints.length > 0 ? undefined : '4 4'}
          filter="url(#kf-glow)"
          opacity={targetPoints.length > 0 ? 0.95 : 0.45}
        />

        {/* Pro Cut Live Dragging Crosshair Guides */}
        {dragState && activeDragCoords && (
          <>
            {/* Vertical Time Guide Line */}
            <line
              x1={activeDragCoords.x}
              y1={0}
              x2={activeDragCoords.x}
              y2={height}
              stroke={dragState.isSnapped ? '#00f2ff' : '#ffffff'}
              strokeWidth={dragState.isSnapped ? '2' : '1'}
              strokeDasharray={dragState.isSnapped ? undefined : '3 3'}
              opacity={0.8}
            />
            {/* Horizontal Value Guide Line */}
            <line
              x1={0}
              y1={activeDragCoords.y}
              x2={width}
              y2={activeDragCoords.y}
              stroke="#00f2ff"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity={0.6}
            />
          </>
        )}
      </svg>

      {/* Interactive Adobe Diamonds (Rotated Squares ◆) */}
      {targetPoints.map((pt) => {
        const { x, y } = getCoordinates(pt.time, pt.value, width, height);
        const isSelected = selectedPointId === pt.id;
        const isHovered = hoveredPointId === pt.id;
        const isDragging = dragState?.pointId === pt.id;
        const curve = pt.curve || 'linear';

        return (
          <div
            key={pt.id}
            onClick={(e) => {
              // Crucial: stop propagation so clicking an existing key NEVER creates a new keyframe!
              e.stopPropagation();
              setSelectedPointId(pt.id);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setSelectedPointId(pt.id);
              setDragState({
                pointId: pt.id,
                startX: e.clientX,
                startY: e.clientY,
                originalTime: pt.time,
                originalValue: pt.value,
                currentTime: pt.time,
                currentValue: pt.value,
                isSnapped: false,
                constrain: 'none',
              });
            }}
            onMouseEnter={() => setHoveredPointId(pt.id)}
            onMouseLeave={() => setHoveredPointId(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedPointId(pt.id);
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                pointId: pt.id,
                curve,
              });
            }}
            style={{
              left: `${x}px`,
              top: `${y}px`,
            }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing group/kf pointer-events-auto transition-transform ${
              isDragging ? 'scale-125 z-40' : isSelected ? 'scale-115 z-30' : 'hover:scale-110 z-25'
            }`}
            title="Drag to move time & value (Hold Shift to lock axis). Right-click for easing menu. Del to remove."
          >
            {/* Adobe Keyframe Diamond Node */}
            <div
              className={`w-3.5 h-3.5 rotate-45 flex items-center justify-center transition-all ${
                isSelected || isDragging
                  ? 'bg-white border-2 border-cyan-400 shadow-[0_0_12px_#00f2ff]'
                  : isHovered
                  ? 'bg-cyan-300 border-2 border-white shadow-[0_0_8px_#00f2ff]'
                  : 'bg-[#100f24] border-2 border-cyan-400 shadow-[0_0_6px_rgba(0,242,255,0.7)]'
              }`}
            >
              {/* Inner dot reflecting curve type */}
              {curve === 'bezier' && (
                <div className={`w-1 h-1 rounded-full ${isSelected || isDragging ? 'bg-cyan-600' : 'bg-cyan-300'}`} />
              )}
              {curve === 'hold' && (
                <div className={`w-1 h-1 ${isSelected || isDragging ? 'bg-purple-700' : 'bg-purple-400'}`} />
              )}
            </div>

            {/* Pro Cut Dragging / Hovering HUD Tooltip Badge */}
            {(isHovered || isDragging || isSelected) && (
              <div className="absolute left-1/2 -top-9 -translate-x-1/2 bg-[#080718]/95 border border-cyan-500/70 text-white text-[9px] font-mono px-2 py-0.5 rounded shadow-2xl whitespace-nowrap pointer-events-none flex items-center space-x-1.5 backdrop-blur-md z-50">
                {isDragging ? (
                  <>
                    <span className="text-amber-300 font-bold">✛ MOVE</span>
                    <span className="text-zinc-500">|</span>
                    <span className="text-cyan-300 font-bold">{formatTime(pt.time)}</span>
                    {dragState && (
                      <span className="text-[8px] text-zinc-400">
                        ({(dragState.currentTime - dragState.originalTime) >= 0 ? '+' : ''}
                        {(dragState.currentTime - dragState.originalTime).toFixed(2)}s)
                      </span>
                    )}
                    <span className="text-zinc-500">|</span>
                    <span className="text-pink-300 font-bold">{Math.round(pt.value * 100)}%</span>
                    {dragState?.isSnapped && (
                      <span className="px-1 py-0.2 rounded bg-cyan-500 text-black text-[7.5px] font-extrabold">
                        SNAP
                      </span>
                    )}
                    {dragState?.constrain !== 'none' && (
                      <span className="px-1 py-0.2 rounded bg-amber-500/30 text-amber-300 border border-amber-500/50 text-[7.5px] font-bold">
                        {dragState?.constrain === 'time' ? 'TIME LOCK' : 'VAL LOCK'}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-cyan-400 font-bold">◆ {formatTime(pt.time)}</span>
                    <span className="text-zinc-500">|</span>
                    <span className="text-pink-300 font-bold">{Math.round(pt.value * 100)}%</span>
                    <span className="text-zinc-500">|</span>
                    <span className="text-emerald-300 uppercase text-[8px]">{curve}</span>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Adobe Right-Click Context Menu for Keyframe Easing & Deletion */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          className="z-50 bg-[#0c0a1e] border border-cyan-500/40 rounded-lg shadow-2xl p-1.5 flex flex-col space-y-1 min-w-[140px] text-xs font-mono backdrop-blur-lg"
        >
          <div className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold px-2 py-0.5 border-b border-white/[0.08]">
            Keyframe Easing
          </div>

          <button
            onClick={() => {
              onUpdatePoint(contextMenu.pointId, { curve: 'bezier' });
              setContextMenu(null);
            }}
            className={`flex items-center space-x-2 px-2 py-1 rounded text-left transition-all ${
              contextMenu.curve === 'bezier'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                : 'hover:bg-white/[0.06] text-zinc-300'
            }`}
          >
            <span>∿</span>
            <span>Bezier (Smooth)</span>
          </button>

          <button
            onClick={() => {
              onUpdatePoint(contextMenu.pointId, { curve: 'linear' });
              setContextMenu(null);
            }}
            className={`flex items-center space-x-2 px-2 py-1 rounded text-left transition-all ${
              contextMenu.curve === 'linear'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                : 'hover:bg-white/[0.06] text-zinc-300'
            }`}
          >
            <span>⟋</span>
            <span>Linear (Ramp)</span>
          </button>

          <button
            onClick={() => {
              onUpdatePoint(contextMenu.pointId, { curve: 'hold' });
              setContextMenu(null);
            }}
            className={`flex items-center space-x-2 px-2 py-1 rounded text-left transition-all ${
              contextMenu.curve === 'hold'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                : 'hover:bg-white/[0.06] text-zinc-300'
            }`}
          >
            <span>⎍</span>
            <span>Hold (Step)</span>
          </button>

          <div className="border-t border-white/[0.08] my-0.5" />

          <button
            onClick={() => {
              onDeletePoint(contextMenu.pointId);
              setContextMenu(null);
              setSelectedPointId(null);
            }}
            className="flex items-center space-x-2 px-2 py-1 rounded text-left text-red-400 hover:bg-red-500/20 transition-all font-bold"
          >
            <span>✕</span>
            <span>Delete Keyframe</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default KeyframeLaneOverlay;
