import React, { useState } from 'react';
import {
  Power,
  Clock,
  Lock,
  ChevronDown,
} from 'lucide-react';

interface AutomationNode {
  id: string;
  laneId: string;
  time: number;
  valY: number;
}

interface AutomationStudioProps {
  currentTime: number;
  onSeek?: (time: number) => void;
  onToggleCollapse?: () => void;
}

export const AutomationStudio: React.FC<AutomationStudioProps> = ({
  currentTime,
  onSeek,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'Mixer' | 'Keyframes'>('Keyframes');
  const [selectedPreset, setSelectedPreset] = useState<string>('Linear');
  const [activeLaneId, setActiveLaneId] = useState<string>('vol');

  // Dynamic Keyframe Nodes
  const [nodes, setNodes] = useState<AutomationNode[]>([
    { id: 'v-1', laneId: 'vol', time: 13.6, valY: 5 },
    { id: 'v-2', laneId: 'vol', time: 25.0, valY: 12 },
    { id: 'v-3', laneId: 'vol', time: 45.4, valY: 8 },
    { id: 'v-4', laneId: 'vol', time: 68.1, valY: 18 },
    { id: 'p-1', laneId: 'pan', time: 17.0, valY: 42 },
    { id: 'p-2', laneId: 'pan', time: 34.0, valY: 32 },
    { id: 'p-3', laneId: 'pan', time: 56.8, valY: 39 },
    { id: 'eq-1', laneId: 'eq-mid', time: 20.4, valY: 68 },
    { id: 'eq-2', laneId: 'eq-mid', time: 39.7, valY: 82 },
    { id: 'eq-3', laneId: 'eq-mid', time: 62.5, valY: 70 },
  ]);

  const pxPerSec = 8.8;
  const timeToPx = (time: number) => time * pxPerSec;
  const pxToTime = (px: number) => Math.max(0, px / pxPerSec);

  const rulerMarks = [
    '0:00', '0:10', '0:20', '0:30', '0:40', '0:50', '1:00', '1:10', '1:20', '1:30', '1:40'
  ];

  const lanes = [
    { id: 'vol', name: 'Volume', color: '#EC4899', scale: ['6', '0', '-6', '-12'], defaultY: 12 },
    { id: 'pan', name: 'Pan', color: '#1E88E5', scale: ['R', 'C', 'L'], defaultY: 38 },
    { id: 'eq-low', name: 'EQ - Low', color: '#8B5CF6', scale: ['12', '0', '-12'], defaultY: 55 },
    { id: 'eq-mid', name: 'EQ - Mid', color: '#A855F7', scale: ['12', '0', '-12'], defaultY: 75 },
    { id: 'eq-high', name: 'EQ - High', color: '#F43F5E', scale: ['12', '0', '-12'], defaultY: 95 },
    { id: 'reverb', name: 'Reverb', color: '#F59E0B', scale: ['100', '0'], defaultY: 118 },
    { id: 'pitch', name: 'Pitch', color: '#00C853', scale: ['2', '0', '-2'], defaultY: 148 },
  ];

  const presets = [
    { id: 'Linear', name: 'Linear', path: 'M 2,14 L 14,2' },
    { id: 'Ease In', name: 'Ease In', path: 'M 2,14 Q 10,14 14,2' },
    { id: 'Ease Out', name: 'Ease Out', path: 'M 2,14 Q 2,2 14,2' },
    { id: 'Ease In Out', name: 'Ease In Out', path: 'M 2,14 Q 8,14 8,8 T 14,2' },
    { id: 'Hold', name: 'Hold', path: 'M 2,14 L 8,14 L 8,2 L 14,2' },
    { id: 'Bezier', name: 'Bezier', path: 'M 2,14 C 4,2 10,14 14,2' },
    { id: 'Bounce', name: 'Bounce', path: 'M 2,14 Q 6,2 8,10 T 14,2' },
    { id: 'Custom', name: 'Custom', path: 'M 2,12 L 6,4 L 10,10 L 14,2' },
  ];

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const clickTime = pxToTime(clickX);

    // Add new keyframe node to active lane
    const newNode: AutomationNode = {
      id: `node-${Date.now()}`,
      laneId: activeLaneId,
      time: clickTime,
      valY: Math.max(5, Math.min(160, clickY - 20)),
    };
    setNodes([...nodes, newNode]);
  };

  return (
    <div className="h-64 bg-[#0E0F14] border-t border-white/[0.08] flex flex-col select-none shrink-0 overflow-hidden">
      {/* Top Header & Tabs (Mixer, Keyframes / Automation) */}
      <div className="h-8 bg-[#12141C] border-b border-white/[0.06] flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center space-x-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('Mixer')}
            className={`pb-1 transition-colors ${
              activeTab === 'Mixer' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mixer
          </button>
          <button
            onClick={() => setActiveTab('Keyframes')}
            className={`pb-1 relative transition-colors ${
              activeTab === 'Keyframes' ? 'text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Keyframes / Automation
            {activeTab === 'Keyframes' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#EC4899]" />
            )}
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <div className="flex items-center space-x-1 text-slate-300 bg-[#1A1D27] border border-white/[0.08] px-2 py-0.5 rounded cursor-pointer">
            <span className="text-[11px] text-slate-400">Presets:</span>
            <span className="text-[11px] font-bold text-[#00E5FF]">{selectedPreset}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </div>

          {/* Discrete >< Minimize Button */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded font-mono text-[11px] font-bold transition-colors ml-1"
              title="Minimize Bottom Studio (><)"
            >
              <span>{'><'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Multi-Track Automation Studio Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Automation Lanes Strip */}
        <div className="w-48 bg-[#12141C] border-r border-white/[0.08] flex flex-col shrink-0 pt-5">
          {lanes.map((lane) => {
            const isSelected = activeLaneId === lane.id;
            return (
              <div
                key={lane.id}
                onClick={() => setActiveLaneId(lane.id)}
                className={`h-6 border-b border-white/[0.04] px-2 flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected ? 'bg-white/10' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center space-x-1.5 overflow-hidden">
                  <Power className={`w-3 h-3 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span
                    className="text-[11px] font-semibold truncate"
                    style={{ color: lane.color }}
                  >
                    {lane.name}
                  </span>
                </div>

                <div className="flex items-center space-x-1 text-slate-400">
                  <Clock className="w-2.5 h-2.5 hover:text-white" />
                  <Lock className="w-2.5 h-2.5 hover:text-white" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Center Automation Curves Canvas */}
        <div
          onClick={handleCanvasClick}
          className="flex-1 overflow-x-auto overflow-y-hidden relative bg-[#090A0E] flex cursor-crosshair"
        >
          <div className="relative h-full flex-1" style={{ width: '920px' }}>
            {/* Top Time Ticks */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (!onSeek) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                onSeek(pxToTime(clickX));
              }}
              className="h-5 border-b border-white/[0.06] relative cursor-pointer"
            >
              {rulerMarks.map((mark, i) => (
                <div
                  key={mark}
                  className="absolute text-[9px] font-mono text-slate-400 transform -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${i * 88}px` }}
                >
                  <span>{mark}</span>
                </div>
              ))}
            </div>

            {/* Grid Background */}
            <div className="absolute inset-0 top-5 pointer-events-none">
              {rulerMarks.map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-white/[0.02]"
                  style={{ left: `${i * 88}px` }}
                />
              ))}
            </div>

            {/* Spline Curves Overlay with Keyframe Nodes */}
            <svg className="absolute inset-0 top-5 w-full h-full pointer-events-none">
              {/* Volume Spline (Pink) */}
              <path
                d="M 0,15 Q 120,5 220,12 T 400,8 T 600,18 T 880,10"
                fill="none"
                stroke="#EC4899"
                strokeWidth="1.8"
                className="drop-shadow-[0_0_4px_#EC4899]"
              />

              {/* Pan Spline (Blue) */}
              <path
                d="M 0,38 Q 150,45 300,35 T 500,42 T 750,30 T 880,38"
                fill="none"
                stroke="#1E88E5"
                strokeWidth="1.8"
                className="drop-shadow-[0_0_4px_#1E88E5]"
              />

              {/* EQ Mid Spline (Violet) */}
              <path
                d="M 0,75 Q 180,68 350,82 T 550,70 T 800,85 T 880,72"
                fill="none"
                stroke="#A855F7"
                strokeWidth="1.8"
              />

              {/* Reverb Spline (Orange) */}
              <path
                d="M 0,118 Q 160,115 320,122 T 520,110 T 720,125 T 880,115"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="1.8"
              />

              {/* Render Nodes */}
              {nodes.map((node) => {
                const lane = lanes.find((l) => l.id === node.laneId);
                const x = timeToPx(node.time);
                return (
                  <circle
                    key={node.id}
                    cx={x}
                    cy={node.valY}
                    r="4"
                    fill="#FFFFFF"
                    stroke={lane?.color || '#EC4899'}
                    strokeWidth="2"
                    className="pointer-events-auto cursor-pointer hover:r-5 transition-all"
                  />
                );
              })}
            </svg>

            {/* Glowing Red Playhead Line extending through automation */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-30"
              style={{ left: `${timeToPx(currentTime)}px` }}
            >
              <div className="w-0.5 h-full bg-[#FF1744] shadow-[0_0_8px_#FF1744] relative">
                <div className="w-2.5 h-2.5 bg-[#FF1744] rounded-full absolute -top-1 -left-[4px]" />
              </div>
            </div>
          </div>

          {/* Right Parameter Scales Column */}
          <div className="w-10 bg-[#12141C] border-l border-white/[0.08] flex flex-col justify-around text-[9px] font-mono text-slate-400 px-1 pt-5 shrink-0 select-none">
            <span>6</span>
            <span>0</span>
            <span>-6</span>
            <span>-12</span>
            <span className="text-[#1E88E5]">R</span>
            <span className="text-[#A855F7]">12</span>
            <span>0</span>
            <span className="text-[#F59E0B]">100</span>
            <span>0</span>
            <span className="text-[#00C853]">2</span>
            <span>-2</span>
          </div>
        </div>

        {/* Right Curve Presets Panel */}
        <div className="w-32 bg-[#12141C] border-l border-white/[0.08] p-2 space-y-1 overflow-y-auto shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Curve Presets
          </span>

          {presets.map((preset) => {
            const isSelected = selectedPreset === preset.name;

            return (
              <button
                key={preset.id}
                onClick={() => setSelectedPreset(preset.name)}
                className={`w-full flex items-center space-x-2 px-2 py-1 rounded-md text-[11px] font-medium transition-all text-left ${
                  isSelected
                    ? 'bg-[#1E88E5]/20 border border-[#1E88E5] text-white shadow-md'
                    : 'bg-[#171923] border border-white/[0.04] text-slate-300 hover:bg-[#1C1F2B]'
                }`}
              >
                {/* Visual SVG Curve Thumbnail */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
                  <path
                    d={preset.path}
                    stroke={isSelected ? '#00E5FF' : '#94A3B8'}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="truncate">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
