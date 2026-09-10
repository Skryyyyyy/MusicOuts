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
  AutomationPoint,
  ReverbPresetType,
} from "./types";
import { AudioGraphEngine } from "./engine/audioGraph";
import { GestureTracker, DEFAULT_GESTURE_STATE } from "./engine/gestureTracker";
import { AutomationManager, PerformanceCaptureTracker } from "./engine/automationEngine";
import { saveProjectToFile, loadProjectFromFile } from "./engine/projectManager";
import { HistoryManager, HistoryStatePayload } from "./engine/historyManager";

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
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [isMediaBayOpen, setIsMediaBayOpen] = useState<boolean>(false);
  const [showSynth, setShowSynth] = useState<boolean>(false);
  const [showAutomation, setShowAutomation] = useState<boolean>(true);
  const [selectedStem, setSelectedStem] = useState<StemType>("vocals");

  // Interactive Layout Panel Resizing State
  const [inspectorWidth, setInspectorWidth] = useState<number>(256);
  const [mediaBayWidth, setMediaBayWidth] = useState<number>(280);
  const [dockHeight, setDockHeight] = useState<number>(280);
  const [isResizingInspector, setIsResizingInspector] = useState<boolean>(false);
  const [isResizingMediaBay, setIsResizingMediaBay] = useState<boolean>(false);
  const [isResizingDock, setIsResizingDock] = useState<boolean>(false);

  // Mouse drag handler for Left Inspector width
  const handleInspectorResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingInspector(true);
    const startX = e.clientX;
    const startWidth = inspectorWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(Math.max(180, startWidth + delta), 480);
      setInspectorWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingInspector(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Mouse drag handler for Right MediaBay width
  const handleMediaBayResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingMediaBay(true);
    const startX = e.clientX;
    const startWidth = mediaBayWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.min(Math.max(200, startWidth + delta), 500);
      setMediaBayWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingMediaBay(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Mouse drag handler for Bottom MixConsole Dock height
  const handleDockResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingDock(true);
    const startY = e.clientY;
    const startHeight = dockHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const maxHeight = Math.round(window.innerHeight * 0.65);
      const newHeight = Math.min(Math.max(120, startHeight + delta), maxHeight);
      setDockHeight(newHeight);
      setIsFooterCollapsed(false);
    };

    const onMouseUp = () => {
      setIsResizingDock(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Real Hardware Detection State
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);

  // Audio Engine & Vision & Automation references
  const audioGraphRef = useRef<AudioGraphEngine | null>(null);
  const gestureTrackerRef = useRef<GestureTracker | null>(null);
  const automationManagerRef = useRef<AutomationManager>(new AutomationManager());
  const performanceTrackerRef = useRef<PerformanceCaptureTracker>(new PerformanceCaptureTracker());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastGestureUiUpdateRef = useRef<number>(0);

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
  const [automationPoints, setAutomationPoints] = useState<AutomationPoint[]>(() =>
    automationManagerRef.current.getPoints()
  );

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
    let lastClockUpdate = 0;

    const tick = () => {
      const audioGraph = audioGraphRef.current;
      if (audioGraph) {
        if (audioGraph.isPlaying()) {
          const t = audioGraph.getCurrentTime();
          setCurrentTime(t);

          const gDuration = audioGraph.getDuration();
          if (gDuration > 0) {
            setDuration((prev) => (Math.abs(prev - gDuration) > 0.5 ? gDuration : prev));
          }

          const now = performance.now();
          if (now - lastClockUpdate >= 50) {
            lastClockUpdate = now;
            const reduction = audioGraph.updateSidechainDucking();
            setDuckingReduction((prev) => (Math.abs(prev - reduction) > 0.02 ? reduction : prev));
          }

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
      const audioGraph = audioGraphRef.current;
      if (!audioGraph) return;

      const t = audioGraph.getCurrentTime();

      // 1. Dual Fist Kill Switch (with 200ms hold delay) - Immediate Audio DSP
      if (state.isDualFist) {
        audioGraph.setMasterVolume(0.0, 0.02);
        if (isRecordingAutomation) {
          automationManagerRef.current.recordPoint(t, "master.volume", 0.0);
        }
        if (isCapturingPerformance) {
          performanceTrackerRef.current.logEvent(t, "gesture", { killSwitch: true });
        }
      } else {
        audioGraph.setMasterVolume(masterVolume, 0.03);
      }

      // 2. Left Hand Modulation (Vocals Level & Solo/Mute) - Immediate Audio DSP
      if (state.leftHand.present) {
        const vocalVol = state.leftHand.height;
        audioGraph.setStemVolume("vocals", vocalVol, 0.02);
        audioGraph.setStemSolo("vocals", state.leftHand.isPinching, 0.02);
        audioGraph.setStemMute("vocals", state.leftHand.isFist, 0.02);

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

      // 3. Right Hand Modulation (Instruments Level & DJ Filter Sweep) - Immediate Audio DSP
      if (state.rightHand.present) {
        const otherVol = state.rightHand.height;
        audioGraph.setStemVolume("other", otherVol, 0.02);
        audioGraph.setDjFilter(state.djFilterCutoff, state.djFilterType, djFilterQ, 0.02);

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

      // 4. Throttle React State updates to ~30 FPS (33ms) so React does NOT choke the main thread
      const now = performance.now();
      if (now - lastGestureUiUpdateRef.current >= 33) {
        lastGestureUiUpdateRef.current = now;
        setGestureState(state);

        if (state.leftHand.present) {
          const vocalVol = state.leftHand.height;
          setStems((prev) => ({
            ...prev,
            vocals: {
              ...prev.vocals,
              volume: vocalVol,
              solo: state.leftHand.isPinching,
              muted: state.leftHand.isFist,
            },
          }));
        }

        if (state.rightHand.present) {
          const otherVol = state.rightHand.height;
          setStems((prev) => ({
            ...prev,
            other: { ...prev.other, volume: otherVol },
          }));
          setDjFilterCutoff(state.djFilterCutoff);
          setDjFilterType(state.djFilterType);
        }
      }
    },
    [masterVolume, djFilterQ, isRecordingAutomation, isCapturingPerformance]
  );

  // Track Ingestion Handler (Demucs AI finishes separation)
  const handleTrackLoaded = async (loadedTrack: TrackMetadata) => {
    setTrackMetadata(loadedTrack);
    setDuration(loadedTrack.duration > 0 ? loadedTrack.duration : 180);
    setIsLoadingStems(true);

    const songColors = ["#00bcd4", "#ff7043", "#ab47bc", "#4caf50", "#e91e63", "#ffeb3b"];
    const songColor = songColors[songs.length % songColors.length];

    const audioGraph = audioGraphRef.current;
    if (audioGraph) {
      try {
        await audioGraph.loadSongStems(loadedTrack.id, loadedTrack.stems);
        await audioGraph.loadStems(loadedTrack.id, loadedTrack.stems);

        const realDuration = audioGraph.getDuration() > 0 ? audioGraph.getDuration() : (loadedTrack.duration > 0 ? loadedTrack.duration : 180);
        setDuration(realDuration);

        const newSong: import("./types").SongItem = {
          id: loadedTrack.id,
          title: loadedTrack.title,
          duration: realDuration,
          stems: loadedTrack.stems,
          color: songColor,
          bpm: 120,
          key: "A minor",
        };

        setSongs((prev) => {
          const exists = prev.some((s) => s.id === newSong.id);
          return exists ? prev : [...prev, newSong];
        });

        // Generate 4 initial track clips using accurate decoded duration
        const newClips: import("./types").AudioClip[] = STEM_TYPES.map((stem) => ({
          id: `clip_${loadedTrack.id}_${stem}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          songId: loadedTrack.id,
          songTitle: loadedTrack.title,
          stem,
          startTime: 0,
          sourceOffset: 0,
          duration: realDuration,
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

  // Professional DAW Undo / Redo History Engine
  const historyManagerRef = useRef<HistoryManager>(
    new HistoryManager({
      stems: INITIAL_STEM_STATES,
      fxRack: DEFAULT_FX_RACK_STATE,
      clips: [],
      automationPoints: [],
      masterVolume: 1.0,
      djFilterCutoff: 20000,
      djFilterType: "lowpass",
    })
  );
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const lastSliderHistoryRecordRef = useRef<number>(0);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(historyManagerRef.current.canUndo());
    setCanRedo(historyManagerRef.current.canRedo());
  }, []);

  const recordHistory = useCallback(
    (description: string, customPartial?: Partial<HistoryStatePayload>) => {
      const payload: HistoryStatePayload = {
        stems,
        fxRack: fxRackState,
        clips,
        automationPoints,
        masterVolume,
        djFilterCutoff,
        djFilterType,
        ...customPartial,
      };
      historyManagerRef.current.pushState(description, payload);
      syncHistoryFlags();
    },
    [stems, fxRackState, clips, automationPoints, masterVolume, djFilterCutoff, djFilterType, syncHistoryFlags]
  );

  const recordContinuousSliderHistory = useCallback(
    (description: string, customPartial?: Partial<HistoryStatePayload>) => {
      const now = Date.now();
      if (now - lastSliderHistoryRecordRef.current > 500) {
        recordHistory(description, customPartial);
        lastSliderHistoryRecordRef.current = now;
      }
    },
    [recordHistory]
  );

  const applyHistoryState = useCallback(
    (payload: HistoryStatePayload) => {
      setStems(payload.stems);
      setFxRackState(payload.fxRack);
      setClips(payload.clips);
      setAutomationPoints(payload.automationPoints);
      setMasterVolume(payload.masterVolume);
      setDjFilterCutoff(payload.djFilterCutoff);
      setDjFilterType(payload.djFilterType);

      // Re-apply to audio graph engine
      const audioGraph = audioGraphRef.current;
      if (audioGraph) {
        for (const s of STEM_TYPES) {
          if (payload.stems[s]) {
            audioGraph.setStemVolume(s, payload.stems[s].volume);
            audioGraph.setStemPan(s, payload.stems[s].pan);
            audioGraph.setStemMute(s, payload.stems[s].muted);
            audioGraph.setStemSolo(s, payload.stems[s].solo);
          }
          if (payload.fxRack[s]) {
            audioGraph.setStemFxRackState(s, payload.fxRack[s]);
          }
        }
        audioGraph.setMasterVolume(payload.masterVolume);
        audioGraph.setDjFilter(payload.djFilterCutoff, payload.djFilterType, djFilterQ);
        audioGraph.setClips(payload.clips);
      }

      automationManagerRef.current.setPoints(payload.automationPoints);
    },
    [djFilterQ]
  );

  const handleUndo = useCallback(() => {
    const entry = historyManagerRef.current.undo();
    if (entry) {
      applyHistoryState(entry.state);
      syncHistoryFlags();
    }
  }, [applyHistoryState, syncHistoryFlags]);

  const handleRedo = useCallback(() => {
    const entry = historyManagerRef.current.redo();
    if (entry) {
      applyHistoryState(entry.state);
      syncHistoryFlags();
    }
  }, [applyHistoryState, syncHistoryFlags]);

  // DAW Audio Clip Manipulation Handlers
  const handleSliceClip = (clipId: string, time: number) => {
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;
    recordHistory("Split Audio Clip");
    const res = audioGraph.sliceClip(clipId, time);
    if (res) {
      setClips([...audioGraph.getClips()]);
    }
  };

  const handleTrimClip = (clipId: string, newStartOffset: number, newDuration: number) => {
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;
    recordHistory("Trim Audio Clip");
    audioGraph.trimClip(clipId, newStartOffset, newDuration);
    setClips([...audioGraph.getClips()]);
  };

  const handleMoveClip = (clipId: string, newStartTime: number) => {
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;
    recordHistory("Move Audio Clip");
    audioGraph.moveClip(clipId, newStartTime);
    setClips([...audioGraph.getClips()]);
  };

  const handleDuplicateClip = (clipId: string) => {
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;
    recordHistory("Duplicate Audio Clip");
    const dup = audioGraph.duplicateClip(clipId);
    if (dup) {
      setClips([...audioGraph.getClips()]);
    }
  };

  const handleDeleteClip = (clipId: string) => {
    const audioGraph = audioGraphRef.current;
    if (!audioGraph) return;
    recordHistory("Delete Audio Clip");
    audioGraph.deleteClip(clipId);
    setClips([...audioGraph.getClips()]);
  };

  const handleAddClip = (songId: string, stem: StemType) => {
    const targetSong = songs.find((s) => s.id === songId);
    if (!targetSong) return;

    recordHistory("Add Clip to Arrangement");
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

  // Stem & Clip Reversal Handlers
  const handleToggleReverseClip = (clipId: string) => {
    recordHistory("Reverse Clip Audio");
    const audioGraph = audioGraphRef.current;
    if (audioGraph) {
      audioGraph.toggleReverseClip(clipId);
    }
    setClips((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, isReversed: !c.isReversed } : c))
    );
  };

  const handleToggleReverseStem = (stem: StemType) => {
    recordHistory(`Toggle ${stem.toUpperCase()} Reverse`);
    audioGraphRef.current?.toggleReverseStem(stem);
  };

  const handleReverseAllStems = () => {
    recordHistory("Reverse All Stems");
    audioGraphRef.current?.reverseAllStems();
  };

  // Reverb Handlers
  const handleStemReverbChange = (stem: StemType, mix: number) => {
    recordContinuousSliderHistory(`Adjust ${stem.toUpperCase()} Reverb Mix`);
    setFxRackState((prev) => {
      const cur = prev[stem];
      const updatedRev = { ...cur.reverb, mix, enabled: true };
      const updated = { ...cur, reverb: updatedRev };
      audioGraphRef.current?.setStemReverb(stem, updatedRev);
      return { ...prev, [stem]: updated };
    });
  };

  const handleStemReverbPresetChange = (stem: StemType, preset: ReverbPresetType) => {
    recordHistory(`Change ${stem.toUpperCase()} Reverb Preset`);
    setFxRackState((prev) => {
      const cur = prev[stem];
      const updatedRev = { ...cur.reverb, preset, enabled: true };
      const updated = { ...cur, reverb: updatedRev };
      audioGraphRef.current?.setStemReverb(stem, updatedRev);
      return { ...prev, [stem]: updated };
    });
  };

  const handleStemReverbToggle = (stem: StemType) => {
    recordHistory(`Toggle ${stem.toUpperCase()} Reverb`);
    setFxRackState((prev) => {
      const cur = prev[stem];
      const updatedRev = { ...cur.reverb, enabled: !cur.reverb.enabled };
      const updated = { ...cur, reverb: updatedRev };
      audioGraphRef.current?.setStemReverb(stem, updatedRev);
      return { ...prev, [stem]: updated };
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
    recordContinuousSliderHistory(`Adjust ${stem.toUpperCase()} Volume`);
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
    recordContinuousSliderHistory(`Adjust ${stem.toUpperCase()} Pan`);
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
    recordHistory(`Toggle ${stem.toUpperCase()} Mute`);
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
    recordHistory(`Toggle ${stem.toUpperCase()} Solo`);
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
    recordContinuousSliderHistory("Adjust Master Volume");
    setMasterVolume(vol);
    audioGraphRef.current?.setMasterVolume(vol);
  };

  const handleDjFilterChange = (cutoff: number, type: "lowpass" | "highpass", q: number = djFilterQ) => {
    recordContinuousSliderHistory("Adjust DJ Filter");
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
    recordHistory(`Update ${stem.toUpperCase()} FX Rack`);
    setFxRackState((prev) => ({
      ...prev,
      [stem]: newFxState,
    }));
    if (isCapturingPerformance) {
      const t = audioGraphRef.current?.getCurrentTime() || 0;
      performanceTrackerRef.current.logEvent(t, "fx", { stem, fx: newFxState });
    }
  };

  // Keyframe Management Callbacks (Adobe Premiere-Style)
  const handleAddKeyframe = useCallback((point: AutomationPoint) => {
    recordHistory("Add Automation Keyframe");
    automationManagerRef.current.addPoint(point);
    setAutomationPoints(automationManagerRef.current.getPoints());
  }, [recordHistory]);

  const handleUpdateKeyframe = useCallback((pointId: string, updates: Partial<AutomationPoint>) => {
    recordHistory("Update Automation Keyframe");
    automationManagerRef.current.updatePoint(pointId, updates);
    setAutomationPoints(automationManagerRef.current.getPoints());
  }, [recordHistory]);

  const handleDeleteKeyframe = useCallback((pointId: string) => {
    recordHistory("Delete Automation Keyframe");
    automationManagerRef.current.deletePoint(pointId);
    setAutomationPoints(automationManagerRef.current.getPoints());
  }, [recordHistory]);

  const handleResetStemKeyframes = useCallback(
    (stem: StemType, param?: string) => {
      recordHistory(`Reset ${stem.toUpperCase()} Keyframes`);
      if (param) {
        automationManagerRef.current.clearTarget(`${stem}.${param}`);
      } else {
        const remaining = automationManagerRef.current
          .getPoints()
          .filter((p) => !p.target.startsWith(`${stem}.`));
        automationManagerRef.current.setPoints(remaining);
      }
      setAutomationPoints(automationManagerRef.current.getPoints());
    },
    [recordHistory]
  );

  const handleResetAllKeyframes = useCallback(() => {
    recordHistory("Reset All Keyframes");
    automationManagerRef.current.clearAll();
    setAutomationPoints([]);
  }, [recordHistory]);

  // Automation Recording Toggle
  const handleToggleRecordAutomation = () => {
    const nextRec = !isRecordingAutomation;
    setIsRecordingAutomation(nextRec);
    automationManagerRef.current.setRecording(nextRec);
    if (!nextRec) {
      setAutomationPoints(automationManagerRef.current.getPoints());
    }
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
      if (project.automation) {
        automationManagerRef.current.setPoints(project.automation);
        setAutomationPoints(automationManagerRef.current.getPoints());
      }

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
      setAutomationPoints(automationManagerRef.current.getPoints());
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

      // Undo / Redo Shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        }
        if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          handleRedo();
          return;
        }
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
  }, [isPlaying, isReadyCheck(), isLooping, trackMetadata, handleUndo, handleRedo]);

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
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isInspectorOpen={isInspectorOpen}
        isMediaBayOpen={isMediaBayOpen}
        isFooterCollapsed={isFooterCollapsed}
        onToggleInspector={currentView === "arrangement" ? () => setIsInspectorOpen(!isInspectorOpen) : undefined}
        onToggleMediaBay={() => setIsMediaBayOpen(!isMediaBayOpen)}
        onToggleFooter={currentView === "arrangement" ? () => setIsFooterCollapsed(!isFooterCollapsed) : undefined}
      />

      {/* 3. Main Studio Workspace Area */}
      <main
        className={`relative pl-channel-w-standard pt-[92px] w-full h-screen bg-surface flex flex-col overflow-hidden ${
          isResizingInspector || isResizingMediaBay
            ? "cursor-col-resize select-none"
            : isResizingDock
            ? "cursor-row-resize select-none"
            : ""
        }`}
      >
        {/* Dynamic Workspace View Container */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {showSynth && (
            <div className="p-2 bg-surface-container-low border-b border-surface-container-highest shrink-0 select-none">
              <div className="flex items-center justify-between pb-1 mb-1 border-b border-surface-container-highest/60 font-mono text-[10px] text-on-surface-variant">
                <span className="flex items-center gap-1 font-bold text-on-surface">
                  <span className="material-symbols-outlined text-[13px] text-primary">piano</span>
                  Virtual Synthesizer Keyboard
                </span>
                <button
                  onClick={() => setShowSynth(false)}
                  className="px-1.5 py-0.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                  title="Close Synthesizer Keyboard"
                >
                  ✕ Close
                </button>
              </div>
              <VirtualSynth audioGraph={audioGraphRef.current} onClose={() => setShowSynth(false)} />
            </div>
          )}

          {/* 3-Zone Workspace Layout: Left Inspector (Arrangement only) | Center Active Page | Right MediaBay */}
          <div className="flex-1 min-h-0 flex h-full bg-surface-container-lowest overflow-hidden">
            {/* Left Column: Track Inspector (Active exclusively on Arrangement view) */}
            {currentView === "arrangement" && (
              <>
                {isInspectorOpen ? (
                  <aside
                    style={{ width: `${inspectorWidth}px` }}
                    className="flex flex-col bg-surface-container-low border-r border-surface-container-highest shadow-[inset_-1px_0_0_rgba(255,255,255,0.05)] overflow-hidden shrink-0 z-20 select-none transition-[width] duration-75"
                  >
                  {/* Inspector Tab Header & Stem Selector & Minimize Button */}
                  <div className="h-7 bg-surface-container px-2 flex items-center justify-between border-b border-surface-container-highest shrink-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="material-symbols-outlined text-[14px] text-primary">tune</span>
                      <span className="font-mono text-[10px] font-bold text-on-surface tracking-wide">INSPECTOR</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(['vocals', 'drums', 'bass', 'other'] as StemType[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setSelectedStem(s)}
                          className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold font-mono transition-all ${
                            selectedStem === s
                              ? "bg-primary text-on-primary shadow-sm"
                              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                          }`}
                          title={`Inspect ${s}`}
                        >
                          {s.slice(0, 3)}
                        </button>
                      ))}
                      <button
                        onClick={() => setIsInspectorOpen(false)}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors ml-0.5"
                        title="Minimize Track Inspector"
                      >
                        <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                      </button>
                    </div>
                  </div>

                  {/* Track Inspector Content (Scrollable) */}
                  <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                    {/* Selected Track Header Card */}
                    <div className="bg-surface-container p-2 rounded flex flex-col gap-1 border-l-2 border-primary">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-on-surface font-bold capitalize truncate">
                          01 • {selectedStem} Stem
                        </span>
                        <span className="font-mono text-[9px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold shrink-0">Audio</span>
                      </div>
                      <div className="text-[9px] font-mono text-on-surface-variant whitespace-nowrap truncate">In: Stereo L/R • Out: Stereo Bus</div>
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => handleStemMuteToggle(selectedStem)}
                          className={`w-6 h-5 rounded flex items-center justify-center font-bold text-[9px] font-mono transition-all ${
                            stems[selectedStem]?.muted ? "bg-error text-on-error shadow-sm" : "bg-surface-container-highest text-on-surface hover:text-on-surface"
                          }`}
                        >
                          M
                        </button>
                        <button
                          onClick={() => handleStemSoloToggle(selectedStem)}
                          className={`w-6 h-5 rounded flex items-center justify-center font-bold text-[9px] font-mono transition-all ${
                            stems[selectedStem]?.solo ? "bg-secondary-container text-on-secondary-container shadow-sm" : "bg-surface-container-highest text-on-surface hover:text-on-surface"
                          }`}
                        >
                          S
                        </button>
                        <button className="w-5 h-5 rounded bg-surface-container-highest flex items-center justify-center font-bold text-[9px] font-mono text-error">R</button>
                        <button className="w-5 h-5 rounded bg-surface-container-highest flex items-center justify-center font-bold text-[9px] font-mono text-primary">e</button>
                        <button className="w-5 h-5 rounded bg-surface-container-highest flex items-center justify-center font-bold text-[9px] font-mono text-tertiary">R</button>
                        <button className="w-5 h-5 rounded bg-surface-container-highest flex items-center justify-center font-bold text-[9px] font-mono text-secondary">W</button>
                      </div>
                    </div>

                    {/* Knobs: Pre-Gain, Pan, Phase */}
                    <div className="grid grid-cols-3 gap-1 bg-surface-container p-2 rounded text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-mono text-[9px] text-on-surface-variant uppercase whitespace-nowrap">Pre-Gain</span>
                        <div className="w-6 h-6 rounded-full bg-surface-container-lowest flex items-center justify-center my-1 shadow">
                          <div className="w-0.5 h-2.5 bg-primary -rotate-45" />
                        </div>
                        <span className="font-mono text-[9px] text-on-surface font-bold whitespace-nowrap">
                          {(20 * Math.log10(Math.max(0.01, stems[selectedStem]?.volume || 1.0))).toFixed(1)} dB
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="font-mono text-[9px] text-on-surface-variant uppercase whitespace-nowrap">Pan</span>
                        <div
                          onClick={() => {
                            const nextPan = (stems[selectedStem]?.pan || 0) === 0 ? 0.5 : (stems[selectedStem]?.pan || 0) > 0 ? -0.5 : 0;
                            handleStemPanChange(selectedStem, nextPan);
                          }}
                          className="w-6 h-6 rounded-full bg-surface-container-lowest flex items-center justify-center my-1 shadow cursor-pointer hover:bg-surface-container-high transition-colors"
                          title="Click to cycle Pan L/C/R"
                        >
                          <div
                            className="w-0.5 h-2.5 bg-secondary"
                            style={{ transform: `rotate(${(stems[selectedStem]?.pan || 0) * 90}deg)` }}
                          />
                        </div>
                        <span className="font-mono text-[9px] text-secondary font-bold whitespace-nowrap">
                          {stems[selectedStem]?.pan === 0 ? "C" : (stems[selectedStem]?.pan || 0) > 0 ? `R${Math.round((stems[selectedStem]?.pan || 0) * 100)}` : `L${Math.round(Math.abs(stems[selectedStem]?.pan || 0) * 100)}`}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="font-mono text-[9px] text-on-surface-variant uppercase whitespace-nowrap">Phase</span>
                        <button className="w-6 h-6 rounded bg-surface-container-highest flex items-center justify-center my-1 text-on-surface text-[10px] font-bold font-mono">∅</button>
                        <span className="font-mono text-[9px] text-on-surface font-semibold whitespace-nowrap">0°</span>
                      </div>
                    </div>

                    {/* Studio EQ Mini Curve */}
                    <div className="bg-surface-container p-2 rounded flex flex-col gap-1">
                      <div className="flex items-center justify-between font-mono text-[10px] text-on-surface">
                        <span className="font-bold">Studio EQ</span>
                        <span className="text-tertiary font-bold text-[9px]">ACTIVE</span>
                      </div>
                      <div className="h-14 bg-surface-container-lowest rounded relative flex items-center justify-center overflow-hidden border border-surface-container-highest/40">
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
                    <div className="bg-surface-container p-2 rounded flex flex-col gap-1">
                      <span className="font-mono text-[10px] text-on-surface font-bold">Audio Inserts (4/8)</span>
                      {[
                        "1. FabFilter Pro-Q 3",
                        "2. CLA-2A Compressor",
                        "3. Soothe2 Dynamic",
                        "4. Valhalla VintageVerb",
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-surface-container-high px-2 py-1 rounded font-mono text-[9px]">
                          <span className="text-primary truncate">{item}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-tertiary shrink-0 ml-1" />
                        </div>
                      ))}
                      <div className="flex items-center justify-between bg-surface-container-lowest px-2 py-1 rounded font-mono text-[9px] text-on-surface-variant/40">
                        <span>5. + Empty Slot</span>
                      </div>
                    </div>

                    {/* Quick Sends Rack */}
                    <div className="bg-surface-container p-2 rounded flex flex-col gap-1">
                      <span className="font-mono text-[10px] text-on-surface font-bold">Sends</span>
                      <div className="flex items-center justify-between font-mono text-[9px] text-on-surface">
                        <span className="truncate">FX 1 - Reverb Bus</span>
                        <span className="text-secondary font-bold">-12.4 dB</span>
                      </div>
                      <div className="w-full h-1 bg-surface-container-lowest rounded-full overflow-hidden">
                        <div className="w-[60%] h-full bg-secondary" />
                      </div>
                      <div className="flex items-center justify-between font-mono text-[9px] text-on-surface mt-1">
                        <span className="truncate">FX 2 - Echo Delay</span>
                        <span className="text-secondary font-bold">-18.0 dB</span>
                      </div>
                      <div className="w-full h-1 bg-surface-container-lowest rounded-full overflow-hidden">
                        <div className="w-[45%] h-full bg-secondary" />
                      </div>
                    </div>
                  </div>
                </aside>
              ) : (
                <div
                  onClick={() => setIsInspectorOpen(true)}
                  className="w-7 bg-surface-container-low border-r border-surface-container-highest flex flex-col items-center py-2 cursor-pointer hover:bg-surface-container text-on-surface-variant hover:text-primary transition-all shrink-0 z-20 select-none group"
                  title="Click to expand Track Inspector"
                >
                  <span className="material-symbols-outlined text-[14px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                  <span className="text-[9px] font-mono font-bold tracking-widest [writing-mode:vertical-rl] rotate-180 mt-3 text-on-surface-variant group-hover:text-primary uppercase">Inspector</span>
                </div>
              )}

              {/* Vertical Resizing Divider (Left Inspector <-> Center Timeline) */}
              {isInspectorOpen && (
                <div
                  onMouseDown={handleInspectorResizeStart}
                  className={`group relative w-2 -mr-1 z-30 cursor-col-resize select-none flex items-center justify-center transition-colors ${
                    isResizingInspector ? "bg-primary/40" : "hover:bg-primary/20"
                  }`}
                  title="Drag to resize Inspector panel (<|>)"
                >
                  <div
                    className={`w-[2px] h-full transition-all duration-150 ${
                      isResizingInspector
                        ? "bg-primary shadow-[0_0_10px_#89ceff]"
                        : "bg-surface-container-highest group-hover:bg-primary group-hover:shadow-[0_0_8px_#89ceff]"
                    }`}
                  />
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 py-2 px-0.5 rounded bg-surface-container-high/90 border border-surface-container-highest shadow-md transition-all duration-150 ${
                      isResizingInspector
                        ? "opacity-100 border-primary shadow-[0_0_10px_#89ceff]"
                        : "opacity-0 group-hover:opacity-100 group-hover:border-primary/60"
                    }`}
                  >
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    <div className="w-1 h-1 rounded-full bg-primary" />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Middle Column: Active Page Viewport Area */}
          <section className="flex-1 min-w-0 flex flex-col bg-surface-container-lowest shadow-[inset_1px_0_0_rgba(255,255,255,0.05)] overflow-hidden relative">
                {/* Page 1: Multi-track Arrangement Window */}
                <div className={`flex-1 h-full ${currentView === "arrangement" ? "block" : "hidden"}`}>
                  <ArrangementView
                    audioGraph={audioGraphRef.current}
                    trackMetadata={trackMetadata}
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    isLooping={isLooping}
                    stemStates={stems}
                    fxRackState={fxRackState}
                    gestureState={gestureState}
                    automationPoints={automationPoints}
                    showAutomation={showAutomation}
                    clips={clips}
                    songs={songs}
                    onToggleAutomation={() => setShowAutomation(!showAutomation)}
                    onSeek={handleSeek}
                    onStemVolumeChange={handleStemVolumeChange}
                    onStemMuteToggle={handleStemMuteToggle}
                    onStemSoloToggle={handleStemSoloToggle}
                    onStemPanChange={handleStemPanChange}
                    onToggleReverseStem={handleToggleReverseStem}
                    onToggleReverseClip={handleToggleReverseClip}
                    onReverseAllStems={handleReverseAllStems}
                    onStemReverbChange={handleStemReverbChange}
                    onStemReverbPresetChange={handleStemReverbPresetChange}
                    onStemReverbToggle={handleStemReverbToggle}
                    onSliceClip={handleSliceClip}
                    onTrimClip={handleTrimClip}
                    onMoveClip={handleMoveClip}
                    onDuplicateClip={handleDuplicateClip}
                    onDeleteClip={handleDeleteClip}
                    onAddClip={handleAddClip}
                    onAddKeyframe={handleAddKeyframe}
                    onUpdateKeyframe={handleUpdateKeyframe}
                    onDeleteKeyframe={handleDeleteKeyframe}
                    onResetStemKeyframes={handleResetStemKeyframes}
                    onResetAllKeyframes={handleResetAllKeyframes}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    className="flex-1 h-full"
                  />
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
              </section>

              {/* Vertical Resizing Divider (Center Timeline <-> Right MediaBay) */}
              {isMediaBayOpen && (
                <div
                  onMouseDown={handleMediaBayResizeStart}
                  className={`group relative w-2 -ml-1 z-30 cursor-col-resize select-none flex items-center justify-center transition-colors ${
                    isResizingMediaBay ? "bg-primary/40" : "hover:bg-primary/20"
                  }`}
                  title="Drag to resize MediaBay panel (<|>)"
                >
                  <div
                    className={`w-[2px] h-full transition-all duration-150 ${
                      isResizingMediaBay
                        ? "bg-primary shadow-[0_0_10px_#89ceff]"
                        : "bg-surface-container-highest group-hover:bg-primary group-hover:shadow-[0_0_8px_#89ceff]"
                    }`}
                  />
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 py-2 px-0.5 rounded bg-surface-container-high/90 border border-surface-container-highest shadow-md transition-all duration-150 ${
                      isResizingMediaBay
                        ? "opacity-100 border-primary shadow-[0_0_10px_#89ceff]"
                        : "opacity-0 group-hover:opacity-100 group-hover:border-primary/60"
                    }`}
                  >
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    <div className="w-1 h-1 rounded-full bg-primary" />
                  </div>
                </div>
              )}

              {/* Right Column: MediaBay & VST Browser (Sliding Window with Minimize Option) */}
              {isMediaBayOpen ? (
                <aside
                  style={{ width: `${mediaBayWidth}px` }}
                  className="flex flex-col bg-surface-container-low border-l border-surface-container-highest shadow-[inset_1px_0_0_rgba(255,255,255,0.05)] overflow-hidden shrink-0 z-20 select-none transition-[width] duration-75"
                >
                  {/* MediaBay Header */}
                  <div className="h-7 bg-surface-container px-2 flex items-center justify-between border-b border-surface-container-highest shrink-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="material-symbols-outlined text-[14px] text-primary">folder_special</span>
                      <span className="font-mono text-[10px] font-bold text-on-surface tracking-wide">MEDIABAY</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary font-mono text-[9px] font-bold">Browse</button>
                      <button className="px-1.5 py-0.5 rounded text-on-surface-variant hover:text-on-surface font-mono text-[9px]">Favs</button>
                      <button className="px-1.5 py-0.5 rounded text-on-surface-variant hover:text-on-surface font-mono text-[9px]">VST</button>
                      <button
                        onClick={() => setIsMediaBayOpen(false)}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors ml-0.5"
                        title="Minimize MediaBay"
                      >
                        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                      </button>
                    </div>
                  </div>

                  {/* Search Input */}
                  <div className="p-1.5 bg-surface-container-low border-b border-surface-container-highest/60 shrink-0">
                    <div className="flex items-center bg-surface-container-lowest px-2 py-1 rounded border border-surface-container-highest">
                      <span className="material-symbols-outlined text-[13px] text-on-surface-variant mr-1.5">search</span>
                      <input
                        className="bg-transparent border-none outline-none font-mono text-[10px] text-on-surface w-full placeholder:text-on-surface-variant/40"
                        placeholder="Search samples, loops, presets..."
                        type="text"
                      />
                    </div>
                  </div>

                  {/* Tree Hierarchy Browser */}
                  <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-on-surface py-0.5 px-1 rounded hover:bg-surface-container cursor-pointer">
                      <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
                      <span className="material-symbols-outlined text-[13px] text-secondary">album</span>
                      <span className="font-bold">VST Instruments</span>
                    </div>
                    <div className="pl-5 flex flex-col gap-0.5 text-[9px] text-on-surface-variant">
                      <span className="hover:text-primary cursor-pointer py-0.5 truncate">• Omnisphere 2.8</span>
                      <span className="hover:text-primary cursor-pointer py-0.5 truncate">• Serum (Xfer Records)</span>
                      <span className="hover:text-primary cursor-pointer py-0.5 truncate">• Kontakt 7</span>
                      <span className="hover:text-primary cursor-pointer py-0.5 truncate">• Diva (u-he)</span>
                    </div>

                    <div className="flex items-center gap-1 text-on-surface py-0.5 px-1 rounded hover:bg-surface-container cursor-pointer mt-1">
                      <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
                      <span className="material-symbols-outlined text-[13px] text-primary">folder</span>
                      <span className="font-bold">Sample Library</span>
                    </div>
                    <div className="pl-5 flex flex-col gap-0.5 text-[9px] text-on-surface-variant">
                      <div className="flex items-center gap-1 text-on-surface py-0.5">
                        <span className="material-symbols-outlined text-[12px]">folder_open</span>
                        <span className="font-semibold">Drums &amp; Percussion</span>
                      </div>
                      <div className="pl-3 flex flex-col gap-0.5 text-[9px]">
                        <span className="hover:text-primary cursor-pointer py-0.5 truncate">• Acoustic_Snare_04.wav</span>
                        <span className="bg-secondary-container/20 text-secondary font-bold px-1 py-0.5 rounded cursor-pointer truncate">• Neon_Kick_Sub808.wav</span>
                        <span className="hover:text-primary cursor-pointer py-0.5 truncate">• HiHat_Closed_16th.wav</span>
                        <span className="hover:text-primary cursor-pointer py-0.5 truncate">• Clap_Digital_Fat.wav</span>
                      </div>
                      <div className="flex items-center gap-1 text-on-surface mt-1 py-0.5">
                        <span className="material-symbols-outlined text-[12px]">folder</span>
                        <span>Vocals &amp; Acapellas</span>
                      </div>
                      <div className="flex items-center gap-1 text-on-surface mt-0.5 py-0.5">
                        <span className="material-symbols-outlined text-[12px]">folder</span>
                        <span>Guitars &amp; Plucks</span>
                      </div>
                    </div>
                  </div>

                  {/* Mini Waveform Sample Previewer Dock */}
                  <div className="h-20 bg-surface-container p-2 border-t border-surface-container-highest flex flex-col justify-between shrink-0">
                    <div className="flex items-center justify-between font-mono text-[9px]">
                      <span className="font-bold text-secondary truncate">Neon_Kick_Sub808.wav</span>
                      <span className="text-on-surface-variant">48k / 24b</span>
                    </div>
                    <div className="h-8 bg-surface-container-lowest rounded relative overflow-hidden flex items-center border border-surface-container-highest/60 my-1">
                      <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 20">
                        <path d="M 0 10 Q 5 0, 10 10 T 20 10 T 30 15 T 40 10 T 50 12 T 60 10 T 80 10 T 100 10" fill="none" stroke="#ffb690" strokeWidth="1.5" />
                      </svg>
                      <div className="absolute top-0 bottom-0 left-1/3 w-0.5 bg-primary shadow-[0_0_4px_#89ceff]" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button className="w-5 h-5 rounded bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold">
                          <span className="material-symbols-outlined text-[12px]">play_arrow</span>
                        </button>
                        <button className="w-5 h-5 rounded bg-surface-container-highest text-on-surface flex items-center justify-center">
                          <span className="material-symbols-outlined text-[12px]">repeat</span>
                        </button>
                      </div>
                      <span className="font-mono text-[8px] text-tertiary font-bold">Auto-Play: ON</span>
                    </div>
                  </div>
                </aside>
              ) : (
                <div
                  onClick={() => setIsMediaBayOpen(true)}
                  className="w-7 bg-surface-container-low border-l border-surface-container-highest flex flex-col items-center py-2 cursor-pointer hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-all shrink-0 z-20 select-none group"
                  title="Click to expand MediaBay & Sound Library"
                >
                  <span className="material-symbols-outlined text-[14px] group-hover:-translate-x-0.5 transition-transform">chevron_left</span>
                  <span className="text-[9px] font-mono font-bold tracking-widest [writing-mode:vertical-rl] mt-3 text-on-surface-variant group-hover:text-secondary uppercase">MediaBay</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Dock: MixConsole (Exclusively active on Arrangement view) */}
          {currentView === "arrangement" && (
            <section
              style={!isFooterCollapsed ? { height: `${dockHeight}px` } : undefined}
              className={`flex flex-col bg-surface-container-low border-t border-surface-container-highest shadow-[0_-4px_16px_rgba(0,0,0,0.6)] select-none shrink-0 relative transition-[height] duration-75 ${
                isFooterCollapsed ? "h-7 overflow-hidden" : ""
              }`}
            >
              {/* Horizontal Resizing Handle with Glowing Highlight above the bottom MixConsole dock */}
              <div
                onMouseDown={handleDockResizeStart}
                className={`group absolute -top-2 left-0 right-0 h-4 z-40 cursor-row-resize flex items-center justify-center transition-colors select-none ${
                  isResizingDock ? "bg-primary/25" : "hover:bg-primary/15"
                }`}
                title="Drag up/down to resize MixConsole dock height"
              >
                <div
                  className={`h-[3px] rounded-full transition-all duration-150 flex items-center justify-center ${
                    isResizingDock
                      ? "w-40 bg-primary shadow-[0_0_14px_#89ceff]"
                      : "w-24 bg-surface-container-highest group-hover:w-36 group-hover:bg-primary group-hover:shadow-[0_0_12px_#89ceff]"
                  }`}
                >
                  <div className="w-8 h-[1px] bg-white/80 rounded" />
                </div>
              </div>
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
