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
  const [selectedStem, setSelectedStem] = useState<StemType>("vocals");

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
    <div className="min-h-screen bg-background text-on-surface font-body-md text-body-md flex select-none overflow-x-hidden">
      {/* Hidden File Input for Open Project */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleProjectFileSelected}
        accept=".musicouts,.json"
        className="hidden"
      />

      {/* 1. Left Vertical Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-full w-channel-w-standard bg-surface-container-lowest z-50 flex flex-col items-center justify-between py-pad-sm shadow-[0_1px_8px_rgba(0,0,0,0.5)] border-r border-surface-container-highest/30">
        <div className="flex flex-col items-center gap-pad-md">
          {/* Logo Badge */}
          <div
            onClick={() => setIsGuideOpen(true)}
            className="w-10 h-10 rounded bg-secondary-container text-on-secondary-container flex items-center justify-center shadow-[0_0_12px_rgba(236,106,6,0.6)] cursor-pointer"
            title="MusicOuts Pro 13"
          >
            <span className="material-symbols-outlined text-[24px]">graphic_eq</span>
          </div>

          {/* Nav Icons */}
          <nav className="flex flex-col gap-pad-xs">
            <button
              onClick={() => setCurrentView("arrangement")}
              className={`w-12 h-12 flex flex-col items-center justify-center rounded transition-all ${
                currentView === "arrangement"
                  ? "bg-surface-container-high text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] font-bold"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
              title="Tracks / Arrangement (1)"
            >
              <span className="material-symbols-outlined text-[20px]">view_timeline</span>
              <span className="font-label-sm text-[9px] mt-0.5">Tracks</span>
            </button>

            <button
              onClick={() => setCurrentView("mixer")}
              className={`w-12 h-12 flex flex-col items-center justify-center rounded transition-all ${
                currentView === "mixer"
                  ? "bg-surface-container-high text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] font-bold"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
              title="Mixer Console (2)"
            >
              <span className="material-symbols-outlined text-[20px]">tune</span>
              <span className="font-label-sm text-[9px] mt-0.5">Mixer</span>
            </button>

            <button
              onClick={() => setShowSynth(!showSynth)}
              className={`w-12 h-12 flex flex-col items-center justify-center rounded transition-all ${
                showSynth
                  ? "bg-surface-container-high text-secondary shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] font-bold"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
              title="Editor / Virtual Synth (E)"
            >
              <span className="material-symbols-outlined text-[20px]">piano</span>
              <span className="font-label-sm text-[9px] mt-0.5">Editor</span>
            </button>

            <button
              onClick={() => setCurrentView("fxrack")}
              className={`w-12 h-12 flex flex-col items-center justify-center rounded transition-all ${
                currentView === "fxrack"
                  ? "bg-surface-container-high text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] font-bold"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
              title="VSTi / FX Rack (3)"
            >
              <span className="material-symbols-outlined text-[20px]">album</span>
              <span className="font-label-sm text-[9px] mt-0.5">VSTi</span>
            </button>

            <button
              onClick={() => setCurrentView("ingestion")}
              className={`w-12 h-12 flex flex-col items-center justify-center rounded transition-all ${
                currentView === "ingestion"
                  ? "bg-surface-container-high text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] font-bold"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
              title="Media / Demix Lab (5)"
            >
              <span className="material-symbols-outlined text-[20px]">folder_open</span>
              <span className="font-label-sm text-[9px] mt-0.5">Media</span>
            </button>

            <button
              onClick={() => setCurrentView("gesture")}
              className={`w-12 h-12 flex flex-col items-center justify-center rounded transition-all ${
                currentView === "gesture"
                  ? "bg-surface-container-high text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] font-bold"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
              title="Gesture Lab (4)"
            >
              <span className="material-symbols-outlined text-[20px]">spatial_tracking</span>
              <span className="font-label-sm text-[9px] mt-0.5">Gesture</span>
            </button>

            <button
              onClick={() => setCurrentView("visualizer")}
              className={`w-12 h-12 flex flex-col items-center justify-center rounded transition-all ${
                currentView === "visualizer"
                  ? "bg-surface-container-high text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] font-bold"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
              title="Visual Stage"
            >
              <span className="material-symbols-outlined text-[20px]">activity_zone</span>
              <span className="font-label-sm text-[9px] mt-0.5">Visual</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Bottom: Status dot & Settings */}
        <div className="flex flex-col items-center gap-pad-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-tertiary shadow-[0_0_6px_#4ae176]" title="System Status: Operational" />
          <button
            onClick={() => setIsGuideOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            title="Settings & Guide"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>
      </aside>

      {/* 2. Top Header / Transport Bar */}
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

      {/* 3. Main Studio Workspace Area */}
      <main className="relative pl-channel-w-standard pt-[92px] w-full h-screen bg-surface flex flex-col overflow-hidden">
        {/* Dynamic Workspace View Container */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {showSynth && (
            <div className="p-2 bg-surface-container-low border-b border-surface-container-highest shrink-0">
              <VirtualSynth audioGraph={audioGraphRef.current} />
            </div>
          )}

          {/* Page 1: Multi-track Arrangement Window (3-Column Workspace) */}
          <div className={`flex-1 h-full ${currentView === "arrangement" ? "block" : "hidden"}`}>
            <div className="grid grid-cols-12 gap-0 h-full bg-surface-container-lowest overflow-hidden">
              {/* Left Column: Track Inspector */}
              <aside className="col-span-3 lg:col-span-2 xl:col-span-2 flex flex-col bg-surface-container-low shadow-[inset_-1px_0_0_rgba(255,255,255,0.05)] overflow-hidden z-20">
                {/* Inspector Tab Header & Stem Selector */}
                <div className="h-6 bg-surface-container px-pad-xs flex items-center justify-between border-b border-surface-container-highest font-label-sm text-label-sm shrink-0">
                  <div className="flex items-center gap-pad-micro">
                    {(['vocals', 'drums', 'bass', 'other'] as StemType[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedStem(s)}
                        className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold transition-all ${
                          selectedStem === s
                            ? "bg-primary text-on-primary"
                            : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                        }`}
                      >
                        {s.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Track Inspector Content (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-pad-sm flex flex-col gap-pad-sm">
                  {/* Selected Track Header Card */}
                  <div className="bg-surface-container p-pad-xs rounded flex flex-col gap-pad-xs border-l-2 border-primary-container">
                    <div className="flex items-center justify-between">
                      <span className="font-headline-sm text-headline-sm text-on-surface font-semibold capitalize">
                        01. {selectedStem} Stem
                      </span>
                      <span className="font-label-sm text-label-sm text-primary-container bg-primary-container/10 px-pad-xs rounded">Audio</span>
                    </div>
                    <div className="text-[9px] font-mono text-on-surface-variant">In: Stereo L/R • Out: Stereo Out</div>
                    <div className="flex items-center gap-pad-micro mt-pad-micro">
                      <button
                        onClick={() => handleStemMuteToggle(selectedStem)}
                        className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] ${
                          stems[selectedStem]?.muted ? "bg-error text-on-error" : "bg-surface-container-highest text-on-surface"
                        }`}
                      >
                        M
                      </button>
                      <button
                        onClick={() => handleStemSoloToggle(selectedStem)}
                        className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] ${
                          stems[selectedStem]?.solo ? "bg-secondary-container text-on-secondary-container font-bold" : "bg-surface-container-highest text-on-surface"
                        }`}
                      >
                        S
                      </button>
                      <button className="w-5 h-5 rounded bg-surface-container-highest flex items-center justify-center font-bold text-[9px] text-error">R</button>
                      <button className="w-5 h-5 rounded bg-surface-container-highest flex items-center justify-center font-bold text-[9px] text-primary">e</button>
                      <button className="w-5 h-5 rounded bg-surface-container-highest flex items-center justify-center font-bold text-[9px] text-tertiary">R</button>
                      <button className="w-5 h-5 rounded bg-surface-container-highest flex items-center justify-center font-bold text-[9px] text-secondary">W</button>
                    </div>
                  </div>

                  {/* Knobs: Pre-Gain, Pan, Phase */}
                  <div className="grid grid-cols-3 gap-pad-xs bg-surface-container p-pad-xs rounded text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-meter-tick text-meter-tick text-on-surface-variant">Pre-Gain</span>
                      <div className="w-6 h-6 rounded-full bg-surface-container-lowest flex items-center justify-center my-pad-micro shadow">
                        <div className="w-0.5 h-2.5 bg-primary -rotate-45" />
                      </div>
                      <span className="font-meter-tick text-meter-tick text-on-surface">
                        {(20 * Math.log10(Math.max(0.01, stems[selectedStem]?.volume || 1.0))).toFixed(1)} dB
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="font-meter-tick text-meter-tick text-on-surface-variant">Pan</span>
                      <div className="w-6 h-6 rounded-full bg-surface-container-lowest flex items-center justify-center my-pad-micro shadow">
                        <div
                          className="w-0.5 h-2.5 bg-secondary"
                          style={{ transform: `rotate(${(stems[selectedStem]?.pan || 0) * 90}deg)` }}
                        />
                      </div>
                      <span className="font-meter-tick text-meter-tick text-on-surface">
                        {stems[selectedStem]?.pan === 0 ? "C" : (stems[selectedStem]?.pan || 0) > 0 ? `R ${Math.round((stems[selectedStem]?.pan || 0) * 100)}` : `L ${Math.round(Math.abs(stems[selectedStem]?.pan || 0) * 100)}`}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="font-meter-tick text-meter-tick text-on-surface-variant">Phase</span>
                      <button className="w-6 h-6 rounded bg-surface-container-highest flex items-center justify-center my-pad-micro text-on-surface text-[10px] font-bold">∅</button>
                      <span className="font-meter-tick text-meter-tick text-on-surface">0°</span>
                    </div>
                  </div>

                  {/* Studio EQ Mini Curve */}
                  <div className="bg-surface-container p-pad-xs rounded flex flex-col gap-pad-xs">
                    <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface">
                      <span>Studio EQ</span>
                      <span className="text-tertiary text-[10px]">Active</span>
                    </div>
                    <div className="h-16 bg-surface-container-lowest rounded relative flex items-center justify-center overflow-hidden border border-surface-container-highest/40">
                      <svg className="w-full h-full" viewBox="0 0 160 64">
                        <line stroke="#33353b" strokeWidth="0.5" x1="0" x2="160" y1="32" y2="32" />
                        <line stroke="#33353b" strokeWidth="0.5" x1="40" x2="40" y1="0" y2="64" />
                        <line stroke="#33353b" strokeWidth="0.5" x1="80" x2="80" y1="0" y2="64" />
                        <line stroke="#33353b" strokeWidth="0.5" x1="120" x2="120" y1="0" y2="64" />
                        <path d="M 0 32 Q 25 32, 35 22 T 70 30 T 110 18 T 160 28" fill="none" stroke="#89ceff" strokeWidth="1.5" />
                        <circle cx="35" cy="22" fill="#ec6a06" r="2.5" />
                        <circle cx="70" cy="30" fill="#4ae176" r="2.5" />
                        <circle cx="110" cy="18" fill="#89ceff" r="2.5" />
                      </svg>
                    </div>
                  </div>

                  {/* Audio Inserts Rack */}
                  <div className="bg-surface-container p-pad-xs rounded flex flex-col gap-pad-micro">
                    <span className="font-label-sm text-label-sm text-on-surface mb-pad-micro">Audio Inserts (4/8)</span>
                    <div className="flex items-center justify-between bg-surface-container-high px-pad-xs py-pad-micro rounded font-label-sm text-[10px]">
                      <span className="text-primary truncate">1. FabFilter Pro-Q 3</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                    </div>
                    <div className="flex items-center justify-between bg-surface-container-high px-pad-xs py-pad-micro rounded font-label-sm text-[10px]">
                      <span className="text-primary truncate">2. CLA-2A Compressor</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                    </div>
                    <div className="flex items-center justify-between bg-surface-container-high px-pad-xs py-pad-micro rounded font-label-sm text-[10px]">
                      <span className="text-primary truncate">3. Soothe2 Dynamic</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                    </div>
                    <div className="flex items-center justify-between bg-surface-container-high px-pad-xs py-pad-micro rounded font-label-sm text-[10px]">
                      <span className="text-primary truncate">4. Valhalla VintageVerb</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                    </div>
                    <div className="flex items-center justify-between bg-surface-container-lowest px-pad-xs py-pad-micro rounded font-label-sm text-[10px] text-on-surface-variant/40">
                      <span>5. + Empty Slot</span>
                    </div>
                  </div>

                  {/* Quick Sends Rack */}
                  <div className="bg-surface-container p-pad-xs rounded flex flex-col gap-pad-micro">
                    <span className="font-label-sm text-label-sm text-on-surface mb-pad-micro">Sends</span>
                    <div className="flex items-center justify-between font-label-sm text-[10px] text-on-surface">
                      <span className="truncate">FX 1 - Reverb Bus</span>
                      <span className="font-mono text-secondary">-12.4 dB</span>
                    </div>
                    <div className="w-full h-1 bg-surface-container-lowest rounded-full overflow-hidden">
                      <div className="w-[60%] h-full bg-secondary" />
                    </div>
                    <div className="flex items-center justify-between font-label-sm text-[10px] text-on-surface mt-pad-micro">
                      <span className="truncate">FX 2 - Echo Delay</span>
                      <span className="font-mono text-secondary">-18.0 dB</span>
                    </div>
                    <div className="w-full h-1 bg-surface-container-lowest rounded-full overflow-hidden">
                      <div className="w-[45%] h-full bg-secondary" />
                    </div>
                  </div>
                </div>
              </aside>

              {/* Middle Column: Arrange View & Timeline */}
              <section className="col-span-6 lg:col-span-7 xl:col-span-7 flex flex-col bg-surface-container-lowest shadow-[inset_1px_0_0_rgba(255,255,255,0.05)] overflow-hidden relative">
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
                  className="flex-1 h-full"
                />
              </section>

              {/* Right Column: MediaBay & VST Browser */}
              <aside className="col-span-3 lg:col-span-3 xl:col-span-3 flex flex-col bg-surface-container-low shadow-[inset_1px_0_0_rgba(255,255,255,0.05)] overflow-hidden z-20">
                {/* MediaBay Header */}
                <div className="h-6 bg-surface-container px-pad-xs flex items-center justify-between border-b border-surface-container-highest font-label-sm text-label-sm shrink-0">
                  <div className="flex items-center gap-pad-xs">
                    <span className="material-symbols-outlined text-[14px] text-primary">folder_special</span>
                    <span className="font-semibold text-on-surface">MediaBay</span>
                  </div>
                  <div className="flex items-center gap-pad-micro">
                    <button className="px-pad-xs py-pad-micro rounded bg-surface-container-high text-primary font-bold">Browse</button>
                    <button className="px-pad-xs py-pad-micro rounded text-on-surface-variant hover:text-on-surface">Favs</button>
                    <button className="px-pad-xs py-pad-micro rounded text-on-surface-variant hover:text-on-surface">VST</button>
                  </div>
                </div>

                {/* Search Input */}
                <div className="p-pad-xs bg-surface-container-low border-b border-surface-container-highest/60 shrink-0">
                  <div className="flex items-center bg-surface-container-lowest px-pad-xs py-pad-micro rounded border border-surface-container-highest">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant mr-pad-xs">search</span>
                    <input
                      className="bg-transparent border-none outline-none font-body-sm text-body-sm text-on-surface w-full placeholder:text-on-surface-variant/40"
                      placeholder="Search samples, loops, presets..."
                      type="text"
                    />
                  </div>
                </div>

                {/* Tree Hierarchy Browser */}
                <div className="flex-1 overflow-y-auto p-pad-xs font-body-sm text-body-sm flex flex-col gap-pad-micro">
                  <div className="flex items-center gap-pad-xs text-on-surface py-pad-micro px-pad-xs rounded hover:bg-surface-container cursor-pointer">
                    <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
                    <span className="material-symbols-outlined text-[14px] text-secondary">album</span>
                    <span className="font-semibold">VST Instruments</span>
                  </div>
                  <div className="pl-pad-lg flex flex-col gap-pad-micro font-label-sm text-[10px] text-on-surface-variant">
                    <span className="hover:text-primary cursor-pointer py-pad-micro">• Omnisphere 2.8</span>
                    <span className="hover:text-primary cursor-pointer py-pad-micro">• Serum (Xfer Records)</span>
                    <span className="hover:text-primary cursor-pointer py-pad-micro">• Kontakt 7</span>
                    <span className="hover:text-primary cursor-pointer py-pad-micro">• Diva (u-he)</span>
                  </div>

                  <div className="flex items-center gap-pad-xs text-on-surface py-pad-micro px-pad-xs rounded hover:bg-surface-container cursor-pointer mt-pad-xs">
                    <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
                    <span className="material-symbols-outlined text-[14px] text-primary">folder</span>
                    <span className="font-semibold">Sample Library</span>
                  </div>
                  <div className="pl-pad-lg flex flex-col gap-pad-micro font-label-sm text-[10px] text-on-surface-variant">
                    <div className="flex items-center gap-pad-xs text-on-surface">
                      <span className="material-symbols-outlined text-[12px]">folder_open</span>
                      <span>Drums &amp; Percussion</span>
                    </div>
                    <div className="pl-pad-md flex flex-col gap-pad-micro text-[9px]">
                      <span className="hover:text-primary cursor-pointer py-pad-micro">• Acoustic_Snare_04.wav</span>
                      <span className="bg-secondary-container/20 text-secondary font-bold px-pad-xs py-pad-micro rounded cursor-pointer">• Neon_Kick_Sub808.wav</span>
                      <span className="hover:text-primary cursor-pointer py-pad-micro">• HiHat_Closed_16th.wav</span>
                      <span className="hover:text-primary cursor-pointer py-pad-micro">• Clap_Digital_Fat.wav</span>
                    </div>
                    <div className="flex items-center gap-pad-xs text-on-surface mt-pad-micro">
                      <span className="material-symbols-outlined text-[12px]">folder</span>
                      <span>Vocals &amp; Acapellas</span>
                    </div>
                    <div className="flex items-center gap-pad-xs text-on-surface mt-pad-micro">
                      <span className="material-symbols-outlined text-[12px]">folder</span>
                      <span>Guitars &amp; Plucks</span>
                    </div>
                  </div>
                </div>

                {/* Mini Waveform Sample Previewer Dock */}
                <div className="h-24 bg-surface-container p-pad-xs border-t border-surface-container-highest flex flex-col justify-between shrink-0">
                  <div className="flex items-center justify-between font-label-sm text-[10px]">
                    <span className="font-semibold text-secondary truncate">Neon_Kick_Sub808.wav</span>
                    <span className="text-on-surface-variant font-mono">48k / 24b</span>
                  </div>
                  <div className="h-10 bg-surface-container-lowest rounded relative overflow-hidden flex items-center border border-surface-container-highest/60">
                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 20">
                      <path d="M 0 10 Q 5 0, 10 10 T 20 10 T 30 15 T 40 10 T 50 12 T 60 10 T 80 10 T 100 10" fill="none" stroke="#ffb690" strokeWidth="1.5" />
                    </svg>
                    <div className="absolute top-0 bottom-0 left-1/3 w-0.5 bg-primary shadow-[0_0_4px_#89ceff]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-pad-xs">
                      <button className="w-5 h-5 rounded bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold">
                        <span className="material-symbols-outlined text-[12px]">play_arrow</span>
                      </button>
                      <button className="w-5 h-5 rounded bg-surface-container-highest text-on-surface flex items-center justify-center">
                        <span className="material-symbols-outlined text-[12px]">repeat</span>
                      </button>
                    </div>
                    <span className="font-label-sm text-[9px] text-tertiary">Auto-Play: ON</span>
                  </div>
                </div>
              </aside>
            </div>
          </div>

          {/* Page 2: Full Screen MixConsole Desk */}
          <div className={`flex-1 h-full ${currentView === "mixer" ? "block" : "hidden"}`}>
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
              className="flex-1 h-full"
            />
          </div>

          {/* Page 3: 5-Insert FX Rack View */}
          <div className={`flex-1 h-full ${currentView === "fxrack" ? "block" : "hidden"}`}>
            <FxRackView
              audioGraph={audioGraphRef.current}
              fxRackState={fxRackState}
              onFxChange={handleStemFxChange}
              className="flex-1 h-full"
            />
          </div>

          {/* Page 4: Vision AI & Gesture Lab */}
          <div className={`flex-1 h-full ${currentView === "gesture" ? "block" : "hidden"}`}>
            <GestureLabView
              gestureTracker={gestureTrackerRef.current}
              gestureState={gestureState}
              isGestureEnabled={isGestureEnabled}
              onToggleGestureEnabled={setIsGestureEnabled}
              onGestureStateChange={handleGestureStateChange}
              className="flex-1 h-full"
            />
          </div>

          {/* Page 5: Audio-Reactive Visual Stage */}
          <div className={`flex-1 h-full ${currentView === "visualizer" ? "block" : "hidden"}`}>
            <VisualStageView
              audioGraph={audioGraphRef.current}
              trackMetadata={trackMetadata}
              currentTime={currentTime}
              isPlaying={isPlaying}
              className="flex-1 h-full"
            />
          </div>

          {/* Page 6: Neural Demixing & Media Ingestion Lab */}
          <div className={`flex-1 h-full ${currentView === "ingestion" ? "block" : "hidden"}`}>
            <DemixLabView
              trackMetadata={trackMetadata}
              processStatus={processStatus}
              hardwareInfo={hardwareInfo}
              songs={songs}
              onTrackLoaded={handleTrackLoaded}
              onStatusChange={setProcessStatus}
              className="flex-1 h-full"
            />
          </div>
        </div>

        {/* Bottom Dock: MixConsole (Only active on Arrangement view) */}
        {currentView === "arrangement" && (
          <section
            className={`flex flex-col bg-surface-container-low border-t border-surface-container-highest shadow-[0_-4px_16px_rgba(0,0,0,0.6)] select-none transition-all duration-200 shrink-0 ${
              isFooterCollapsed ? "h-7 overflow-hidden" : "h-[38vh]"
            }`}
          >
            <div className="h-6 bg-surface-container px-pad-xs flex items-center justify-between border-b border-surface-container-highest font-label-sm text-[10px] text-on-surface-variant shrink-0">
              <span className="font-semibold text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-primary">equalizer</span>
                MixConsole Dock
              </span>
              <button
                onClick={() => setIsFooterCollapsed(!isFooterCollapsed)}
                className="px-1.5 py-0.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface text-[10px]"
                title={isFooterCollapsed ? "Expand MixConsole" : "Collapse MixConsole"}
              >
                {isFooterCollapsed ? "▲ Expand" : "▼ Collapse"}
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
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
                className="h-full"
              />
            </div>
          </section>
        )}
      </main>

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
