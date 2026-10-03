import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Folder,
  SkipBack,
  Square,
  Play,
  Pause,
  Circle,
  SkipForward,
  ChevronDown,
  Headphones,
  Minus,
  Maximize2,
  X,
  Sliders,
  Sparkles,
  Download,
  Bell,
  PanelLeft,
  PanelRight,
  PanelBottom,
} from 'lucide-react';

interface TopBarProps {
  projectTitle: string;
  bpm: number;
  timeSignature: [number, number];
  currentKey?: string;
  currentTime: number;
  isPlaying: boolean;
  isRecording: boolean;
  isMetronomeOn?: boolean;
  masterVolume: number;
  meterLevels: { left: number; right: number };

  // Panel toggles
  isLeftSidebarOpen: boolean;
  isRightInspectorOpen: boolean;
  isBottomStudioOpen: boolean;
  isTimelineFocused?: boolean;
  onToggleLeftSidebar: () => void;
  onToggleRightInspector: () => void;
  onToggleBottomStudio: () => void;
  onToggleFocusTimelineMode?: () => void;

  // Project Actions
  onNewEmptyProject: () => void;
  onLoadDemoProject: () => void;
  onClearTimeline: () => void;
  onSaveProject: () => void;
  onOpenProject: () => void;

  // Track & Clip Actions
  onDuplicateSelectedTrack: () => void;
  onDeleteSelectedTrack: () => void;
  onClearAllTracks: () => void;
  onCopySelectedClip: () => void;
  onPasteClipAtPlayhead: () => void;
  onDeleteSelectedClip: () => void;
  onSelectAllClips: () => void;

  onUpdateTitle?: (title: string) => void;
  onUpdateBpm?: (bpm: number) => void;
  onUpdateTimeSignature?: (ts: [number, number]) => void;
  onUpdateKey?: (key: string) => void;
  onToggleMetronome?: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onPrevTrack?: () => void;
  onNextTrack?: () => void;
  onToggleRecord: () => void;
  onMasterVolumeChange: (vol: number) => void;

  // User & Project Hub
  user?: {
    username: string;
    email: string;
    avatar: string;
    tier: string;
  };
  folderPath?: string;
  onOpenProjectHub?: () => void;
  onSignOut?: () => void;

