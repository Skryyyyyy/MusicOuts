import React, { useState } from 'react';
import { Project, Track, SourceAsset, SongSection } from '../../core/project-model/types';
import {
  List,
  Sliders,
  AudioWaveform,
  FolderOpen,
  Heart,
  ChevronRight,
  ChevronDown,
  Plus,
  Sparkles,
  GripVertical,
  Layers,
  FileAudio,
  Activity,
} from 'lucide-react';

interface LeftColumnProps {
  project: Project;
  selectedTrackId: string | null;
  expandedAutomationTrackIds: string[];
  meterLevels: { left: number; right: number };
  onSelectTrack: (track: Track) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  onToggleAutomationLane: (trackId: string) => void;
  onAddTrack: () => void;
  onAddSource?: (asset: SourceAsset, buffer: AudioBuffer) => void;
  onDragStartSample: (e: React.DragEvent, asset: SourceAsset, section?: SongSection) => void;
  onTriggerStemLab: (assetId: string) => void;
}

export const LeftColumn: React.FC<LeftColumnProps> = ({
  project,
  selectedTrackId,
  expandedAutomationTrackIds,
  meterLevels,
  onSelectTrack,
  onToggleMute,
  onToggleSolo,
  onToggleAutomationLane,
  onAddTrack,
  onAddSource,
  onDragStartSample,
  onTriggerStemLab,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'mixer' | 'waveform' | 'samples'>('list');
  const [dividerHeight, setDividerHeight] = useState<number>(55);

  // Divider resize drag
  const handleDividerMouseDown = () => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('left-column-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newPct = Math.max(30, Math.min(80, ((e.clientY - rect.top) / rect.height) * 100));
        setDividerHeight(newPct);
      }
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <aside
      id="left-column-container"
      className="w-72 lg:w-80 bg-[#14161D] border-r border-white/[0.08] flex flex-col h-full select-none shrink-0"
    >
      {/* ------------------------------------------------------------- */}
      {/* TOP SECTION: TRACK LIST */}
      {/* ------------------------------------------------------------- */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: `${dividerHeight}%` }}
      >
        {/* Tabs Row (List, Mixer, Waveform, Samples) */}
        <div className="h-10 bg-[#101217] border-b border-white/[0.06] flex items-center justify-around px-2 shrink-0">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'list'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Tracks</span>
          </button>

          <button
            onClick={() => setActiveTab('mixer')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'mixer'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Mixer</span>
          </button>

          <button
            onClick={() => setActiveTab('waveform')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'waveform'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AudioWaveform className="w-3.5 h-3.5" />
            <span>Waves</span>
          </button>

          <button
            onClick={() => setActiveTab('samples')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'samples'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Samples</span>
          </button>
        </div>

        {/* Tracks List Scrollable Rows */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {project.tracks.map((track, idx) => {
            const isSelected = selectedTrackId === track.id;
            const hasAutomationOpen = expandedAutomationTrackIds.includes(track.id);

            return (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track)}
                className={`relative group flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#1F222C] ring-1.5 ring-pro-accent shadow-md'
                    : 'bg-[#191B22]/70 hover:bg-[#1C1F28] border border-white/[0.04]'
                }`}
              >
                {/* Left Indicator Dots (Mute / Solo / Record Arm) */}
                <div className="flex flex-col space-y-1 mr-2 shrink-0">
                  {/* Mute Dot */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMute(track.id);
                    }}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      track.isMuted ? 'bg-red-500 ring-2 ring-red-500/30' : 'bg-white/10 hover:bg-white/30'
                    }`}
                    title="Mute Track"
                  />
                  {/* Solo Dot */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSolo(track.id);
                    }}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      track.isSoloed ? 'bg-amber-400 ring-2 ring-amber-400/30' : 'bg-white/10 hover:bg-white/30'
                    }`}
                    title="Solo Track"
                  />
                </div>

                {/* Colored Icon Tile (Track Color, Rounded Square) */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-inner mr-2.5"
                  style={{
                    backgroundColor: `${track.color}25`,
                    border: `1px solid ${track.color}60`,
                    color: track.color,
                  }}
                >
                  <Activity className="w-4 h-4" />
                </div>

                {/* Track Name & Meter Bars */}
                <div className="flex-1 min-w-0 mr-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-100 truncate">
                      {track.name || `Audio Channel 0${idx + 1}`}
                    </span>
                    <span className="text-[9px] uppercase font-mono text-slate-400">
                      {track.stemType}
                    </span>
                  </div>

                  {/* Thin Level Meter Bars */}
                  <div className="w-full h-1 bg-black/60 rounded-full mt-1.5 overflow-hidden flex gap-0.5 p-px">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-75"
                      style={{
                        width: `${Math.min(100, (track.isMuted ? 0 : meterLevels.left) * 100 * track.volume)}%`,
                      }}
                    />
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-75"
                      style={{
                        width: `${Math.min(100, (track.isMuted ? 0 : meterLevels.right) * 100 * track.volume)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Envelope / Automation Thumbnail Toggle Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleAutomationLane(track.id);
                  }}
                  className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                    hasAutomationOpen
                      ? 'bg-pro-accent/20 text-pro-accent border border-pro-accent/40'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.08]'
                  }`}
                  title="Toggle Automation & Keyframe Lane"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 13L6 8L10 11L14 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    <circle cx="6" cy="8" r="1.5" fill="currentColor" />
                    <circle cx="10" cy="11" r="1.5" fill="currentColor" />
                  </svg>
                </button>
              </div>
            );
          })}

          {/* Full-width "+" Add Track Button */}
          <button
            onClick={onAddTrack}
            className="w-full py-2.5 rounded-xl border border-dashed border-white/10 hover:border-pro-accent/50 hover:bg-pro-accent/10 text-slate-400 hover:text-pro-accent flex items-center justify-center gap-1.5 text-xs font-semibold transition-all mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Audio Track</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DRAGGABLE DIVIDER WITH GRABBER HANDLE */}
      {/* ------------------------------------------------------------- */}
      <div
        onMouseDown={handleDividerMouseDown}
        className="h-2 bg-[#0E1015] hover:bg-pro-accent/40 cursor-row-resize flex items-center justify-center border-y border-white/[0.06] transition-colors"
        title="Drag to resize panels"
      >
        <div className="w-8 h-1 bg-white/20 rounded-full" />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BOTTOM SECTION: LIBRARY */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#111319]">
        {/* Library Header */}
        <div className="p-2.5 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Library
          </span>
          <label className="cursor-pointer px-2 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 text-[10px] font-semibold flex items-center gap-1 transition-colors">
            <Plus className="w-3 h-3" />
            <span>Import</span>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0 || !onAddSource) return;
                const file = files[0];
                const arrayBuffer = await file.arrayBuffer();
                const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
                const tempCtx = new AudioCtxClass();
                const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
                const asset: SourceAsset = {
                  id: `asset-${Date.now()}`,
                  name: file.name,
                  duration: audioBuffer.duration,
                  sampleRate: audioBuffer.sampleRate,
                  channels: audioBuffer.numberOfChannels,
                  fileSize: file.size,
                };
                onAddSource(asset, audioBuffer);
              }}
            />
          </label>
        </div>

        {/* Quick Folders (Likes, All Samples) */}
        <div className="px-2 py-1.5 border-b border-white/[0.04] space-y-0.5">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.06] cursor-pointer text-slate-300 text-xs">
            <div className="flex items-center gap-2">
              <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500/20" />
              <span>Favorites & Likes</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </div>

          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.06] cursor-pointer text-slate-300 text-xs">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>All Imported Audio</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* Recently Added / Analyzed Audio List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {Object.values(project.sources).map((asset) => (
            <div
              key={asset.id}
              draggable
              onDragStart={(e) => onDragStartSample(e, asset)}
              className="p-2 rounded-xl bg-[#171922] border border-white/[0.04] hover:border-pro-accent/40 cursor-grab active:cursor-grabbing transition-all group"
            >
              {/* Asset Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileAudio className="w-4 h-4 text-pro-accent shrink-0" />
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-slate-100 truncate group-hover:text-pro-accent transition-colors">
                      {asset.name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                      <span>{asset.duration.toFixed(1)}s</span>
                      <span>•</span>
                      <span>{asset.bpm ? `${asset.bpm} BPM` : '120 BPM'}</span>
                      <span className="px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[9px]">
                        LOOP
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onTriggerStemLab(asset.id)}
                    className="p-1 hover:bg-purple-500/20 text-purple-400 rounded transition-colors"
                    title="Run Stem Lab Separation"
                  >
                    <Layers className="w-3.5 h-3.5" />
                  </button>
                  <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>

              {/* Auto-Analyzed Song Section Chips (Intro, Verse, Chorus, Drop) */}
              {project.sections.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/[0.04] flex flex-wrap gap-1">
                  {project.sections.map((sec) => (
                    <div
                      key={sec.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        onDragStartSample(e, asset, sec);
                      }}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1 cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
                      style={{
                        backgroundColor: `${sec.color}15`,
                        borderColor: `${sec.color}40`,
                        color: sec.color,
                      }}
                      title={`Drag ${sec.name} (${sec.startTime}s - ${sec.endTime}s) onto timeline`}
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>{sec.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
