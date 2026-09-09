import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Radio, Layers, Activity, Eye } from 'lucide-react';
import { StemType, STEM_TYPES, StemState, GestureState, ProcessStatus, TrackMetadata } from './types';
import { AudioGraphEngine } from './engine/audioGraph';
import { GestureTracker, DEFAULT_GESTURE_STATE } from './engine/gestureTracker';

import { GestureHUD } from './components/GestureHUD';
import { MixerDeck } from './components/MixerDeck';
import { VideoPlayer } from './components/VideoPlayer';
import { UrlUploader } from './components/UrlUploader';
import { MasterControls } from './components/MasterControls';

const INITIAL_STEM_STATES: Record<StemType, StemState> = {
  vocals: { volume: 0.85, muted: false, solo: false, pan: 0.0 },
  drums: { volume: 0.90, muted: false, solo: false, pan: 0.0 },
  bass: { volume: 0.80, muted: false, solo: false, pan: 0.0 },
  other: { volume: 0.75, muted: false, solo: false, pan: 0.0 },
};

export const App: React.FC = () => {
  // Audio Engine & Gesture Tracker references
  const audioGraphRef = useRef<AudioGraphEngine | null>(null);
  const gestureTrackerRef = useRef<GestureTracker | null>(null);

  // Studio State
  const [trackMetadata, setTrackMetadata] = useState<TrackMetadata | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(180);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [masterVolume, setMasterVolume] = useState<number>(1.0);
  // Auto-Ducking State
  const [isDucking, setIsDucking] = useState<boolean>(false);
  const [duckingReduction, setDuckingReduction] = useState<number>(1.0);

  // Stems State
  const [stems, setStems] = useState<Record<StemType, StemState>>(INITIAL_STEM_STATES);

  // DJ Filter State
  const [djFilterCutoff, setDjFilterCutoff] = useState<number>(20000);
  const [djFilterType, setDjFilterType] = useState<'lowpass' | 'highpass'>('lowpass');
  const [djFilterQ, setDjFilterQ] = useState<number>(1.0);

  // Vision & Gesture Telemetry State
  const [isGestureEnabled, setIsGestureEnabled] = useState<boolean>(false);
  const [gestureState, setGestureState] = useState<GestureState>(DEFAULT_GESTURE_STATE);
  const [activeStageTab, setActiveStageTab] = useState<'dual' | 'visualizer' | 'hud'>('dual');

  // Processing SSE Status
  const [processStatus, setProcessStatus] = useState<ProcessStatus>({
    stage: 'ready',
    progress: 100,
    message: 'Demucs HT Hybrid Transformer Ready',
  });

  // Initialize AudioGraphEngine and GestureTracker on mount
  useEffect(() => {
    const audioGraph = new AudioGraphEngine();
    audioGraphRef.current = audioGraph;

    const gestureTracker = new GestureTracker();
    gestureTrackerRef.current = gestureTracker;

    // Initialize MediaPipe Vision WASM assets asynchronously
    gestureTracker.initialize().catch((err) => {
      console.warn('GestureTracker initialize background notice:', err);
    });

    // Register onEnded callback
    const unregisterEnded = audioGraph.onEnded(() => {
      setIsPlaying(false);
      setCurrentTime(audioGraph.getCurrentTime());
    });

    return () => {
      unregisterEnded();
      audioGraph.dispose();
      gestureTracker.dispose();
    };
  }, []);

  // Real-time animation playback clock and auto-ducking loop
  useEffect(() => {
    let animId: number;

    const tick = () => {
      const audioGraph = audioGraphRef.current;
      if (audioGraph) {
        if (audioGraph.isPlaying()) {
          setCurrentTime(audioGraph.getCurrentTime());
          setDuration(audioGraph.getDuration() || 180);
          const reduction = audioGraph.updateAutoDucking();
          setDuckingReduction(reduction);
        }
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // Handle gesture telemetry frame updates and apply dynamic audio modulation
  const handleGestureStateChange = useCallback((state: GestureState) => {
    setGestureState(state);
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;

    // 1. Dual Fist Kill Switch
    if (state.isDualFist) {
      audioGraph.setMasterVolume(0.0, 0.02);
      return;
    } else {
      audioGraph.setMasterVolume(masterVolume, 0.05);
    }

    // 2. Left Hand Modulation (Vocals Level & Solo/Mute)
    if (state.leftHand.present) {
      const vocalVol = state.leftHand.height;
      audioGraph.setStemVolume('vocals', vocalVol, 0.04);
      setStems((prev) => ({
        ...prev,
        vocals: {
          ...prev.vocals,
          volume: vocalVol,
          solo: state.leftHand.isPinching,
          muted: state.leftHand.isFist,
        },
      }));
      audioGraph.setStemSolo('vocals', state.leftHand.isPinching, 0.04);
      audioGraph.setStemMute('vocals', state.leftHand.isFist, 0.04);
    }

    // 3. Right Hand Modulation (Instruments Level & DJ Filter Sweep)
    if (state.rightHand.present) {
      const otherVol = state.rightHand.height;
      audioGraph.setStemVolume('other', otherVol, 0.04);
      setStems((prev) => ({
        ...prev,
        other: { ...prev.other, volume: otherVol },
      }));

      // DJ Filter Sweep
      setDjFilterCutoff(state.djFilterCutoff);
      setDjFilterType(state.djFilterType);
      audioGraph.setDjFilter(state.djFilterCutoff, state.djFilterType, djFilterQ, 0.04);
    }
  }, [masterVolume, djFilterQ]);

  // Track Ingestion Handler
  const handleTrackLoaded = async (loadedTrack: TrackMetadata) => {
    setTrackMetadata(loadedTrack);
    setDuration(loadedTrack.duration);

    const audioGraph = audioGraphRef.current;
    if (audioGraph) {
      try {
        await audioGraph.loadStems(loadedTrack.id, loadedTrack.stems);
        // Apply initial stem states
        for (const stem of STEM_TYPES) {
          audioGraph.setStemVolume(stem, stems[stem].volume, 0);
          audioGraph.setStemPan(stem, stems[stem].pan, 0);
          audioGraph.setStemMute(stem, stems[stem].muted, 0);
          audioGraph.setStemSolo(stem, stems[stem].solo, 0);
        }
        audioGraph.setMasterVolume(masterVolume, 0);
        audioGraph.setDjFilter(djFilterCutoff, djFilterType, djFilterQ, 0);
      } catch (err) {
        console.error('Failed to load stems into Web Audio Graph:', err);
      }
    }
  };

  // Play / Pause Toggle
  const handlePlayToggle = async () => {
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;

    if (isPlaying) {
      audioGraph.pause();
      setIsPlaying(false);
    } else {
      await audioGraph.play();
      setIsPlaying(true);
    }
  };

  // Seek Timeline
  const handleSeek = (seconds: number) => {
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;

    audioGraph.seek(seconds);
    setCurrentTime(seconds);
  };

  // Reset to Start
  const handleReset = () => {
    handleSeek(0);
  };

  // Loop Toggle
  const handleLoopToggle = () => {
    const audioGraph = audioGraphRef.current;
    const nextLoop = !isLooping;
    setIsLooping(nextLoop);
    if (audioGraph) {
      audioGraph.setLoop(nextLoop);
    }
  };

  // Auto-Ducking Toggle
  const handleDuckingToggle = () => {
    const audioGraph = audioGraphRef.current;
    const nextDucking = !isDucking;
    setIsDucking(nextDucking);
    if (audioGraph) {
      audioGraph.setDuckingEnabled(nextDucking);
    }
  };

  // Mixer Deck Handlers
  const handleStemVolumeChange = (stem: StemType, val: number) => {
    setStems((prev) => ({
      ...prev,
      [stem]: { ...prev[stem], volume: val },
    }));
    audioGraphRef.current?.setStemVolume(stem, val);
  };

  const handleStemPanChange = (stem: StemType, pan: number) => {
    setStems((prev) => ({
      ...prev,
      [stem]: { ...prev[stem], pan },
    }));
    audioGraphRef.current?.setStemPan(stem, pan);
  };

  const handleStemMuteToggle = (stem: StemType) => {
    setStems((prev) => {
      const nextMuted = !prev[stem].muted;
      audioGraphRef.current?.setStemMute(stem, nextMuted);
      return {
        ...prev,
        [stem]: { ...prev[stem], muted: nextMuted },
      };
    });
  };

  const handleStemSoloToggle = (stem: StemType) => {
    setStems((prev) => {
      const nextSolo = !prev[stem].solo;
      audioGraphRef.current?.setStemSolo(stem, nextSolo);
      return {
        ...prev,
        [stem]: { ...prev[stem], solo: nextSolo },
      };
    });
  };

  const handleMasterVolumeChange = (vol: number) => {
    setMasterVolume(vol);
    audioGraphRef.current?.setMasterVolume(vol);
  };

  const handleDjFilterChange = (cutoff: number, type: 'lowpass' | 'highpass', q: number = djFilterQ) => {
    setDjFilterCutoff(cutoff);
    setDjFilterType(type);
    setDjFilterQ(q);
    audioGraphRef.current?.setDjFilter(cutoff, type, q);
  };

  return (
    <div className="min-h-screen bg-deck-dark text-zinc-100 flex flex-col font-sans selection:bg-white/20">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-deck-border bg-deck-card/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-mono-glow border border-white">
            <Radio className="w-5 h-5 text-black stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400 font-mono">
                WALKOUTS
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-zinc-200 border border-white/20">
                v0.1.0-MONO
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono tracking-tight">
              Real-Time Neural Stem Controller &amp; Gesture DJ
            </p>
          </div>
        </div>

        {/* View Layout Tabs */}
        <div className="flex items-center space-x-1 bg-deck-dark p-1 rounded-xl border border-deck-border text-xs font-mono">
          <button
            onClick={() => setActiveStageTab('dual')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              activeStageTab === 'dual'
                ? 'bg-white text-black font-bold shadow-mono-glow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Dual Stage</span>
          </button>
          <button
            onClick={() => setActiveStageTab('visualizer')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              activeStageTab === 'visualizer'
                ? 'bg-white text-black font-bold shadow-mono-glow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Audio Stage</span>
          </button>
          <button
            onClick={() => setActiveStageTab('hud')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              activeStageTab === 'hud'
                ? 'bg-white text-black font-bold shadow-mono-glow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Vision HUD</span>
          </button>
        </div>
      </header>

      {/* Main Studio Workspace */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1920px] w-full mx-auto">
        {/* Left Column: Media Ingestion & Spatial Vision / Audio Stage */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          {/* Neural Ingestion Slot */}
          <UrlUploader
            onTrackLoaded={handleTrackLoaded}
            onStatusChange={setProcessStatus}
          />

          {/* Dynamic Stage Views (Dual, Visualizer Only, or HUD Only) */}
          {activeStageTab === 'dual' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <VideoPlayer
                audioGraph={audioGraphRef.current}
                trackMetadata={trackMetadata}
                currentTime={currentTime}
                isPlaying={isPlaying}
              />
              <GestureHUD
                gestureTracker={gestureTrackerRef.current}
                gestureState={gestureState}
                onGestureStateChange={handleGestureStateChange}
                isEnabled={isGestureEnabled}
                onToggleEnabled={setIsGestureEnabled}
              />
            </div>
          )}

          {activeStageTab === 'visualizer' && (
            <VideoPlayer
              audioGraph={audioGraphRef.current}
              trackMetadata={trackMetadata}
              currentTime={currentTime}
              isPlaying={isPlaying}
              className="flex-1"
            />
          )}

          {activeStageTab === 'hud' && (
            <GestureHUD
              gestureTracker={gestureTrackerRef.current}
              gestureState={gestureState}
              onGestureStateChange={handleGestureStateChange}
              isEnabled={isGestureEnabled}
              onToggleEnabled={setIsGestureEnabled}
              className="flex-1"
            />
          )}
        </div>

        {/* Right Column: 4-Stem Cyberpunk Mixer Deck */}
        <div className="lg:col-span-5 flex flex-col">
          <MixerDeck
            audioGraph={audioGraphRef.current}
            stemStates={stems}
            masterVolume={masterVolume}
            djFilterCutoff={djFilterCutoff}
            djFilterType={djFilterType}
            djFilterQ={djFilterQ}
            onStemVolumeChange={handleStemVolumeChange}
            onStemMuteToggle={handleStemMuteToggle}
            onStemSoloToggle={handleStemSoloToggle}
            onStemPanChange={handleStemPanChange}
            onMasterVolumeChange={handleMasterVolumeChange}
            onDjFilterChange={handleDjFilterChange}
            className="flex-1"
          />
        </div>
      </main>

      {/* Fixed Bottom Master Transport & Telemetry Bar */}
      <div className="p-6 pt-0 max-w-[1920px] w-full mx-auto">
        <MasterControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          isLooping={isLooping}
          isReady={true}
          audioGraph={audioGraphRef.current}
          isDucking={isDucking}
          duckingReduction={duckingReduction}
          onPlayToggle={handlePlayToggle}
          onSeek={handleSeek}
          onReset={handleReset}
          onLoopToggle={handleLoopToggle}
          onDuckingToggle={handleDuckingToggle}
        />
      </div>

      {/* Global Status Footer */}
      <footer className="h-8 border-t border-deck-border bg-deck-card/90 px-6 flex items-center justify-between text-[11px] font-mono text-zinc-400">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full inline-block ${
                processStatus.stage === 'error' ? 'bg-red-500' : 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]'
              }`}
            />
            <span className="text-zinc-300">Demucs Engine: {processStatus.message}</span>
          </div>
          <span className="text-deck-border">|</span>
          <span>Web Audio Graph: 4-Channel Active</span>
          <span className="text-deck-border">|</span>
          <span className={isDucking ? 'text-white font-semibold' : 'text-zinc-500'}>
            Sidechain Ducking: {isDucking ? 'AUTO' : 'DISABLED'}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <span>Dual Fist Kill Switch: {gestureState.isDualFist ? 'ACTIVE' : 'READY'}</span>
          <span className="text-deck-border">|</span>
          <span className="text-white font-medium">WalkOuts Studio Deck</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
