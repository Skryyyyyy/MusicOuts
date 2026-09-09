import React, { useState } from 'react';
import { 
  Sliders, 
  Video, 
  Activity, 
  Hand, 
  Sparkles, 
  Layers, 
  Volume2, 
  Play, 
  Pause, 
  RotateCcw,
  Youtube,
  Upload,
  Cpu,
  Radio
} from 'lucide-react';
import { StemType, STEM_TYPES, StemState, GestureState, ProcessStatus } from './types';

const INITIAL_STEM_STATES: Record<StemType, StemState> = {
  vocals: { volume: 0.85, muted: false, solo: false, pan: 0.0 },
  drums: { volume: 0.90, muted: false, solo: false, pan: 0.0 },
  bass: { volume: 0.80, muted: false, solo: false, pan: 0.0 },
  other: { volume: 0.75, muted: false, solo: false, pan: 0.0 },
};

const STEM_COLORS: Record<StemType, { text: string; bg: string; border: string; glow: string; accent: string }> = {
  vocals: { 
    text: 'text-neon-cyan', 
    bg: 'bg-cyan-500/10', 
    border: 'border-neon-cyan/40', 
    glow: 'shadow-neon-cyan',
    accent: '#00f3ff' 
  },
  drums: { 
    text: 'text-neon-magenta', 
    bg: 'bg-pink-500/10', 
    border: 'border-neon-magenta/40', 
    glow: 'shadow-neon-magenta',
    accent: '#ff007f' 
  },
  bass: { 
    text: 'text-neon-yellow', 
    bg: 'bg-yellow-500/10', 
    border: 'border-neon-yellow/40', 
    glow: 'shadow-neon-yellow',
    accent: '#ffe600' 
  },
  other: { 
    text: 'text-neon-green', 
    bg: 'bg-emerald-500/10', 
    border: 'border-neon-green/40', 
    glow: 'shadow-neon-green',
    accent: '#00ff66' 
  },
};

