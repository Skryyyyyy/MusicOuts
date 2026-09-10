import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  StemType,
  STEM_TYPES,
  StemState,
  GestureState,
  ProcessStatus,
  TrackMetadata,
  StudioView,
  StudioMode,
  HardwareInfo,
  FxRackState,
  DEFAULT_FX_RACK_STATE,
  PerformanceSession,
  MusicOutsProject,
} from "./types";
import { AudioGraphEngine } from "./engine/audioGraph";
import { GestureTracker, DEFAULT_GESTURE_STATE } from "./engine/gestureTracker";
import { AutomationManager, PerformanceCaptureTracker } from "./engine/automationEngine";
import { saveProjectToFile, loadProjectFromFile } from "./engine/projectManager";

import { DawTransport } from "./components/DawTransport";
import { ArrangementView } from "./components/ArrangementView";
import { MixConsoleView } from "./components/views/MixConsoleView";
import { FxRackView } from "./components/views/FxRackView";
import { GestureLabView } from "./components/views/GestureLabView";
import { VisualStageView } from "./components/views/VisualStageView";
import { DemixLabView } from "./components/views/DemixLabView";
import { StudioGuideModal } from "./components/StudioGuideModal";
import { CapturePerformanceModal } from "./components/CapturePerformanceModal";
import { VirtualSynth } from "./components/VirtualSynth";
import { ChevronDown, ChevronUp, Music } from "lucide-react";

const INITIAL_STEM_STATES: Record<StemType, StemState> = {
  vocals: { volume: 0.85, muted: false, solo: false, pan: 0.0 },
  drums: { volume: 0.90, muted: false, solo: false, pan: 0.0 },
  bass: { volume: 0.80, muted: false, solo: false, pan: 0.0 },
  other: { volume: 0.75, muted: false, solo: false, pan: 0.0 },
};

