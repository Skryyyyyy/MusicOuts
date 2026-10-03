import React, { useState, memo } from 'react';
import { Project, Clip, Track, KeyframeLane, KeyframePoint, CurveType } from '../../core/project-model/types';
import { evaluateKeyframe } from '../../core/dsp/keyframes';
import {
  FileAudio,
  Power,
  ChevronRight,
  ChevronDown,
  Sliders,
  RotateCcw,
  Minimize2,
} from 'lucide-react';

interface InspectorProps {
  project: Project;
  selectedClip: Clip | null;
  selectedTrack?: Track | null;
  currentTime?: number;
  onSeek?: (time: number) => void;
  onUpdateClip: (clip: Clip) => void;
  onUpdateTrack?: (track: Track) => void;
  onToggleCollapse?: () => void;
}

const InspectorComponent: React.FC<InspectorProps> = ({
  project,
  selectedClip,
  selectedTrack,
  currentTime = 0,
  onSeek,
  onUpdateClip,
  onUpdateTrack,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'Clip' | 'Track' | 'Effects' | 'Master'>('Clip');
  const [expandedFx, setExpandedFx] = useState<string[]>(['Transform', 'Equalizer', 'Reverb']);
  
  // Track which parameters have their mini curve graphs twirled open
  const [twirledOpenLanes, setTwirledOpenLanes] = useState<Record<string, boolean>>({
    volume: false,
    pan: false,
    eq_mid: false,
  });

  // Track active curve type preset for new keyframes
  const [activeCurveType, setActiveCurveType] = useState<CurveType>('bezier');

  const activeClip = selectedClip || project.clips[0] || null;
  const activeTrack = selectedTrack || project.tracks.find((t) => t.id === activeClip?.trackId) || project.tracks[0] || null;

  const toggleFxAccordion = (fxName: string) => {
    setExpandedFx((prev) =>
      prev.includes(fxName) ? prev.filter((f) => f !== fxName) : [...prev, fxName]
    );
  };

  const toggleTwirlLane = (paramKey: string) => {
    setTwirledOpenLanes((prev) => ({ ...prev, [paramKey]: !prev[paramKey] }));
  };

  const formatSecToTc = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const frames = Math.floor((sec % 1) * 30);
    return `00:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  // Helper: Find or create KeyframeLane on Clip or Track
  const getLane = (
    target: 'clip' | 'track',
    parameter: KeyframeLane['parameter'],
    displayName: string,
    color: string,
    defaultValue: number,
    minValue: number,
    maxValue: number,
    unit: string
  ): KeyframeLane => {
    const lanes = target === 'clip' ? (activeClip?.automationLanes || []) : (activeTrack?.automationLanes || []);
    const existing = lanes.find((l) => l.parameter === parameter);
    if (existing) return existing;
    return {
      id: `${target}-${parameter}-lane`,
      parameter,
      displayName,
      color,
      defaultValue,
      minValue,
      maxValue,
      unit,
      points: [],
    };
  };

  // Check if a lane is armed (has keyframing active / has points or is actively tracking)
  const isLaneArmed = (lane: KeyframeLane) => {
    return lane.points.length > 0;
  };

  // Find nearest keyframe at playhead (within threshold)
  const findKeyframeAtPlayhead = (lane: KeyframeLane, threshold = 0.1): KeyframePoint | null => {
    return lane.points.find((p) => Math.abs(p.time - currentTime) <= threshold) || null;
  };

  // Jump to previous keyframe
  const jumpPrevKeyframe = (lane: KeyframeLane) => {
    if (!onSeek || lane.points.length === 0) return;
    const prevPoints = lane.points.filter((p) => p.time < currentTime - 0.05).sort((a, b) => b.time - a.time);
    if (prevPoints.length > 0) {
      onSeek(prevPoints[0].time);
    }
  };

  // Jump to next keyframe
  const jumpNextKeyframe = (lane: KeyframeLane) => {
    if (!onSeek || lane.points.length === 0) return;
    const nextPoints = lane.points.filter((p) => p.time > currentTime + 0.05).sort((a, b) => a.time - b.time);
    if (nextPoints.length > 0) {
      onSeek(nextPoints[0].time);
    }
  };

  // Toggle Keyframe Diamond at playhead (Add if absent, Remove if present)
  const toggleKeyframeAtPlayhead = (
    target: 'clip' | 'track',
    lane: KeyframeLane,
    currentVal: number
  ) => {
    const existingAtPlayhead = findKeyframeAtPlayhead(lane);
    let updatedPoints: KeyframePoint[];

    if (existingAtPlayhead) {
      // Remove keyframe
      updatedPoints = lane.points.filter((p) => p.id !== existingAtPlayhead.id);
    } else {
      // Add keyframe at playhead
      const newPoint: KeyframePoint = {
        id: `kf-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        time: currentTime,
        value: currentVal,
        curve: activeCurveType,
      };
      updatedPoints = [...lane.points, newPoint].sort((a, b) => a.time - b.time);
    }

    const updatedLane: KeyframeLane = { ...lane, points: updatedPoints };
    saveLane(target, updatedLane);
  };

  // Arm/Disarm Stopwatch
  const toggleStopwatch = (
    target: 'clip' | 'track',
    lane: KeyframeLane,
    currentVal: number
  ) => {
    if (lane.points.length > 0) {
      // Disarm & clear keyframes with standard confirmation
      const confirmClear = window.confirm(
        `Clear all keyframes for "${lane.displayName}"? This will disable parameter animation.`
      );
      if (confirmClear) {
        saveLane(target, { ...lane, points: [] });
      }
    } else {
      // Arm stopwatch: create initial keyframe at current playhead
      const initialPoint: KeyframePoint = {
        id: `kf-${Date.now()}`,
        time: currentTime,
        value: currentVal,
        curve: activeCurveType,
      };
      saveLane(target, { ...lane, points: [initialPoint] });
      // Automatically twirl open to see curve
      setTwirledOpenLanes((prev) => ({ ...prev, [lane.parameter]: true }));
    }
  };

  // Update or insert keyframe when slider moves (if armed)
  const handleValueChangeWithKeyframe = (
    target: 'clip' | 'track',
    lane: KeyframeLane,
    newVal: number,
    fallbackUpdate: () => void
  ) => {
    if (lane.points.length > 0) {
      // Lane is armed: update or create keyframe at currentTime
      const existingAtPlayhead = findKeyframeAtPlayhead(lane, 0.15);
      let updatedPoints: KeyframePoint[];
      if (existingAtPlayhead) {
        updatedPoints = lane.points.map((p) =>
          p.id === existingAtPlayhead.id ? { ...p, value: newVal } : p
        );
      } else {
        const newPoint: KeyframePoint = {
          id: `kf-${Date.now()}`,
          time: currentTime,
          value: newVal,
          curve: activeCurveType,
        };
        updatedPoints = [...lane.points, newPoint].sort((a, b) => a.time - b.time);
      }
      saveLane(target, { ...lane, points: updatedPoints });
    }
    fallbackUpdate();
  };

  // Save lane back into Clip or Track
  const saveLane = (target: 'clip' | 'track', updatedLane: KeyframeLane) => {
    if (target === 'clip' && activeClip) {
      const existingLanes = activeClip.automationLanes || [];
      const index = existingLanes.findIndex((l) => l.parameter === updatedLane.parameter);
      const newLanes = index >= 0
        ? existingLanes.map((l, idx) => (idx === index ? updatedLane : l))
        : [...existingLanes, updatedLane];
      onUpdateClip({ ...activeClip, automationLanes: newLanes });
    } else if (target === 'track' && activeTrack && onUpdateTrack) {
      const existingLanes = activeTrack.automationLanes || [];
      const index = existingLanes.findIndex((l) => l.parameter === updatedLane.parameter);
      const newLanes = index >= 0
        ? existingLanes.map((l, idx) => (idx === index ? updatedLane : l))
        : [...existingLanes, updatedLane];
      onUpdateTrack({ ...activeTrack, automationLanes: newLanes });
    }
  };

  // Render Premiere Pro Style Parameter Control Row with Stopwatch & Mini Curve Graph
  const renderPremiereControlRow = (opts: {
    target: 'clip' | 'track';
    paramKey: KeyframeLane['parameter'];
    label: string;
    unitLabel: string;
    value: number;
    defaultValue: number;
    min: number;
    max: number;
    step: number;
    color: string;
    formatValue: (v: number) => string;
    onDirectChange: (val: number) => void;
  }) => {
    const lane = getLane(
      opts.target,
      opts.paramKey,
      opts.label,
      opts.color,
      opts.defaultValue,
      opts.min,
      opts.max,
      opts.unitLabel
    );

    const isArmed = isLaneArmed(lane);
    const kfAtPlayhead = findKeyframeAtPlayhead(lane);
    const hasPrev = lane.points.some((p) => p.time < currentTime - 0.05);
    const hasNext = lane.points.some((p) => p.time > currentTime + 0.05);
    const isTwirled = !!twirledOpenLanes[opts.paramKey];

    // Compute live evaluated value if keyframes exist
    const evaluatedVal = isArmed ? evaluateKeyframe(lane, currentTime) : opts.value;

    return (
      <div className="apple-glass-card rounded-2xl p-3 space-y-2.5 transition-all">
        {/* Top Control Bar: Twirl, Label, Stopwatch, ◄ ◇ ►, Reset, Value */}
        <div className="flex items-center justify-between text-xs">
          {/* Twirl Arrow + Property Label */}
          <div className="flex items-center space-x-1.5 overflow-hidden">
            <button
              onClick={() => toggleTwirlLane(opts.paramKey)}
              className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Toggle Keyframe Curve Graph"
            >
              {isTwirled ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#00E5FF]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            <span className="font-semibold text-slate-100 truncate">{opts.label}</span>
          </div>

          {/* Premiere Pro Keyframe Navigation Strip */}
          <div className="flex items-center space-x-1 shrink-0 apple-glass-capsule px-1.5 py-0.5">
            {/* Stopwatch Toggle Icon (⏱) */}
            <button
              onClick={() => toggleStopwatch(opts.target, lane, opts.value)}
              className={`p-1 rounded-md transition-all flex items-center justify-center ${
                isArmed
                  ? 'bg-[#00E5FF]/25 text-[#00E5FF] border border-[#00E5FF]/60 shadow-[0_0_8px_rgba(0,229,255,0.4)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
              title={isArmed ? 'Keyframing Active (Click to Disarm)' : 'Toggle Animation (Stopwatch)'}
            >
              <span className="text-xs font-serif leading-none">⏱</span>
            </button>

            {/* Previous Keyframe ◄ */}
            <button
              onClick={() => jumpPrevKeyframe(lane)}
              disabled={!hasPrev}
              className={`px-1 py-0.5 rounded text-[10px] font-mono transition-colors ${
                hasPrev ? 'text-slate-200 hover:text-[#00E5FF] hover:bg-white/10' : 'text-slate-600 opacity-40 cursor-not-allowed'
              }`}
              title="Previous Keyframe (◄)"
            >
              ◄
            </button>

            {/* Add / Remove Keyframe Diamond (◇ / ◆) */}
            <button
              onClick={() => toggleKeyframeAtPlayhead(opts.target, lane, opts.value)}
              className={`px-1 py-0.5 rounded text-xs transition-all ${
                kfAtPlayhead
                  ? 'text-[#00E5FF] font-bold shadow-[0_0_8px_rgba(0,229,255,0.6)]'
                  : isArmed
                  ? 'text-slate-300 hover:text-[#00E5FF]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title={kfAtPlayhead ? 'Remove Keyframe at Playhead (◆)' : 'Add Keyframe at Playhead (◇)'}
            >
              {kfAtPlayhead ? '◆' : '◇'}
            </button>

            {/* Next Keyframe ► */}
            <button
              onClick={() => jumpNextKeyframe(lane)}
              disabled={!hasNext}
              className={`px-1 py-0.5 rounded text-[10px] font-mono transition-colors ${
                hasNext ? 'text-slate-200 hover:text-[#00E5FF] hover:bg-white/10' : 'text-slate-600 opacity-40 cursor-not-allowed'
              }`}
              title="Next Keyframe (►)"
            >
              ►
            </button>

            {/* Reset ↺ */}
            <button
              onClick={() => {
                opts.onDirectChange(opts.defaultValue);
                if (isArmed) {
                  handleValueChangeWithKeyframe(opts.target, lane, opts.defaultValue, () => {});
                }
              }}
              className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors ml-0.5"
              title="Reset to default value"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>

            {/* Value Display */}
            <span className="font-mono text-white text-[11px] min-w-[50px] text-right ml-1 font-semibold">
              {opts.formatValue(evaluatedVal)}
            </span>
          </div>
        </div>

        {/* Live Slider Control */}
        <div className="flex items-center space-x-2 pt-1">
          <input
            type="range"
            min={opts.min}
            max={opts.max}
            step={opts.step}
            value={evaluatedVal}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              handleValueChangeWithKeyframe(opts.target, lane, val, () => opts.onDirectChange(val));
            }}
            className="w-full h-1.5 bg-black/60 rounded-full cursor-pointer transition-all border border-white/[0.05]"
            style={{ accentColor: opts.color }}
          />
        </div>

        {/* Twirl-Down Mini Keyframe Curve Graph Timeline */}
        {isTwirled && (
          <div className="mt-2.5 bg-black/40 border border-white/[0.08] rounded-xl p-2.5 space-y-2 animate-in fade-in duration-150 backdrop-blur-sm">
            {/* Graph Header: Interpolation Presets & Keyframe Count */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-white/[0.06] pb-1.5">
              <div className="flex items-center space-x-1">
                <span className="text-slate-400">Curve:</span>
                {(['bezier', 'linear', 'ease', 'hold'] as const).map((curve) => (
                  <button
                    key={curve}
                    onClick={() => {
                      setActiveCurveType(curve);
                      // If keyframe at playhead, update its curve
                      if (kfAtPlayhead) {
                        const updated = lane.points.map((p) =>
                          p.id === kfAtPlayhead.id ? { ...p, curve } : p
                        );
                        saveLane(opts.target, { ...lane, points: updated });
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded capitalize font-medium transition-colors ${
                      (kfAtPlayhead?.curve || activeCurveType) === curve
                        ? 'bg-[#00E5FF]/20 text-[#00E5FF] font-bold border border-[#00E5FF]/40'
                        : 'hover:bg-white/5 text-slate-400'
                    }`}
                  >
                    {curve}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[9px] text-[#00E5FF]">
                {lane.points.length} {lane.points.length === 1 ? 'keyframe' : 'keyframes'}
              </span>
            </div>

            {/* Interactive SVG Curve Canvas */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                
                // Map click X to time (0 to 60s span)
                const clickTime = Math.max(0, (clickX / rect.width) * 60);
                // Map click Y to value
                const normalizedY = 1 - (clickY / rect.height);
                const clickVal = opts.min + normalizedY * (opts.max - opts.min);

                const newPoint: KeyframePoint = {
                  id: `kf-${Date.now()}`,
                  time: clickTime,
                  value: clickVal,
                  curve: activeCurveType,
                };

                const updatedPoints = [...lane.points, newPoint].sort((a, b) => a.time - b.time);
                saveLane(opts.target, { ...lane, points: updatedPoints });
              }}
              className="h-20 w-full relative bg-[#090A0E] rounded border border-white/[0.04] cursor-crosshair overflow-hidden select-none"
            >
              {/* Horizontal Grid & Zero Line */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="border-b border-white/20 w-full" />
                <div className="border-b border-dashed border-white/40 w-full" />
                <div className="border-b border-white/20 w-full" />
              </div>

              {/* Vertical Time Ticks */}
              <div className="absolute inset-0 flex justify-between pointer-events-none opacity-10">
                {[0, 10, 20, 30, 40, 50, 60].map((t) => (
                  <div key={t} className="h-full border-r border-white/30" />
                ))}
              </div>

              {/* Render Spline Curve */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {lane.points.length >= 2 && (
                  <path
                    d={(() => {
                      const totalTime = 60;
                      const sorted = [...lane.points].sort((a, b) => a.time - b.time);
                      let pathD = '';

                      for (let i = 0; i < sorted.length; i++) {
                        const pt = sorted[i];
                        const x = (pt.time / totalTime) * 100;
                        const y = (1 - (pt.value - opts.min) / (opts.max - opts.min)) * 100;

                        if (i === 0) {
                          pathD += `M ${x}% ${y}%`;
                        } else {
                          const prev = sorted[i - 1];
                          const prevX = (prev.time / totalTime) * 100;
                          const prevY = (1 - (prev.value - opts.min) / (opts.max - opts.min)) * 100;

                          if (prev.curve === 'hold') {
                            pathD += ` L ${x}% ${prevY}% L ${x}% ${y}%`;
                          } else if (prev.curve === 'linear') {
                            pathD += ` L ${x}% ${y}%`;
                          } else {
                            // Smooth Bezier
                            const cpX1 = prevX + (x - prevX) * 0.4;
                            const cpX2 = prevX + (x - prevX) * 0.6;
                            pathD += ` C ${cpX1}% ${prevY}%, ${cpX2}% ${y}%, ${x}% ${y}%`;
                          }
                        }
                      }
                      return pathD;
                    })()}
                    fill="none"
                    stroke={opts.color}
                    strokeWidth="2"
                    className="drop-shadow-[0_0_4px_rgba(0,229,255,0.6)]"
                  />
                )}

                {/* Keyframe Diamond Markers (◆) */}
                {lane.points.map((pt) => {
                  const xPercent = (pt.time / 60) * 100;
                  const yPercent = (1 - (pt.value - opts.min) / (opts.max - opts.min)) * 100;
                  const isCurrent = Math.abs(pt.time - currentTime) <= 0.1;

                  return (
                    <g
                      key={pt.id}
                      className="pointer-events-auto cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSeek) onSeek(pt.time);
                      }}
                    >
                      <polygon
                        points={`${xPercent - 1.5},${yPercent} ${xPercent},${yPercent - 3} ${xPercent + 1.5},${yPercent} ${xPercent},${yPercent + 3}`}
                        fill={isCurrent ? '#00E5FF' : '#FFFFFF'}
                        stroke={opts.color}
                        strokeWidth="1.5"
                        className="hover:scale-125 transition-transform"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Red Playhead Indicator Line */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-20"
                style={{ left: `${Math.max(0, Math.min(100, (currentTime / 60) * 100))}%` }}
              >
                <div className="w-0.5 h-full bg-[#FF1744] shadow-[0_0_6px_#FF1744] relative">
                  <div className="w-2 h-2 bg-[#FF1744] rotate-45 absolute -top-1 -left-[3px]" />
                </div>
              </div>
            </div>

            {/* Time Span Footer */}
            <div className="flex justify-between text-[8px] font-mono text-slate-400">
              <span>0:00</span>
              <span>0:15</span>
              <span>0:30</span>
              <span>0:45</span>
              <span>1:00</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-64 lg:w-72 bg-[#0C0E16]/80 backdrop-blur-2xl border-l border-white/[0.08] flex flex-col h-full select-none shrink-0 overflow-y-auto relative z-20">
      {/* Top Header & Tabs (Clip, Track, Effects, Master) */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-3 pt-2.5 shrink-0 bg-[#0E1019]/60 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          {(['Clip', 'Track', 'Effects', 'Master'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 px-1 text-xs font-semibold relative transition-all ${
                activeTab === tab ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00E5FF] shadow-[0_0_8px_#00E5FF] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Discrete >< Minimize Button */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="pb-2 text-slate-500 hover:text-slate-200 p-0.5 rounded transition-colors"
            title="Minimize Inspector (><)"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Inspector Content */}
      <div className="p-3 space-y-3.5">
        {/* Clip Title Header */}
        <div className="flex items-center space-x-2.5 apple-glass-card p-2.5 rounded-xl border border-white/[0.08]">
          <div className="w-6 h-6 rounded-lg bg-[#00E5FF]/15 border border-[#00E5FF]/30 flex items-center justify-center shrink-0">
            <FileAudio className="w-3.5 h-3.5 text-[#00E5FF]" />
          </div>
          <span className="text-xs font-semibold text-white truncate">
            {activeClip?.name || 'Vocal Take 01.wav'}
          </span>
        </div>

        {/* Start / End / Duration Metadata Grid */}
        <div className="apple-glass-card p-3 rounded-2xl border border-white/[0.08] space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Start</span>
            <span className="text-[#00E5FF] font-semibold">
              {formatSecToTc(activeClip?.startTime || 0)}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">End</span>
            <span className="text-[#00E5FF] font-semibold">
              {formatSecToTc((activeClip?.startTime || 0) + ((activeClip?.sourceOut || 10) - (activeClip?.sourceIn || 0)))}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Duration</span>
            <span className="text-[#00E5FF] font-semibold">
              {formatSecToTc((activeClip?.sourceOut || 10) - (activeClip?.sourceIn || 0))}
            </span>
          </div>
        </div>

        {/* 1. Clip Transform Effect Controls (Volume, Pan, Fades) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Clip Transform (Keyframable)</span>
            </span>
            <button
              onClick={() => {
                if (activeClip) {
                  onUpdateClip({ ...activeClip, isMuted: !activeClip.isMuted });
                }
              }}
              className={`p-1 rounded-lg transition-colors ${
                activeClip?.isMuted ? 'text-red-400 bg-red-500/20' : 'text-slate-400 hover:text-emerald-400 hover:bg-white/10'
              }`}
              title="Mute Clip"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Volume Parameter Row */}
          {renderPremiereControlRow({
            target: 'clip',
            paramKey: 'volume',
            label: 'Volume (Gain)',
            unitLabel: 'dB',
            value: activeClip?.gain ?? 1.0,
            defaultValue: 1.0,
            min: 0,
            max: 2,
            step: 0.01,
            color: '#00E5FF',
            formatValue: (v) => `${(20 * Math.log10(Math.max(0.001, v))).toFixed(1)} dB`,
            onDirectChange: (val) => {
              if (activeClip) onUpdateClip({ ...activeClip, gain: val });
            },
          })}

          {/* Pan Parameter Row */}
          {renderPremiereControlRow({
            target: 'clip',
            paramKey: 'pan',
            label: 'Pan',
            unitLabel: '',
            value: activeClip?.pan ?? 0,
            defaultValue: 0,
            min: -1,
            max: 1,
            step: 0.05,
            color: '#1E88E5',
            formatValue: (v) =>
              v === 0 ? 'Center' : v < 0 ? `${Math.abs(Math.round(v * 100))} L` : `${Math.round(v * 100)} R`,
            onDirectChange: (val) => {
              if (activeClip) onUpdateClip({ ...activeClip, pan: val });
            },
          })}
        </div>

        {/* 2. Track Equalizer (3-Band Parametric EQ) */}
        <div className="apple-glass-card rounded-2xl overflow-hidden border border-white/[0.08]">
          <div
            onClick={() => toggleFxAccordion('Equalizer')}
            className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center space-x-2">
              {expandedFx.includes('Equalizer') ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="text-xs font-semibold text-slate-100">3-Band Parametric EQ</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34D399]" />
          </div>

          {expandedFx.includes('Equalizer') && activeTrack && (
            <div className="p-3 border-t border-white/[0.06] space-y-2.5">
              {/* Low Shelf */}
              {renderPremiereControlRow({
                target: 'track',
                paramKey: 'eq_low',
                label: 'Low Shelf (150 Hz)',
                unitLabel: 'dB',
                value: activeTrack.eqLowGain,
                defaultValue: 0,
                min: -12,
                max: 12,
                step: 0.5,
                color: '#8B5CF6',
                formatValue: (v) => `${v.toFixed(1)} dB`,
                onDirectChange: (val) => {
                  if (onUpdateTrack) onUpdateTrack({ ...activeTrack, eqLowGain: val });
                },
              })}

              {/* Mid Peak */}
              {renderPremiereControlRow({
                target: 'track',
                paramKey: 'eq_mid',
                label: 'Mid Peak (1.5 kHz)',
                unitLabel: 'dB',
                value: activeTrack.eqMidGain,
                defaultValue: 0,
                min: -12,
                max: 12,
                step: 0.5,
                color: '#A855F7',
                formatValue: (v) => `${v.toFixed(1)} dB`,
                onDirectChange: (val) => {
                  if (onUpdateTrack) onUpdateTrack({ ...activeTrack, eqMidGain: val });
                },
              })}

              {/* High Shelf */}
              {renderPremiereControlRow({
                target: 'track',
                paramKey: 'eq_high',
                label: 'High Shelf (6 kHz)',
                unitLabel: 'dB',
                value: activeTrack.eqHighGain,
                defaultValue: 0,
                min: -12,
                max: 12,
                step: 0.5,
                color: '#F43F5E',
                formatValue: (v) => `${v.toFixed(1)} dB`,
                onDirectChange: (val) => {
                  if (onUpdateTrack) onUpdateTrack({ ...activeTrack, eqHighGain: val });
                },
              })}
            </div>
          )}
        </div>

        {/* 3. Reverb Send */}
        <div className="apple-glass-card rounded-2xl overflow-hidden border border-white/[0.08]">
          <div
            onClick={() => toggleFxAccordion('Reverb')}
            className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center space-x-2">
              {expandedFx.includes('Reverb') ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="text-xs font-semibold text-slate-100">Convolver Reverb Send</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_6px_#C084FC]" />
          </div>

          {expandedFx.includes('Reverb') && activeTrack && (
            <div className="p-3 border-t border-white/[0.06]">
              {renderPremiereControlRow({
                target: 'track',
                paramKey: 'reverb_send',
                label: 'Reverb Wet Send',
                unitLabel: '%',
                value: activeTrack.reverbSend,
                defaultValue: 0.15,
                min: 0,
                max: 1,
                step: 0.02,
                color: '#F59E0B',
                formatValue: (v) => `${Math.round(v * 100)}%`,
                onDirectChange: (val) => {
                  if (onUpdateTrack) onUpdateTrack({ ...activeTrack, reverbSend: val });
                },
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export const Inspector = memo(InspectorComponent);