export const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime] = useState(0);
  const [duration] = useState(184); // 3:04
  const [stems, setStems] = useState<Record<StemType, StemState>>(INITIAL_STEM_STATES);
  const [activeTab, setActiveTab] = useState<'mixer' | 'camera' | 'hud'>('mixer');

  // Simulated gesture telemetry
  const gestureState: GestureState = {
    leftHand: { present: true, height: 0.75, isPinching: false, isFist: false, x: 0.25, y: 0.35 },
    rightHand: { present: true, height: 0.85, isPinching: true, isFist: false, x: 0.75, y: 0.20 },
    isDualFist: false,
    djFilterCutoff: 18500,
    djFilterType: 'lowpass',
  };

  const processStatus: ProcessStatus = {
    stage: 'ready',
    progress: 100,
    message: 'Demucs 4-Stem Model Ready',
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleVolumeChange = (stem: StemType, val: number) => {
    setStems((prev) => ({
      ...prev,
      [stem]: { ...prev[stem], volume: val },
    }));
  };

  const toggleMute = (stem: StemType) => {
    setStems((prev) => ({
      ...prev,
      [stem]: { ...prev[stem], muted: !prev[stem].muted },
    }));
  };

  const toggleSolo = (stem: StemType) => {
    setStems((prev) => ({
      ...prev,
      [stem]: { ...prev[stem], solo: !prev[stem].solo },
    }));
  };

  return (
    <div className="min-h-screen bg-deck-dark text-slate-100 flex flex-col font-sans selection:bg-neon-cyan/30">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-deck-border bg-deck-card/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-neon-cyan to-neon-magenta flex items-center justify-center shadow-neon-cyan/40 shadow-lg">
            <Radio className="w-5 h-5 text-deck-dark stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan via-slate-100 to-neon-magenta">
                WALKOUTS
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30">
                v0.1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono tracking-tight">
              Real-Time Neural Stem Controller & Gesture DJ
            </p>
          </div>
        </div>

        {/* Global Transport Controls */}
        <div className="flex items-center space-x-4 bg-deck-dark/80 px-4 py-1.5 rounded-full border border-deck-border">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isPlaying 
                ? 'bg-neon-magenta text-white shadow-neon-magenta' 
                : 'bg-neon-cyan text-deck-dark shadow-neon-cyan hover:scale-105'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button className="text-slate-400 hover:text-slate-200 transition-colors">
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="text-xs font-mono text-slate-300">
            <span className="text-neon-cyan">{formatTime(currentTime)}</span>
            <span className="text-slate-500"> / </span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* System Status Indicators */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-deck-dark border border-deck-border">
            <Cpu className="w-3.5 h-3.5 text-neon-green" />
            <span className="text-slate-300">Demucs HT:</span>
            <span className="text-neon-green">CUDA</span>
          </div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-deck-dark border border-deck-border">
            <Activity className="w-3.5 h-3.5 text-neon-cyan" />
            <span className="text-slate-300">Vision:</span>
            <span className="text-neon-cyan">60 FPS</span>
          </div>
        </div>
      </header>

      {/* Main Studio Workspace */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1920px] w-full mx-auto">
        
        {/* Left Column: Media Ingestion & Video/Webcam Stage */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          
          {/* Ingestion Slot */}
          <div className="bg-deck-card border border-deck-border rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-sm font-semibold text-slate-200">
                <Sparkles className="w-4 h-4 text-neon-cyan" />
                <span>Track Ingestion</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">Demucs v4 Neural Stem Separation</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Youtube className="w-4 h-4 text-red-500" />
                </div>
                <input 
                  type="text" 
                  placeholder="Paste YouTube or SoundCloud URL..." 
                  className="w-full pl-9 pr-4 py-2 bg-deck-dark border border-deck-border rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-neon-cyan/60 transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-neon-cyan text-deck-dark font-semibold text-xs rounded-lg hover:bg-cyan-300 transition-colors flex items-center space-x-1.5 shadow-neon-cyan">
                  <span>Process Track</span>
                </button>
                <button className="px-3 py-2 bg-deck-dark hover:bg-deck-hover border border-deck-border text-slate-300 text-xs rounded-lg transition-colors flex items-center space-x-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Vision / Video Stage */}
          <div className="flex-1 bg-deck-card border border-deck-border rounded-xl overflow-hidden shadow-lg flex flex-col min-h-[420px]">
            <div className="px-4 py-3 border-b border-deck-border flex items-center justify-between bg-deck-dark/40">
              <div className="flex items-center space-x-2">
                <Video className="w-4 h-4 text-neon-magenta" />
                <span className="text-sm font-semibold text-slate-200">Spatial Stage & Vision HUD</span>
              </div>
              <div className="flex space-x-1 bg-deck-dark p-0.5 rounded-lg border border-deck-border text-xs">
                <button 
                  onClick={() => setActiveTab('mixer')}
                  className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'mixer' ? 'bg-deck-card text-neon-cyan shadow-sm' : 'text-slate-400'}`}
                >
                  Dual Vision
                </button>
                <button 
                  onClick={() => setActiveTab('camera')}
                  className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'camera' ? 'bg-deck-card text-neon-cyan shadow-sm' : 'text-slate-400'}`}
                >
                  Webcam
                </button>
                <button 
                  onClick={() => setActiveTab('hud')}
                  className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'hud' ? 'bg-deck-card text-neon-cyan shadow-sm' : 'text-slate-400'}`}
                >
                  HUD Only
                </button>
              </div>
            </div>

            {/* Stage Viewport Placeholder */}
            <div className="flex-1 relative bg-black/60 flex items-center justify-center group overflow-hidden">
              {/* Grid Background Effect */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293d15_1px,transparent_1px),linear-gradient(to_bottom,#1f293d15_1px,transparent_1px)] bg-[size:2rem_2rem]" />

              <div className="text-center z-10 p-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-deck-card/90 border border-neon-cyan/40 flex items-center justify-center shadow-neon-cyan/30 shadow-lg">
                  <Hand className="w-8 h-8 text-neon-cyan animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-slate-100">MediaPipe Vision Pipeline Ready</h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1 mx-auto">
                  Position your hands within the camera frame to control vocal height, drum pitch, and DJ filter cutoff in real time.
                </p>
              </div>

              {/* Hand Detection Overlay Badges */}
              <div className="absolute top-4 left-4 bg-deck-dark/80 backdrop-blur-md border border-deck-border rounded-lg p-3 text-xs font-mono space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-neon-cyan animate-ping" />
                  <span className="text-neon-cyan font-bold">LEFT HAND:</span>
                  <span className="text-slate-300">Height {(gestureState.leftHand.height * 100).toFixed(0)}%</span>
                </div>
                <div className="text-[11px] text-slate-400">Target: Vocals Level</div>
              </div>

              <div className="absolute top-4 right-4 bg-deck-dark/80 backdrop-blur-md border border-deck-border rounded-lg p-3 text-xs font-mono space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-neon-magenta animate-ping" />
                  <span className="text-neon-magenta font-bold">RIGHT HAND:</span>
                  <span className="text-slate-300">Height {(gestureState.rightHand.height * 100).toFixed(0)}%</span>
                </div>
                <div className="text-[11px] text-slate-400">Target: Drums Filter (Pinch Active)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 4-Stem Cyberpunk Mixer Deck */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="bg-deck-card border border-deck-border rounded-xl p-5 shadow-lg flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-deck-border mb-4">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-neon-cyan" />
                <span className="text-base font-bold text-slate-100">4-Stem Neural Deck</span>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                <Layers className="w-4 h-4 text-neon-purple" />
                <span>Web Audio API Graph</span>
              </div>
            </div>

            {/* 4 Stem Channels Grid */}
            <div className="grid grid-cols-4 gap-3 flex-1">
              {STEM_TYPES.map((stem) => {
                const color = STEM_COLORS[stem];
                const state = stems[stem];

                return (
                  <div 
                    key={stem} 
                    className={`bg-deck-dark/80 rounded-xl p-3 border ${color.border} flex flex-col items-center justify-between transition-all duration-200 hover:border-opacity-100`}
                  >
                    {/* Header Label */}
                    <div className="text-center w-full">
                      <span className={`text-xs font-extrabold uppercase tracking-wider ${color.text} block`}>
                        {stem}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {(state.volume * 100).toFixed(0)}%
                      </span>
                    </div>

                    {/* Vertical Volume Slider / Meter */}
                    <div className="my-3 flex-1 flex items-center justify-center w-full relative">
                      <div className="h-48 w-6 bg-slate-900 rounded-lg p-1 flex flex-col justify-end border border-deck-border relative overflow-hidden">
                        {/* Fill level */}
                        <div 
                          className={`w-full rounded-sm transition-all duration-75 ${
                            state.muted ? 'bg-slate-700' : color.bg
                          }`}
                          style={{ 
                            height: `${state.muted ? 0 : state.volume * 100}%`,
                            backgroundColor: state.muted ? '#334155' : color.accent 
                          }}
                        />
                        {/* Thumb indicator */}
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={state.muted ? 0 : state.volume}
                          onChange={(e) => handleVolumeChange(stem, parseFloat(e.target.value))}
                          className="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
                        />
                      </div>
                    </div>

                    {/* Channel Controls (Mute / Solo) */}
                    <div className="flex flex-col gap-1.5 w-full">
                      <button
                        onClick={() => toggleMute(stem)}
                        className={`w-full py-1 text-[11px] font-mono font-bold rounded transition-colors ${
                          state.muted 
                            ? 'bg-red-500/20 text-red-400 border border-red-500/50' 
                            : 'bg-deck-card text-slate-400 hover:text-slate-200 border border-deck-border'
                        }`}
                      >
                        MUTE
                      </button>
                      <button
                        onClick={() => toggleSolo(stem)}
                        className={`w-full py-1 text-[11px] font-mono font-bold rounded transition-colors ${
                          state.solo 
                            ? 'bg-neon-yellow/20 text-neon-yellow border border-neon-yellow/50' 
                            : 'bg-deck-card text-slate-400 hover:text-slate-200 border border-deck-border'
                        }`}
                      >
                        SOLO
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DJ Filter & Master Strip */}
            <div className="mt-4 pt-4 border-t border-deck-border bg-deck-dark/40 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-neon-cyan" />
                  <span className="text-slate-300">Dual-Fist DJ Filter:</span>
                </div>
                <span className="text-neon-cyan font-bold">
                  {gestureState.djFilterCutoff} Hz ({gestureState.djFilterType.toUpperCase()})
                </span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full mt-2 overflow-hidden border border-deck-border">
                <div 
                  className="h-full bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-yellow"
                  style={{ width: `${(gestureState.djFilterCutoff / 20000) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Global Status Bar */}
      <footer className="h-9 border-t border-deck-border bg-deck-card/90 px-6 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-green inline-block" />
            <span className="text-slate-300">Status: {processStatus.message}</span>
          </div>
          <span className="text-deck-border">|</span>
          <span>Audio Latency: 12ms</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>Dual Fist Quick-Drop: READY</span>
          <span className="text-deck-border">|</span>
          <span className="text-neon-cyan">WalkOuts Studio Engine</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
