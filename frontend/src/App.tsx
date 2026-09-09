import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  StemType,
  STEM_TYPES,
  StemState,
  GestureState,
  ProcessStatus,
  TrackMetadata,
  StudioView,
  HardwareInfo,
} from "./types";
import { AudioGraphEngine } from "./engine/audioGraph";
import { GestureTracker, DEFAULT_GESTURE_STATE } from "./engine/gestureTracker";

import { DawTransport } from "./components/DawTransport";
import { ArrangementView } from "./components/ArrangementView";
import { MixConsoleView } from "./components/views/MixConsoleView";
import { GestureLabView } from "./components/views/GestureLabView";
import { VisualStageView } from "./components/views/VisualStageView";
import { DemixLabView } from "./components/views/DemixLabView";
import { StudioGuideModal } from "./components/StudioGuideModal";
import { VirtualSynth } from "./components/VirtualSynth";
import { ChevronDown, ChevronUp, Music } from "lucide-react";

const INITIAL_STEM_STATES: Record<StemType, StemState> = {
  vocals: { volume: 0.85, muted: false, solo: false, pan: 0.0 },
  drums: { volume: 0.90, muted: false, solo: false, pan: 0.0 },
  bass: { volume: 0.80, muted: false, solo: false, pan: 0.0 },
  other: { volume: 0.75, muted: false, solo: false, pan: 0.0 },
};