export const App: React.FC = () => {
  // Mode & Workspace View State
  const [currentView, setCurrentView] = useState<StudioView>("arrangement");
  const [mode, setMode] = useState<StudioMode>("producer");
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isFooterCollapsed, setIsFooterCollapsed] = useState<boolean>(false);
  const [showSynth, setShowSynth] = useState<boolean>(false);
  const [showAutomation, setShowAutomation] = useState<boolean>(true);

  // Real Hardware Detection State
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);

  // Audio Engine & Vision & Automation references
  const audioGraphRef = useRef<AudioGraphEngine | null>(null);
  const gestureTrackerRef = useRef<GestureTracker | null>(null);
  const automationManagerRef = useRef<AutomationManager>(new AutomationManager());
  const performanceTrackerRef = useRef<PerformanceCaptureTracker>(new PerformanceCaptureTracker());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Stems & FX Rack State
  const [stems, setStems] = useState<Record<StemType, StemState>>(INITIAL_STEM_STATES);
  const [fxRackState, setFxRackState] = useState<FxRackState>(DEFAULT_FX_RACK_STATE);

  // Multi-Song Pool & DAW Audio Clips State
  const [songs, setSongs] = useState<import("./types").SongItem[]>([]);
  const [clips, setClips] = useState<import("./types").AudioClip[]>([]);

  // Automation & Performance Capture State
  const [isRecordingAutomation, setIsRecordingAutomation] = useState<boolean>(false);
  const [isCapturingPerformance, setIsCapturingPerformance] = useState<boolean>(false);
  const [captureSession, setCaptureSession] = useState<PerformanceSession | null>(null);

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

    gestureTracker.initialize().catch((err) => {
      console.warn("GestureTracker initialize background notice:", err);
    });

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

  // Real-time animation playback clock, auto-ducking loop, and automation evaluation
  useEffect(() => {
    let animId: number;

    const tick = () => {
      const audioGraph = audioGraphRef.current;
      if (audioGraph) {
        if (audioGraph.isPlaying()) {
          const t = audioGraph.getCurrentTime();
          setCurrentTime(t);
          setDuration(audioGraph.getDuration() || 180);

          const reduction = audioGraph.updateSidechainDucking();
          setDuckingReduction(reduction);

          // Apply Automation Playback if not currently recording
          if (!isRecordingAutomation && showAutomation) {
            const autoValues = automationManagerRef.current.evaluateAt(t);
            for (const [target, val] of Object.entries(autoValues)) {
              audioGraph.applyAutomationPoint(target, val);
            }
          }
        }
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isRecordingAutomation, showAutomation]);

  // Handle gesture telemetry frame updates and apply dynamic audio modulation & automation recording
  const handleGestureStateChange = useCallback(
    (state: GestureState) => {
      setGestureState(state);
      const audioGraph = audioGraphRef.current;
      if (!audioGraph) return;

      const t = audioGraph.getCurrentTime();

      // 1. Dual Fist Kill Switch (with 350ms hold delay)
      if (state.isDualFist) {
        audioGraph.setMasterVolume(0.0, 0.02);
        if (isRecordingAutomation) {
          automationManagerRef.current.recordPoint(t, "master.volume", 0.0);
        }
        if (isCapturingPerformance) {
          performanceTrackerRef.current.logEvent(t, "gesture", { killSwitch: true });
        }
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

        if (isRecordingAutomation) {
          automationManagerRef.current.recordPoint(t, "vocals.volume", vocalVol);
        }
        if (isCapturingPerformance) {
          performanceTrackerRef.current.logEvent(t, "gesture", {
            hand: "left",
            height: vocalVol,
            pinch: state.leftHand.isPinching,
            fist: state.leftHand.isFist,
          });
        }
      }

      // 3. Right Hand Modulation (Instruments Level & DJ Filter Sweep)
      if (state.rightHand.present) {
        const otherVol = state.rightHand.height;
        audioGraph.setStemVolume("other", otherVol, 0.04);
        setStems((prev) => ({
          ...prev,
          other: { ...prev.other, volume: otherVol },
        }));

        setDjFilterCutoff(state.djFilterCutoff);
        setDjFilterType(state.djFilterType);
        audioGraph.setDjFilter(state.djFilterCutoff, state.djFilterType, djFilterQ, 0.04);

        if (isRecordingAutomation) {
          automationManagerRef.current.recordPoint(t, "other.volume", otherVol);
          automationManagerRef.current.recordPoint(t, "master.djFilterCutoff", state.djFilterCutoff);
        }
        if (isCapturingPerformance) {
          performanceTrackerRef.current.logEvent(t, "gesture", {
            hand: "right",
            height: otherVol,
            filterCutoff: state.djFilterCutoff,
            filterType: state.djFilterType,
          });
        }
      }
    },
    [masterVolume, djFilterQ, isRecordingAutomation, isCapturingPerformance]
  );

  // Track Ingestion Handler (Demucs AI finishes separation)
  const handleTrackLoaded = async (loadedTrack: TrackMetadata) => {
    setTrackMetadata(loadedTrack);
    setDuration(loadedTrack.duration);
    setIsLoadingStems(true);

    const songColors = ["#00bcd4", "#ff7043", "#ab47bc", "#4caf50", "#e91e63", "#ffeb3b"];
    const songColor = songColors[songs.length % songColors.length];

    const newSong: import("./types").SongItem = {
      id: loadedTrack.id,
      title: loadedTrack.title,
      duration: loadedTrack.duration,
      stems: loadedTrack.stems,
      color: songColor,
      bpm: 120,
      key: "A minor",
    };

    setSongs((prev) => {
      const exists = prev.some((s) => s.id === newSong.id);
      return exists ? prev : [...prev, newSong];
    });

    const audioGraph = audioGraphRef.current;
    if (audioGraph) {
      try {
        await audioGraph.loadSongStems(loadedTrack.id, loadedTrack.stems);
        await audioGraph.loadStems(loadedTrack.id, loadedTrack.stems);

        // Generate 4 initial track clips if no clips exist or append them
        const newClips: import("./types").AudioClip[] = STEM_TYPES.map((stem) => ({
          id: `clip_${loadedTrack.id}_${stem}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          songId: loadedTrack.id,
          songTitle: loadedTrack.title,
          stem,
          startTime: 0,
          sourceOffset: 0,
          duration: loadedTrack.duration,
          gain: 1.0,
          muted: false,
          name: `${loadedTrack.title.substring(0, 14)} [${stem.toUpperCase()}]`,
          color: songColor,
        }));

        setClips((prev) => {
          const updated = [...prev, ...newClips];
          audioGraph.setClips(updated);
          return updated;
        });

        for (const stem of STEM_TYPES) {
          audioGraph.setStemVolume(stem, stems[stem].volume, 0);
          audioGraph.setStemPan(stem, stems[stem].pan, 0);
          audioGraph.setStemMute(stem, stems[stem].muted, 0);
          audioGraph.setStemSolo(stem, stems[stem].solo, 0);
          audioGraph.setStemFxRackState(stem, fxRackState[stem]);
        }
        audioGraph.setMasterVolume(masterVolume, 0);
        audioGraph.setDjFilter(djFilterCutoff, djFilterType, djFilterQ, 0);
        setIsLoadingStems(false);

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

  // DAW Audio Clip Manipulation Handlers
  const handleSliceClip = (clipId: string, time: number) => {
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;
    const res = audioGraph.sliceClip(clipId, time);
    if (res) {
      setClips([...audioGraph.getClips()]);
    }
  };

  const handleTrimClip = (clipId: string, newStartOffset: number, newDuration: number) => {
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;
    audioGraph.trimClip(clipId, newStartOffset, newDuration);
    setClips([...audioGraph.getClips()]);
  };

  const handleMoveClip = (clipId: string, newStartTime: number) => {
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;
    audioGraph.moveClip(clipId, newStartTime);
    setClips([...audioGraph.getClips()]);
  };

  const handleDuplicateClip = (clipId: string) => {
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;
    const dup = audioGraph.duplicateClip(clipId);
    if (dup) {
      setClips([...audioGraph.getClips()]);
    }
  };

  const handleDeleteClip = (clipId: string) => {
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;
    audioGraph.deleteClip(clipId);
    setClips([...audioGraph.getClips()]);
  };

  const handleAddClip = (songId: string, stem: StemType) => {
    const targetSong = songs.find((s) => s.id === songId);
    if (!targetSong) return;

    const audioGraph = audioGraphRef.current;
    const playheadTime = audioGraph ? audioGraph.getCurrentTime() : currentTime;

    const newClip: import("./types").AudioClip = {
      id: `clip_${songId}_${stem}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      songId: targetSong.id,
      songTitle: targetSong.title,
      stem,
      startTime: playheadTime,
      sourceOffset: 0,
      duration: Math.min(30, targetSong.duration),
      gain: 1.0,
      muted: false,
      name: `${targetSong.title.substring(0, 12)} [${stem.toUpperCase()}]`,
      color: targetSong.color || "#00bcd4",
    };

    setClips((prev) => {
      const updated = [...prev, newClip];
      audioGraphRef.current?.setClips(updated);
      return updated;
    });
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

    if (isRecordingAutomation) {
      const t = audioGraphRef.current?.getCurrentTime() || 0;
      automationManagerRef.current.recordPoint(t, `${stem}.volume`, val);
    }
    if (isCapturingPerformance) {
      const t = audioGraphRef.current?.getCurrentTime() || 0;
      performanceTrackerRef.current.logEvent(t, "fader", { stem, volume: val });
    }
  };

  const handleStemPanChange = (stem: StemType, pan: number) => {
    setStems((prev) => ({
      ...prev,
      [stem]: { ...prev[stem], pan },
    }));
    audioGraphRef.current?.setStemPan(stem, pan);

    if (isRecordingAutomation) {
      const t = audioGraphRef.current?.getCurrentTime() || 0;
      automationManagerRef.current.recordPoint(t, `${stem}.pan`, pan);
    }
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

    if (isRecordingAutomation) {
      const t = audioGraphRef.current?.getCurrentTime() || 0;
      automationManagerRef.current.recordPoint(t, "master.djFilterCutoff", cutoff);
    }
    if (isCapturingPerformance) {
      const t = audioGraphRef.current?.getCurrentTime() || 0;
      performanceTrackerRef.current.logEvent(t, "filter", { cutoff, type, q });
    }
  };

  // FX Rack Change Handler
  const handleStemFxChange = (stem: StemType, newFxState: typeof DEFAULT_FX_RACK_STATE['vocals']) => {
    setFxRackState((prev) => ({
      ...prev,
      [stem]: newFxState,
    }));
    if (isCapturingPerformance) {
      const t = audioGraphRef.current?.getCurrentTime() || 0;
      performanceTrackerRef.current.logEvent(t, "fx", { stem, fx: newFxState });
    }
  };

  // Automation Recording Toggle
  const handleToggleRecordAutomation = () => {
    const nextRec = !isRecordingAutomation;
    setIsRecordingAutomation(nextRec);
    automationManagerRef.current.setRecording(nextRec);
  };

  // Performance Capture Toggle
  const buildCurrentProjectSnapshot = (): MusicOutsProject => {
    return {
      version: "1.1",
      title: trackMetadata?.title || "MusicOuts_Project",
      trackId: trackMetadata?.id || "demo",
      duration: duration,
      bpm: 120,
      key: "A minor",
      timeSignature: "4/4",
      mode: mode,
      stemStates: stems,
      fxRack: fxRackState,
      masterVolume: masterVolume,
      djFilterCutoff: djFilterCutoff,
      djFilterType: djFilterType,
      isDucking: isDucking,
      markers: [],
      automation: automationManagerRef.current.getPoints(),
      created: new Date().toISOString(),
    };
  };

  const handleToggleCapturePerformance = () => {
    if (!isCapturingPerformance) {
      // Start capture
      setIsCapturingPerformance(true);
      const snapshot = buildCurrentProjectSnapshot();
      performanceTrackerRef.current.startCapture(snapshot);
      if (!isPlaying) {
        handlePlayToggle();
      }
    } else {
      // Stop capture and open modal
      setIsCapturingPerformance(false);
      const snapshot = buildCurrentProjectSnapshot();
      const session = performanceTrackerRef.current.stopCapture(snapshot);
      if (session) {
        setCaptureSession(session);
      }
    }
  };

  // Save Project Action (.musicouts)
  const handleSaveProject = () => {
    const project = buildCurrentProjectSnapshot();
    saveProjectToFile(project);
  };

  // Open Project Action
  const handleOpenProjectClick = () => {
    fileInputRef.current?.click();
  };

  const handleProjectFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const project = await loadProjectFromFile(file);
      if (project.stemStates) setStems(project.stemStates);
      if (project.fxRack) {
        setFxRackState(project.fxRack);
        if (audioGraphRef.current) {
          for (const s of STEM_TYPES) {
            audioGraphRef.current.setStemFxRackState(s, project.fxRack[s]);
          }
        }
      }
      if (project.masterVolume !== undefined) setMasterVolume(project.masterVolume);
      if (project.djFilterCutoff !== undefined) setDjFilterCutoff(project.djFilterCutoff);
      if (project.djFilterType) setDjFilterType(project.djFilterType);
      if (project.mode) setMode(project.mode);
      if (project.automation) automationManagerRef.current.setPoints(project.automation);

      alert(`Loaded Project "${project.title}" successfully!`);
    } catch (err) {
      alert(`Error loading project: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      e.target.value = "";
    }
  };

  // Play Performance Take
  const handlePlayTake = (session: PerformanceSession) => {
    setCaptureSession(null);
    if (session.projectSnapshot?.automation) {
      automationManagerRef.current.setPoints(session.projectSnapshot.automation);
    }
    handleSeek(0);
    if (!isPlaying) {
      handlePlayToggle();
    }
  };

  // Keyboard Shortcuts Navigation
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
          setCurrentView("fxrack");
          break;
        case "4":
          setCurrentView("gesture");
          break;
        case "5":
          setCurrentView("visualizer");
          break;
        case "6":
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
    <div className="min-h-screen bg-[#08090F] text-[#E4E4F0] flex flex-col font-sans selection:bg-violet-500/20 select-none">
      {/* Hidden File Input for Open Project */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleProjectFileSelected}
        accept=".musicouts,.json"
        className="hidden"
      />

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
        mode={mode}
        hardwareInfo={hardwareInfo}
        isRecordingAutomation={isRecordingAutomation}
        isCapturingPerformance={isCapturingPerformance}
        isSynthOpen={showSynth}
        onModeChange={setMode}
        onViewChange={setCurrentView}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenSynth={() => setShowSynth(!showSynth)}
        onSaveProject={handleSaveProject}
        onOpenProject={handleOpenProjectClick}
        onToggleRecordAutomation={handleToggleRecordAutomation}
        onToggleCapturePerformance={handleToggleCapturePerformance}
        onPlayToggle={handlePlayToggle}
        onStop={handleStop}
        onSeek={handleSeek}
        onReset={handleReset}
        onLoopToggle={handleLoopToggle}
        onDuckingToggle={handleDuckingToggle}
        onMasterVolumeChange={handleMasterVolumeChange}
        onDjFilterChange={handleDjFilterChange}
      />

      {/* 2. Main Studio Workspace (Persistent Cached Page Views) */}
      <main className="flex-1 p-3 flex flex-col max-w-[1920px] w-full mx-auto overflow-hidden relative">
        {/* Page 1: Multi-track Arrangement Window */}
        <div className={`flex-1 h-full min-h-[500px] flex flex-col gap-2 ${currentView === "arrangement" ? "block" : "hidden"}`}>
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-2 text-xs font-mono text-zinc-400">
              <span className="text-zinc-200 font-bold">{trackMetadata ? trackMetadata.title : "No Project Audio Loaded"}</span>
              {trackMetadata && <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-500/10 text-violet-300 border border-violet-500/25">120 BPM • 4/4 • A Minor</span>}
            </div>
            <button
              onClick={() => setShowSynth(!showSynth)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition-all flex items-center space-x-1.5 ${
                showSynth
                  ? "bg-violet-600 text-white border-violet-400 shadow-[0_0_12px_rgba(124,58,237,0.5)]"
                  : "bg-[#0e0c1c] text-violet-200/50 border-[#2D1B69]/50 hover:text-white"
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
            automationPoints={automationManagerRef.current.getPoints()}
            showAutomation={showAutomation}
            clips={clips}
            songs={songs}
            onToggleAutomation={() => setShowAutomation(!showAutomation)}
            onSeek={handleSeek}
            onStemVolumeChange={handleStemVolumeChange}
            onStemMuteToggle={handleStemMuteToggle}
            onStemSoloToggle={handleStemSoloToggle}
            onStemPanChange={handleStemPanChange}
            onSliceClip={handleSliceClip}
            onTrimClip={handleTrimClip}
            onMoveClip={handleMoveClip}
            onDuplicateClip={handleDuplicateClip}
            onDeleteClip={handleDeleteClip}
            onAddClip={handleAddClip}
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

        {/* Page 3: 5-Insert FX Rack View */}
        <div className={`flex-1 h-full min-h-[500px] flex flex-col ${currentView === "fxrack" ? "block" : "hidden"}`}>
          <FxRackView
            audioGraph={audioGraphRef.current}
            fxRackState={fxRackState}
            onFxChange={handleStemFxChange}
            className="flex-1 h-full min-h-[500px]"
          />
        </div>

        {/* Page 4: Vision AI & Gesture Lab */}
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

        {/* Page 5: Audio-Reactive Visual Stage */}
        <div className={`flex-1 h-full min-h-[500px] flex flex-col ${currentView === "visualizer" ? "block" : "hidden"}`}>
          <VisualStageView
            audioGraph={audioGraphRef.current}
            trackMetadata={trackMetadata}
            currentTime={currentTime}
            isPlaying={isPlaying}
            className="flex-1 h-full min-h-[500px]"
          />
        </div>

        {/* Page 6: Neural Demixing & Media Ingestion Lab */}
        <div className={`flex-1 h-full min-h-[500px] flex flex-col ${currentView === "ingestion" ? "block" : "hidden"}`}>
          <DemixLabView
            trackMetadata={trackMetadata}
            processStatus={processStatus}
            hardwareInfo={hardwareInfo}
            songs={songs}
            onTrackLoaded={handleTrackLoaded}
            onStatusChange={setProcessStatus}
            className="flex-1 h-full min-h-[500px]"
          />
        </div>
      </main>

      {/* 3. Studio Status Bar Footer (Collapsible) */}
      <footer
        className={`border-t border-white/[0.05] bg-[#08090F]/95 backdrop-blur-xl px-4 flex items-center justify-between text-[10px] font-mono text-violet-200/50 select-none transition-all ${
          isFooterCollapsed ? "h-3 overflow-hidden py-0" : "h-7 py-0"
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
              <span>Mode: <strong className="text-violet-300 uppercase">{mode}</strong></span>
              <span className="text-zinc-700">|</span>
              <span className={isRecordingAutomation ? "text-pink-400 font-bold animate-pulse" : "text-zinc-500"}>
                Auto Record: {isRecordingAutomation ? "ARMED" : "IDLE"}
              </span>
              <span className="text-zinc-700">|</span>
              <span className={isCapturingPerformance ? "text-red-400 font-bold animate-pulse" : "text-zinc-500"}>
                Performance: {isCapturingPerformance ? "CAPTURING" : "STANDBY"}
              </span>
            </>
          )}
        </div>
        {!isFooterCollapsed && (
          <div className="flex items-center space-x-3">
            <span>View: <strong className="text-cyan-300 uppercase">{currentView}</strong></span>
            <span className="text-zinc-700">|</span>
            <span>Dual Fist Kill Switch: {gestureState.isDualFist ? "ACTIVE" : "READY"}</span>
            <span className="text-zinc-700">|</span>
            <span className="text-violet-400 font-medium">MusicOuts Pro DAW</span>
          </div>
        )}
      </footer>

      {/* 4. Studio Guide & Performance Take Modals */}
      <StudioGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <CapturePerformanceModal
        session={captureSession}
        onClose={() => setCaptureSession(null)}
        onPlayTake={handlePlayTake}
      />
    </div>
  );
};

export default App;