  // Modals & Menu Actions
  onOpenMixer: () => void;
  onOpenSampleEditor: () => void;
  onOpenPianoRoll: () => void;
  onOpenTakeComping: () => void;
  onOpenAIMastering: () => void;
  onOpenStemLab: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenExport: () => void;
  onOpenURLImport?: () => void;
  onOpenAIAssistant?: () => void;
  onAddAudioTrack: () => void;
  onAddMidiTrack: () => void;
  onAddBusTrack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSplitSelectedClip: () => void;
  onNormalizeSelectedClip: () => void;
  onReverseSelectedClip: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  projectTitle,
  bpm,
  timeSignature,
  currentKey = 'Cmaj',
  currentTime,
  isPlaying,
  isRecording,
  isMetronomeOn = false,
  masterVolume,
  meterLevels,
  isLeftSidebarOpen,
  isRightInspectorOpen,
  isBottomStudioOpen,
  isTimelineFocused = false,
  user,
  folderPath,
  onOpenProjectHub,
  onSignOut,
  onToggleLeftSidebar,
  onToggleRightInspector,
  onToggleBottomStudio,
  onToggleFocusTimelineMode,
  onNewEmptyProject,
  onLoadDemoProject,
  onClearTimeline,
  onSaveProject,
  onOpenProject,
  onDuplicateSelectedTrack,
  onDeleteSelectedTrack,
  onClearAllTracks,
  onCopySelectedClip,
  onPasteClipAtPlayhead,
  onDeleteSelectedClip,
  onSelectAllClips,
  onUpdateTitle,
  onUpdateBpm,
  onUpdateTimeSignature,
  onUpdateKey,
  onToggleMetronome,
  onPlay,
  onPause,
  onStop,
  onPrevTrack,
  onNextTrack,
  onToggleRecord,
  onMasterVolumeChange,
  onOpenMixer,
  onOpenSampleEditor,
  onOpenPianoRoll,
  onOpenTakeComping,
  onOpenAIMastering,
  onOpenStemLab,
  onOpenSettings,
  onOpenHistory,
  onOpenExport,
  onOpenURLImport,
  onOpenAIAssistant,
  onAddAudioTrack,
  onAddMidiTrack,
  onAddBusTrack,
  onUndo,
  onRedo,
  onSplitSelectedClip,
  onNormalizeSelectedClip,
  onReverseSelectedClip,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isKeyMenuOpen, setIsKeyMenuOpen] = useState<boolean>(false);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>(projectTitle);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Tap Tempo state
  const tapTimesRef = useRef<number[]>([]);

  const handleTapTempo = () => {
    const now = performance.now();
    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length > 4) {
      tapTimesRef.current.shift();
    }
    if (tapTimesRef.current.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 40 && calculatedBpm <= 280 && onUpdateBpm) {
        onUpdateBpm(calculatedBpm);
      }
    }
  };

  const handleCycleTimeSignature = () => {
    if (!onUpdateTimeSignature) return;
    if (timeSignature[0] === 4) onUpdateTimeSignature([3, 4]);
    else if (timeSignature[0] === 3) onUpdateTimeSignature([6, 8]);
    else if (timeSignature[0] === 6) onUpdateTimeSignature([5, 4]);
    else onUpdateTimeSignature([4, 4]);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
        setIsKeyMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format 00:00:42:17 (HR:MIN:SEC:FR @ 30fps)
  const formatTimecode = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return {
      hrs: hrs.toString().padStart(2, '0'),
      mins: mins.toString().padStart(2, '0'),
      secs: secs.toString().padStart(2, '0'),
      frames: frames.toString().padStart(2, '0'),
    };
  };

  const tc = formatTimecode(currentTime);

  const keys = ['Cmaj', 'Gmaj', 'Dmaj', 'Amaj', 'Fmaj', 'Bbmaj', 'Amin', 'Emin', 'Dmin', 'F#min'];

  const menuItems: Record<string, { label: string; shortcut?: string; action: () => void; divider?: boolean }[]> = {
    File: [
      { label: 'Project Hub (Open Folder / New Session)...', shortcut: 'Ctrl+Shift+O', action: () => {
        if (onOpenProjectHub) onOpenProjectHub();
        else onOpenProject();
      }, divider: true },
      { label: 'New Blank Session', shortcut: 'Ctrl+N', action: onNewEmptyProject },
      { label: 'Load Demo Studio Project', action: onLoadDemoProject },
      { label: 'Open Project File...', shortcut: 'Ctrl+O', action: onOpenProject },
      { label: 'Save Project', shortcut: 'Ctrl+S', action: onSaveProject },
      { label: 'Clear Timeline Clips', action: onClearTimeline, divider: true },
      { label: 'Download from Spotify / YouTube / Apple Music...', shortcut: 'Ctrl+U', action: () => {
        if (onOpenURLImport) onOpenURLImport();
      }},
      { label: 'Import Local Audio File...', shortcut: 'Ctrl+I', action: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.click();
      }, divider: true },
      { label: 'Export Master / Stems...', shortcut: 'Ctrl+M', action: onOpenExport },
      { label: 'Project Settings...', shortcut: 'Alt+Enter', action: onOpenSettings, divider: true },
      { label: 'Exit Application', action: () => window.close() },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: onUndo },
      { label: 'Redo', shortcut: 'Ctrl+Y', action: onRedo },
      { label: 'Visual Undo History...', action: onOpenHistory, divider: true },
      { label: 'Cut / Split Clip', shortcut: 'Ctrl+X', action: onSplitSelectedClip },
      { label: 'Copy Clip', shortcut: 'Ctrl+C', action: onCopySelectedClip },
      { label: 'Paste Clip at Playhead', shortcut: 'Ctrl+V', action: onPasteClipAtPlayhead },
      { label: 'Delete Selected Clip', shortcut: 'Del', action: onDeleteSelectedClip },
      { label: 'Select All Clips', shortcut: 'Ctrl+A', action: onSelectAllClips },
    ],
    View: [
      { label: isLeftSidebarOpen ? 'Hide Media Browser Panel' : 'Show Media Browser Panel', shortcut: 'Ctrl+[', action: onToggleLeftSidebar },
      { label: isRightInspectorOpen ? 'Hide Inspector Panel' : 'Show Inspector Panel', shortcut: 'Ctrl+]', action: onToggleRightInspector },
      { label: isBottomStudioOpen ? 'Hide Bottom Studio Panel' : 'Show Bottom Studio Panel', shortcut: 'Ctrl+J', action: onToggleBottomStudio, divider: true },
      { label: 'Audio Mixer Console', shortcut: 'F3', action: onOpenMixer },
      { label: 'Waveform & Spectral Sample Editor', shortcut: 'F4', action: onOpenSampleEditor },
      { label: 'MIDI Piano Roll Editor', shortcut: 'F5', action: onOpenPianoRoll },
      { label: 'Vocal Comping & Take Lanes', shortcut: 'F6', action: onOpenTakeComping, divider: true },
      { label: 'Toggle Fullscreen', shortcut: 'F11', action: () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }},
    ],
    Track: [
      { label: 'Add Audio Track', shortcut: 'Ctrl+T', action: onAddAudioTrack },
      { label: 'Add MIDI Track', shortcut: 'Ctrl+Shift+T', action: onAddMidiTrack },
      { label: 'Add Bus Submix Track', action: onAddBusTrack, divider: true },
      { label: 'Duplicate Selected Track', action: onDuplicateSelectedTrack },
      { label: 'Delete Selected Track', shortcut: 'Shift+Del', action: onDeleteSelectedTrack },
      { label: 'Clear All Tracks', action: onClearAllTracks },
      { label: 'Record Live Mic Input', shortcut: 'Ctrl+R', action: onToggleRecord },
    ],
    Clip: [
      { label: 'Split at Playhead (Razor)', shortcut: 'Ctrl+B', action: onSplitSelectedClip },
      { label: 'Normalize Audio (0 dBFS)', action: onNormalizeSelectedClip },
      { label: 'Reverse Audio', action: onReverseSelectedClip },
      { label: 'Delete Selected Clip', action: onDeleteSelectedClip },
    ],
    Effects: [
      { label: 'Open 8-Band Parametric EQ', action: onOpenMixer },
      { label: 'Open Vintage VCA Compressor', action: onOpenMixer },
      { label: 'Open Spatial Reverb Convolver', action: onOpenMixer },
    ],
    Tools: [
      { label: 'Download Song via URL (Spotify / YouTube)...', shortcut: 'Ctrl+U', action: () => {
        if (onOpenURLImport) onOpenURLImport();
      }},
      { label: 'AI Stem Separation (Demucs)...', action: onOpenStemLab },
      { label: 'AI Audio Cleanup & Mastering...', action: onOpenAIMastering, divider: true },
    ],
    Help: [
      { label: 'Keyboard Shortcuts Cheatsheet', action: () => alert('Space: Play/Pause\nCtrl+B: Split Clip\nShift+Del: Ripple Delete\nCtrl+Z: Undo\nCtrl+Y: Redo\nCtrl+[: Toggle Media Browser\nCtrl+]: Toggle Inspector\nCtrl+J: Toggle Automation Studio\nF3: Mixer\nF4: Sample Editor\nF5: Piano Roll') },
      { label: 'Audio Engine Diagnostics', action: () => alert('Audio Engine: Online (32-bit Float DSP)\nSample Rate: 48000 Hz\nBuffers: Online') },
    ],
  };

  return (
    <header className="h-12 apple-glass-toolbar flex items-center justify-between px-3 select-none z-50 shrink-0 text-slate-200 relative shadow-md">
      {/* Left Menu & Premiere-Style Dropdowns */}
      <div ref={menuRef} className="flex items-center space-x-1 shrink-0 relative">
        <button
          onClick={() => setActiveMenu(activeMenu === 'AppMenu' ? null : 'AppMenu')}
          className="p-1.5 apple-glass-btn rounded-xl text-slate-300 hover:text-white transition-all"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Top Dropdown Menu Triggers */}
        {['File', 'Edit', 'View', 'Track', 'Clip', 'Effects', 'Tools', 'Help'].map((item) => (
          <div key={item} className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === item ? null : item)}
              className={`px-2.5 py-1 text-xs rounded-xl font-medium transition-all ${
                activeMenu === item
                  ? 'bg-white/20 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {item}
            </button>

            {/* Submenu Popover with Apple Glass */}
            {activeMenu === item && (
              <div className="absolute left-0 top-9 w-64 apple-glass rounded-2xl shadow-2xl py-2 z-50 animate-fade-in-scale">
                {menuItems[item]?.map((entry, idx) => (
                  <React.Fragment key={idx}>
                    <button
                      onClick={() => {
                        setActiveMenu(null);
                        entry.action();
                      }}
                      className="w-full px-3.5 py-1.5 text-xs text-left text-slate-200 hover:bg-blue-500/20 hover:text-blue-300 flex items-center justify-between transition-colors"
                    >
                      <span>{entry.label}</span>
                      {entry.shortcut && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {entry.shortcut}
                        </span>
                      )}
                    </button>
                    {entry.divider && (
                      <div className="h-px bg-white/[0.08] my-1" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Project Selector Box & Folder Badge */}
        {isEditingTitle ? (
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={() => {
              setIsEditingTitle(false);
              if (onUpdateTitle) onUpdateTitle(titleInput);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setIsEditingTitle(false);
                if (onUpdateTitle) onUpdateTitle(titleInput);
              }
            }}
            autoFocus
            className="bg-[#171923] border border-blue-400 px-2 py-0.5 rounded-lg text-xs text-white font-medium ml-2 outline-none"
          />
        ) : (
          <div className="flex items-center ml-2 space-x-1">
            <div
              onClick={() => {
                if (onOpenProjectHub) onOpenProjectHub();
                else setIsEditingTitle(true);
              }}
              className="flex items-center space-x-1.5 apple-glass-capsule px-3 py-1 rounded-xl cursor-pointer transition-all group"
              title={folderPath ? `Project Folder: ${folderPath} (Click to open Project Hub)` : 'Click to open Project Hub'}
            >
              <Folder className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300" />
              <span className="text-xs font-semibold text-slate-200 group-hover:text-white max-w-[140px] truncate">{projectTitle}</span>
              {folderPath && (
                <span className="text-[10px] text-slate-400 font-mono hidden md:inline max-w-[100px] truncate">
                  ({folderPath.split('/').pop() || folderPath.split('\\').pop()})
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Center Transport Pill & Timecode Display */}
      <div className="flex items-center space-x-2.5 apple-glass-capsule px-3 py-1 rounded-2xl shadow-md">
        {/* Transport Buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onPrevTrack}
            className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
            title="Previous / Start (Home)"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={onStop}
            className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
            title="Stop"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            onClick={isPlaying ? onPause : onPlay}
            className={`p-1.5 rounded transition-colors ${
              isPlaying ? 'text-white' : 'hover:bg-white/10 text-white'
            }`}
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onToggleRecord}
            className={`p-1.5 rounded transition-colors ${
              isRecording ? 'text-red-500 animate-pulse bg-red-500/20' : 'text-red-500 hover:bg-white/10'
            }`}
            title="Record Live Audio"
          >
            <Circle className="w-3.5 h-3.5 fill-red-500 text-red-500" />
          </button>

          <button
            onClick={onNextTrack}
            className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
            title="Next Track / Skip"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          {/* Metronome Button */}
          {onToggleMetronome && (
            <button
              onClick={onToggleMetronome}
              className={`p-1.5 rounded transition-colors ml-1 ${
                isMetronomeOn ? 'bg-[#00E5FF]/20 text-[#00E5FF] font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle Metronome Click"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Large Monospace Glowing Timecode Box */}
        <div className="bg-[#08090D] border border-white/[0.08] px-3 py-1 rounded-md flex flex-col items-center justify-center shadow-inner">
          <div className="text-sm font-mono font-bold tracking-wider text-[#00E5FF]">
            {tc.hrs}:{tc.mins}:{tc.secs}:{tc.frames}
          </div>
          <div className="flex justify-between w-full text-[7px] text-slate-400 font-mono tracking-widest px-0.5">
            <span>HR</span>
            <span>MIN</span>
            <span>SEC</span>
            <span>FR</span>
          </div>
        </div>

        {/* BPM Tap-Tempo Box */}
        <div
          onClick={handleTapTempo}
          className="bg-[#08090D] border border-white/[0.08] px-2.5 py-1 rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-[#00E5FF]/50 transition-colors"
          title="Tap repeatedly to set tempo (Tap-Tempo)"
        >
          <span className="text-xs font-mono font-bold text-[#00E5FF] leading-none">{bpm}</span>
          <span className="text-[7px] text-slate-400 font-mono tracking-wider mt-0.5">BPM (TAP)</span>
        </div>

        {/* Time Signature Box */}
        <div
          onClick={handleCycleTimeSignature}
          className="bg-[#08090D] border border-white/[0.08] px-2.5 py-1 rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-white/20"
          title="Click to cycle time signature (4/4, 3/4, 6/8, 5/4)"
        >
          <span className="text-xs font-mono font-bold text-[#00E5FF] leading-none">{timeSignature.join('/')}</span>
          <span className="text-[7px] text-slate-400 font-mono tracking-wider mt-0.5">TIME</span>
        </div>

        {/* Key Selector Box */}
        <div className="relative">
          <div
            onClick={() => setIsKeyMenuOpen(!isKeyMenuOpen)}
            className="bg-[#08090D] border border-white/[0.08] px-2 py-1 rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-white/20"
          >
            <div className="flex items-center text-xs font-mono font-bold text-slate-200 leading-none">
              <span>{currentKey}</span>
              <ChevronDown className="w-2.5 h-2.5 text-slate-400 ml-0.5" />
            </div>
            <span className="text-[7px] text-slate-400 font-mono tracking-wider mt-0.5">KEY</span>
          </div>

          {/* Key Popover */}
          {isKeyMenuOpen && (
            <div className="absolute left-0 top-10 w-24 bg-[#181A26] border border-white/10 rounded-lg shadow-2xl py-1 z-50">
              {keys.map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    if (onUpdateKey) onUpdateKey(k);
                    setIsKeyMenuOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1 text-xs hover:bg-[#00E5FF]/20 flex items-center justify-between ${
                    currentKey === k ? 'text-[#00E5FF] font-bold' : 'text-slate-300'
                  }`}
                >
                  <span>{k}</span>
                  {currentKey === k && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Studio Quick Action Buttons, Panel Minimizers & Master Fader */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* Panel Minimize / Maximize Quick Toggles & Master Focus Timeline Button */}
        <div className="flex items-center apple-glass-capsule rounded-xl p-0.5 space-x-0.5 shadow-sm">
          {/* Master >< / <> Workspace Mode Button */}
          {onToggleFocusTimelineMode && (
            <button
              onClick={onToggleFocusTimelineMode}
              className={`px-2 py-1 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-1 ${
                isTimelineFocused
                  ? 'bg-blue-500/25 text-blue-300 border border-blue-400/40 shadow-[0_0_10px_rgba(59,130,246,0.35)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={isTimelineFocused ? 'Restore All Panels (<> Pro Studio Mode)' : 'Minimize All Panels (>< Focus Timeline Mode)'}
            >
              <span>{isTimelineFocused ? '<>' : '><'}</span>
            </button>
          )}

          <div className="w-px h-3.5 bg-white/10 mx-0.5" />

          <button
            onClick={onToggleLeftSidebar}
            className={`p-1 rounded-lg transition-all ${
              isLeftSidebarOpen ? 'bg-white/20 text-blue-300' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Left Media Browser (Ctrl+[)"
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleBottomStudio}
            className={`p-1 rounded-lg transition-all ${
              isBottomStudioOpen ? 'bg-white/20 text-blue-300' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Bottom Automation Studio (Ctrl+J)"
          >
            <PanelBottom className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleRightInspector}
            className={`p-1 rounded-lg transition-all ${
              isRightInspectorOpen ? 'bg-white/20 text-blue-300' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Right Inspector Panel (Ctrl+])"
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {onOpenURLImport && (
          <button
            onClick={onOpenURLImport}
            className="px-3 py-1.5 apple-glass-btn rounded-xl text-xs font-semibold text-blue-400 flex items-center gap-1.5 transition-all shadow-sm"
            title="Download Audio from Spotify / YouTube / Apple Music (Ctrl+U)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>URL Import</span>
          </button>
        )}

        <button
          onClick={onOpenMixer}
          className="px-3 py-1.5 apple-glass-btn rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all shadow-sm"
          title="Open Audio Mixer (F3)"
        >
          <Sliders className="w-3.5 h-3.5 text-blue-400" />
          <span>Mixer</span>
        </button>

        <button
          onClick={onOpenAIMastering}
          className="px-3 py-1.5 apple-glass-btn rounded-xl text-xs font-semibold text-emerald-300 flex items-center gap-1.5 transition-all shadow-sm"
          title="Open AI Mastering Studio"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>AI Master</span>
        </button>

        {onOpenAIAssistant && (
          <button
            onClick={onOpenAIAssistant}
            className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-xs font-bold text-purple-300 flex items-center gap-1.5 shadow-[0_0_12px_rgba(168,85,247,0.25)] transition-all"
            title="Open AI DAW Co-Producer (Natural Language & 26 ML Features)"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Co-Producer</span>
          </button>
        )}

        <button
          onClick={onOpenExport}
          className="px-3 py-1.5 apple-glass-btn-primary rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-md"
          title="Export Project (Ctrl+M)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        {/* Stereo Gradient LED Bar */}
        <div className="w-24 h-3.5 bg-black/50 rounded-full overflow-hidden p-0.5 border border-white/10 flex items-center ml-1 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 via-orange-400 to-rose-500 rounded-full transition-all duration-75"
            style={{ width: `${Math.min(100, Math.max(5, (isPlaying ? meterLevels.left * 100 : 8) * masterVolume))}%` }}
          />
        </div>

        {/* Master Fader */}
        <div className="flex items-center space-x-1.5">
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.01"
            value={masterVolume}
            onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
            className="w-14 h-1 accent-[#00B0FF] bg-white/10 rounded cursor-pointer"
          />
          <Headphones className="w-3.5 h-3.5 text-slate-400" />
        </div>

        {/* User Session Pill */}
        {user && (
          <div className="flex items-center space-x-2 pl-2 border-l border-white/[0.08]">
            <button
              onClick={onOpenProjectHub}
              className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-colors"
              title={`Logged in as ${user.username} (${user.tier})`}
            >
              <img
                src={user.avatar}
                alt={user.username}
                className="w-4 h-4 rounded-full object-cover border border-blue-400"
              />
              <span className="text-[11px] font-medium text-slate-300 hidden xl:inline max-w-[90px] truncate">
                {user.username}
              </span>
            </button>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded text-xs transition-colors"
                title="Sign Out"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Window Controls */}
        <div className="flex items-center space-x-1 pl-1 border-l border-white/[0.08]">
          <button className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white">
            <Minus className="w-3 h-3" />
          </button>
          <button className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white">
            <Maximize2 className="w-3 h-3" />
          </button>
          <button className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
};