export const App: React.FC = () => {
  // Navigation & Workspace View State
  const [currentView, setCurrentView] = useState<StudioView>("arrangement");
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isFooterCollapsed, setIsFooterCollapsed] = useState<boolean>(false);
  const [showSynth, setShowSynth] = useState<boolean>(false);

  // Real Hardware Detection State
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);

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
  const [djFilterType, setDjFilterType] = useState<"lowpass" | "highpass">("lowpass");
  const [djFilterQ, setDjFilterQ] = useState<number>(1.0);

  // Vision & Gesture Telemetry State
  const [isGestureEnabled, setIsGestureEnabled] = useState<boolean>(false);
  const [gestureState, setGestureState] = useState<GestureState>(DEFAULT_GESTURE_STATE);

  // Stems Loading & Processing SSE Status
  const [isLoadingStems, setIsLoadingStems] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<ProcessStatus>({
    stage: "ready",
    progress: 100,
    message: "Demucs HT Hybrid Transformer Ready",
  });

  // Fetch real hardware info dynamically on startup
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.device_info) {
          setHardwareInfo(data.device_info);
        }
      })
      .catch((err) => {
        console.warn("Hardware info detection note:", err);
      });
  }, []);

  // Initialize AudioGraphEngine and GestureTracker on mount
  useEffect(() => {
    const audioGraph = new AudioGraphEngine();
    audioGraphRef.current = audioGraph;

    const gestureTracker = new GestureTracker();
    gestureTrackerRef.current = gestureTracker;

    // Initialize MediaPipe Vision WASM assets asynchronously
    gestureTracker.initialize().catch((err) => {
      console.warn("GestureTracker initialize background notice:", err);
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
  const handleGestureStateChange = useCallback(
    (state: GestureState) => {
      setGestureState(state);
      const audioGraph = audioGraphRef.current;
      if (!audioGraph) return;

      // 1. Dual Fist Kill Switch (with 350ms hold delay)
      if (state.isDualFist) {
        audioGraph.setMasterVolume(0.0, 0.02);
        return;
      } else {
        audioGraph.setMasterVolume(masterVolume, 0.05);
      }

      // 2. Left Hand Modulation (Vocals Level & Solo/Mute)
      if (state.leftHand.present) {
        const vocalVol = state.leftHand.height;
        audioGraph.setStemVolume("vocals", vocalVol, 0.04);
        setStems((prev) => ({
          ...prev,
          vocals: {
            ...prev.vocals,
            volume: vocalVol,
            solo: state.leftHand.isPinching,
            muted: state.leftHand.isFist,
          },
        }));
        audioGraph.setStemSolo("vocals", state.leftHand.isPinching, 0.04);
        audioGraph.setStemMute("vocals", state.leftHand.isFist, 0.04);
      }

      // 3. Right Hand Modulation (Instruments Level & DJ Filter Sweep)
      if (state.rightHand.present) {
        const otherVol = state.rightHand.height;
        audioGraph.setStemVolume("other", otherVol, 0.04);
        setStems((prev) => ({
          ...prev,
          other: { ...prev.other, volume: otherVol },
        }));

        // DJ Filter Sweep
        setDjFilterCutoff(state.djFilterCutoff);
        setDjFilterType(state.djFilterType);
        audioGraph.setDjFilter(state.djFilterCutoff, state.djFilterType, djFilterQ, 0.04);
      }
    },
    [masterVolume, djFilterQ]
  );

  // Track Ingestion Handler (Demucs AI finishes separation)
  const handleTrackLoaded = async (loadedTrack: TrackMetadata) => {
    setTrackMetadata(loadedTrack);
    setDuration(loadedTrack.duration);
    setIsLoadingStems(true);

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
        setIsLoadingStems(false);

        // Auto-start playback on ready so audio plays immediately!
        await audioGraph.play();
        setIsPlaying(true);
        setCurrentView("arrangement");
      } catch (err) {
        console.error("Failed to load stems into Web Audio Graph:", err);
        setIsLoadingStems(false);
      }
    } else {
      setIsLoadingStems(false);
    }
  };

  // Play / Pause Toggle
  const handlePlayToggle = async () => {
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;

    if (!trackMetadata) {
      setCurrentView("ingestion");
      setProcessStatus({
        stage: "ready",
        progress: 0,
        message: "Please paste a YouTube URL or drop an audio file in the Demix Lab to begin!",
      });
      return;
    }

    if (isPlaying) {
      audioGraph.pause();
      setIsPlaying(false);
    } else {
      await audioGraph.play();
      setIsPlaying(true);
    }
  };

  // Stop Playback
  const handleStop = () => {
    const audioGraph = audioGraphRef.current;
    if (audioGraph) {
      audioGraph.pause();
      audioGraph.seek(0);
      setIsPlaying(false);
      setCurrentTime(0);
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

  const handleDjFilterChange = (cutoff: number, type: "lowpass" | "highpass", q: number = djFilterQ) => {
    setDjFilterCutoff(cutoff);
    setDjFilterType(type);
    setDjFilterQ(q);
    audioGraphRef.current?.setDjFilter(cutoff, type, q);
  };

  // Keyboard Shortcuts Navigation (1-5 for workspaces, Space for Play/Pause, L for Loop, Home for Reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (e.key) {
        case "1":
          setCurrentView("arrangement");
          break;
        case "2":
          setCurrentView("mixer");
          break;
        case "3":
          setCurrentView("gesture");
          break;
        case "4":
          setCurrentView("visualizer");
          break;
        case "5":
          setCurrentView("ingestion");
          break;
        case " ":
          e.preventDefault();
          handlePlayToggle();
          break;
        case "l":
        case "L":
          handleLoopToggle();
          break;
        case "Home":
        case "r":
        case "R":
          handleReset();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isReadyCheck(), isLooping, trackMetadata]);

  function isReadyCheck() {
    return trackMetadata !== null && !isLoadingStems && processStatus.stage !== "downloading" && processStatus.stage !== "separating";
  }

  return (
    <div className="min-h-screen bg-[#0e0f12] text-zinc-100 flex flex-col font-sans selection:bg-cyan-500/20 select-none">
      {/* 1. Omnipresent Top Studio Transport & Workspace Navigator */}
      <DawTransport
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        isLooping={isLooping}
        isReady={trackMetadata !== null && !isLoadingStems && processStatus.stage !== "downloading" && processStatus.stage !== "separating"}
        isLoadingStems={isLoadingStems}
        processStatus={processStatus}
        masterVolume={masterVolume}
        djFilterCutoff={djFilterCutoff}
        djFilterType={djFilterType}
        isDucking={isDucking}
        duckingReduction={duckingReduction}
        audioGraph={audioGraphRef.current}
        currentView={currentView}
        hardwareInfo={hardwareInfo}
        onViewChange={setCurrentView}
        onOpenGuide={() => setIsGuideOpen(true)}
        onPlayToggle={handlePlayToggle}
        onStop={handleStop}
        onSeek={handleSeek}
        onReset={handleReset}
        onLoopToggle={handleLoopToggle}
        onDuckingToggle={handleDuckingToggle}
        onMasterVolumeChange={handleMasterVolumeChange}
        onDjFilterChange={handleDjFilterChange}
      />

      {/* 2. Main Studio Workspace (Dedicated Page Views) */}
      <main className="flex-1 p-3 flex flex-col max-w-[1920px] w-full mx-auto overflow-hidden relative">
        {/* Page 1: Multi-track Arrangement Window */}
        <div className={`flex-1 h-full min-h-[500px] flex flex-col gap-2 ${currentView === "arrangement" ? "block" : "hidden"}`}>
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-2 text-xs font-mono text-zinc-400">
              <span className="text-zinc-200 font-bold">{trackMetadata ? trackMetadata.title : "No Project Audio Loaded"}</span>
              {trackMetadata && <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">120 BPM • 4/4 • A Minor</span>}
            </div>
            <button
              onClick={() => setShowSynth(!showSynth)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition-all flex items-center space-x-1.5 ${
                showSynth
                  ? "bg-cyan-600 text-white border-cyan-400 shadow-sm"
                  : "bg-[#181920] text-zinc-400 border-[#262830] hover:text-white"
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>{showSynth ? "HIDE SYNTH PIANO ROLL" : "OPEN VIRTUAL SYNTH"}</span>
            </button>
          </div>

          {showSynth && (
            <VirtualSynth audioGraph={audioGraphRef.current} />
          )}

          <ArrangementView
            audioGraph={audioGraphRef.current}
            trackMetadata={trackMetadata}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            isLooping={isLooping}
            stemStates={stems}
            gestureState={gestureState}
            onSeek={handleSeek}
            onStemVolumeChange={handleStemVolumeChange}
            onStemMuteToggle={handleStemMuteToggle}
            onStemSoloToggle={handleStemSoloToggle}
            onStemPanChange={handleStemPanChange}
            className="flex-1 min-h-[420px]"
          />
        </div>

        {/* Page 2: Full Studio MixConsole Desk */}
        <div className={`flex-1 h-full min-h-[500px] flex flex-col ${currentView === "mixer" ? "block" : "hidden"}`}>
          <MixConsoleView
            audioGraph={audioGraphRef.current}
            stemStates={stems}
            masterVolume={masterVolume}
            djFilterCutoff={djFilterCutoff}
            djFilterType={djFilterType}
            djFilterQ={djFilterQ}
            isDucking={isDucking}
            duckingReduction={duckingReduction}
            onStemVolumeChange={handleStemVolumeChange}
            onStemMuteToggle={handleStemMuteToggle}
            onStemSoloToggle={handleStemSoloToggle}
            onStemPanChange={handleStemPanChange}
            onMasterVolumeChange={handleMasterVolumeChange}
            onDjFilterChange={handleDjFilterChange}
            onDuckingToggle={handleDuckingToggle}
            className="flex-1 h-full min-h-[500px]"
          />
        </div>

        {/* Page 3: Vision AI & Gesture Lab */}
        <div className={`flex-1 h-full min-h-[500px] flex flex-col ${currentView === "gesture" ? "block" : "hidden"}`}>
          <GestureLabView
            gestureTracker={gestureTrackerRef.current}
            gestureState={gestureState}
            isGestureEnabled={isGestureEnabled}
            onToggleGestureEnabled={setIsGestureEnabled}
            onGestureStateChange={handleGestureStateChange}
            className="flex-1 h-full min-h-[500px]"
          />
        </div>

        {/* Page 4: Audio-Reactive Visual Stage */}
        <div className={`flex-1 h-full min-h-[500px] flex flex-col ${currentView === "visualizer" ? "block" : "hidden"}`}>
          <VisualStageView
            audioGraph={audioGraphRef.current}
            trackMetadata={trackMetadata}
            currentTime={currentTime}
            isPlaying={isPlaying}
            className="flex-1 h-full min-h-[500px]"
          />
        </div>

        {/* Page 5: Neural Demixing & Media Ingestion Lab */}
        <div className={`flex-1 h-full min-h-[500px] flex flex-col ${currentView === "ingestion" ? "block" : "hidden"}`}>
          <DemixLabView
            trackMetadata={trackMetadata}
            processStatus={processStatus}
            hardwareInfo={hardwareInfo}
            onTrackLoaded={handleTrackLoaded}
            onStatusChange={setProcessStatus}
            className="flex-1 h-full min-h-[500px]"
          />
        </div>
      </main>

      {/* 3. Studio Status Bar Footer (Collapsible) */}
      <footer
        className={`border-t border-[#262830] bg-[#17181d] px-3 flex items-center justify-between text-[10px] font-mono text-zinc-400 select-none transition-all ${
          isFooterCollapsed ? "h-3 overflow-hidden py-0" : "h-6 py-0"
        }`}
      >
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsFooterCollapsed(!isFooterCollapsed)}
            className="text-zinc-500 hover:text-white"
            title={isFooterCollapsed ? "Expand Footer" : "Collapse Footer"}
          >
            {isFooterCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {!isFooterCollapsed && (
            <>
              <div className="flex items-center space-x-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full inline-block ${
                    processStatus.stage === "error" ? "bg-red-500" : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                  }`}
                />
                <span className="text-zinc-300">Demucs Engine: {processStatus.message}</span>
              </div>
              <span className="text-zinc-700">|</span>
              <span>Web Audio DSP: 4-Track 64-bit Flow</span>
              <span className="text-zinc-700">|</span>
              <span className={isDucking ? "text-purple-400 font-semibold" : "text-zinc-500"}>
                Sidechain Ducking: {isDucking ? "ACTIVE" : "OFF"}
              </span>
            </>
          )}
        </div>
        {!isFooterCollapsed && (
          <div className="flex items-center space-x-3">
            <span>Active View: <strong className="text-cyan-300 uppercase">{currentView}</strong></span>
            <span className="text-zinc-700">|</span>
            <span>Dual Fist Kill Switch: {gestureState.isDualFist ? "ACTIVE" : "READY"}</span>
            <span className="text-zinc-700">|</span>
            <span className="text-cyan-400 font-medium">MusicOuts Pro DAW</span>
          </div>
        )}
      </footer>

      {/* 4. Studio Guide & Onboarding Modal */}
      <StudioGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};

export default App;
