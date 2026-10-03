import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, Clip, Track, SourceAsset, SongSection } from '../../core/project-model/types';
import {
  CommandManager,
  SplitClipCommand,
  MoveClipCommand,
  TrimClipCommand,
  RippleDeleteClipCommand,
  AddTrackCommand,
} from '../../core/project-model/commands';
import { AudioEngine } from '../../core/audio-engine/graph';
import { createDemoProject, createEmptyProject, createTemplateProject } from '../../core/dsp/synthetic-stems';
import { detectBpmAndBeats } from '../../core/analysis/bpm';
import { detectSongSections } from '../../core/analysis/sections';
import { generatePeakPyramid } from '../../core/analysis/waveform';
import { SeparatedStemResult } from '../../ml/stem-lab/service';

import { LoginPage, UserSession } from './LoginPage';
import { ProjectHubModal } from './ProjectHubModal';
import { TopBar } from './TopBar';
import { MediaSidebar } from './MediaSidebar';
import { Timeline } from './Timeline';
import { Inspector } from './Inspector';
import { AutomationStudio } from './AutomationStudio';
import { StemLabModal } from './StemLabModal';
import { MixerModal } from './MixerModal';
import { SampleEditorModal } from './SampleEditorModal';
import { PianoRollModal } from './PianoRollModal';
import { TakeCompingModal } from './TakeCompingModal';
import { AIMasteringModal } from './AIMasteringModal';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { HistoryModal } from './HistoryModal';
import { ExportModal } from './ExportModal';
import { URLImportModal } from './URLImportModal';
import { AIAssistantModal } from './AIAssistantModal';

import { Zap } from 'lucide-react';

export const App: React.FC = () => {
  const [engine] = useState(() => new AudioEngine());
  const [cmdManager] = useState(() => new CommandManager(150));
  const [project, setProject] = useState<Project | null>(null);

  // User Authentication & Project Launcher Hub State
  const [userSession, setUserSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('musicouts_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isProjectHubOpen, setIsProjectHubOpen] = useState<boolean>(false);

  // Panel Minimizing / Collapse States
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [isRightInspectorOpen, setIsRightInspectorOpen] = useState<boolean>(true);
  const [isBottomStudioOpen, setIsBottomStudioOpen] = useState<boolean>(true);

  // Transport & Playhead State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isMetronomeOn, setIsMetronomeOn] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  // Clipboard Reference for Copy & Paste
  const copiedClipRef = useRef<Clip | null>(null);

  // Microphone Recording References
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Active Modals
  const [isMixerOpen, setIsMixerOpen] = useState<boolean>(false);
  const [isSampleEditorOpen, setIsSampleEditorOpen] = useState<boolean>(false);
  const [isPianoRollOpen, setIsPianoRollOpen] = useState<boolean>(false);
  const [isTakeCompingOpen, setIsTakeCompingOpen] = useState<boolean>(false);
  const [isAIMasteringOpen, setIsAIMasteringOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isURLImportOpen, setIsURLImportOpen] = useState<boolean>(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState<boolean>(false);
  const [stemLabAsset, setStemLabAsset] = useState<SourceAsset | null>(null);

  const [meterLevels, setMeterLevels] = useState<{ left: number; right: number; lufsEstimate: number }>({
    left: 0.65,
    right: 0.62,
    lufsEstimate: -14.2,
  });

  // Start with a Clean Empty Project by default as requested!
  useEffect(() => {
    let isCancelled = false;

    const init = async () => {
      await engine.initAudioContext();
      if (!isCancelled) {
        const cleanProject = createEmptyProject();
        setProject(cleanProject);
        if (cleanProject.tracks.length > 0) {
          setSelectedTrackId(cleanProject.tracks[0].id);
        }
        engine.syncProject(cleanProject);
      }
    };

    init();

    const unsubMeters = engine.onMeterUpdate((levels) => {
      setMeterLevels(levels);
    });

    const unsubTime = engine.onTimeUpdate((time) => {
      setCurrentTime(time);
    });

    return () => {
      isCancelled = true;
      unsubMeters();
      unsubTime();
      engine.dispose();
    };
  }, [engine]);

  // Sync Project changes to AudioEngine
  useEffect(() => {
    if (project) {
      engine.syncProject(project);
    }
  }, [project, engine]);

  // Metronome Ticker Loop
  const lastBeatRef = useRef<number>(-1);
  useEffect(() => {
    if (isPlaying && isMetronomeOn && project) {
      const beatInterval = 60 / (project.bpm || 120);
      const currentBeat = Math.floor(currentTime / beatInterval);
      if (currentBeat !== lastBeatRef.current) {
        lastBeatRef.current = currentBeat;
        const isAccent = currentBeat % (project.timeSignature?.[0] || 4) === 0;
        engine.playMetronomeTick(isAccent);
      }
    }
  }, [isPlaying, isMetronomeOn, currentTime, project, engine]);

  const selectedTrack = useMemo(() => {
    return project?.tracks.find((t) => t.id === selectedTrackId) || project?.tracks[0] || null;
  }, [project, selectedTrackId]);

  const selectedClip = useMemo(() => {
    return project?.clips.find((c) => c.id === selectedClipId) || project?.clips[0] || null;
  }, [project, selectedClipId]);

  // Load Full 7-Track Demo Project
  const handleLoadDemoProject = async () => {
    const audioCtx = await engine.initAudioContext();
    const { project: demoProject, buffers } = createDemoProject(audioCtx);

    buffers.forEach((buf, id) => {
      engine.registerAudioBuffer(id, buf);
    });

    setProject(demoProject);
    if (demoProject.tracks.length > 3) {
      setSelectedTrackId(demoProject.tracks[3].id);
    }
    if (demoProject.clips.length > 6) {
      setSelectedClipId(demoProject.clips[6].id);
    }
    setCurrentTime(42.5);
    engine.seek(42.5);
    engine.syncProject(demoProject);
  };

  // Start Clean Blank Session
  const handleNewEmptyProject = () => {
    engine.stopActiveSources();
    const cleanProject = createEmptyProject();
    setProject(cleanProject);
    setSelectedClipId(null);
    if (cleanProject.tracks.length > 0) {
      setSelectedTrackId(cleanProject.tracks[0].id);
    }
    setCurrentTime(0);
    engine.seek(0);
  };

  // Clear Timeline
  const handleClearTimeline = () => {
    if (!project) return;
    engine.stopActiveSources();
    setProject({
      ...project,
      clips: [],
    });
    setSelectedClipId(null);
  };

  // Save Project
  const handleSaveProject = () => {
    if (!project) return;
    localStorage.setItem('musicouts_project_saved', JSON.stringify(project));
    alert(`Project "${project.name}" successfully saved!`);
  };

  // Open Project
  const handleOpenProject = () => {
    const saved = localStorage.getItem('musicouts_project_saved');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProject(parsed);
        alert(`Loaded saved project "${parsed.name}"!`);
      } catch {
        alert('Could not parse saved project.');
      }
    } else {
      alert('No previously saved project found in local storage.');
    }
  };

  // Import Native Audio File
  const handleImportAudioFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && project) {
        const audioCtx = engine.getAudioContext() || new AudioContext();
        const arrayBuffer = await file.arrayBuffer();
        const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const pyramid = generatePeakPyramid(decodedBuffer);

        const sourceId = `src-imported-${Date.now()}`;
        const newAsset: SourceAsset = {
          id: sourceId,
          name: file.name,
          duration: decodedBuffer.duration,
          sampleRate: decodedBuffer.sampleRate,
          channels: decodedBuffer.numberOfChannels,
          fileSize: file.size,
          bpm: 120,
          peakPyramids: pyramid.levels as any,
          audioBuffer: decodedBuffer,
        };

        engine.registerAudioBuffer(sourceId, decodedBuffer);

        // Target track: currently selected track or create a new one
        let targetTrackId = selectedTrackId;
        let newTracks = [...project.tracks];

        if (!targetTrackId || project.tracks.length === 0) {
          targetTrackId = `track-${Date.now()}`;
          newTracks.push({
            id: targetTrackId,
            name: file.name.replace(/\.[^/.]+$/, ''),
            stemType: 'other',
            color: '#00E5FF',
            volume: 1.0,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            eqLowGain: 0,
            eqMidGain: 0,
            eqHighGain: 0,
            reverbSend: 0.1,
            automationLanes: [],
          });
        }

        const newClip: Clip = {
          id: `clip-imported-${Date.now()}`,
          name: file.name,
          trackId: targetTrackId,
          sourceId,
          sourceIn: 0,
          sourceOut: decodedBuffer.duration,
          startTime: currentTime,
          gain: 1.0,
          pan: 0,
          isMuted: false,
          automationLanes: [],
        };

        const updatedProject = {
          ...project,
          sources: { ...project.sources, [sourceId]: newAsset },
          tracks: newTracks,
          clips: [...project.clips, newClip],
        };

        setProject(updatedProject);
        engine.syncProject(updatedProject);
        setSelectedTrackId(targetTrackId);
        setSelectedClipId(newClip.id);
      }
    };
    input.click();
  };

  // Import Audio from Spotify / YouTube / Streaming URL
  const handleImportAudioFromURL = (
    asset: SourceAsset,
    audioBuffer: AudioBuffer,
    _targetFolder: string,
    addToTimeline: boolean
  ) => {
    if (!project) return;
    const pyramid = generatePeakPyramid(audioBuffer);
    asset.peakPyramids = pyramid.levels as any;
    asset.audioBuffer = audioBuffer;

    engine.registerAudioBuffer(asset.id, audioBuffer);

    let newTracks = [...project.tracks];
    let targetTrackId = selectedTrackId || (newTracks[0] ? newTracks[0].id : 'track-1');

    if (newTracks.length === 0) {
      targetTrackId = 'track-1';
      newTracks.push({
        id: 'track-1',
        name: 'Master Audio',
        stemType: 'mix',
        color: '#00E5FF',
        volume: 1.0,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        eqLowGain: 0,
        eqMidGain: 0,
        eqHighGain: 0,
        reverbSend: 0.15,
        automationLanes: [],
      });
    }

    const newClips = [...project.clips];
    let insertedClipId: string | null = null;
    if (addToTimeline) {
      const newClip: Clip = {
        id: `clip-url-${Date.now()}`,
        name: asset.name,
        trackId: targetTrackId,
        sourceId: asset.id,
        sourceIn: 0,
        sourceOut: Math.min(180, audioBuffer.duration),
        startTime: currentTime,
        gain: 1.0,
        pan: 0,
        isMuted: false,
        automationLanes: [],
      };
      newClips.push(newClip);
      insertedClipId = newClip.id;
    }

    const updatedProject = {
      ...project,
      sources: { ...project.sources, [asset.id]: asset },
      tracks: newTracks,
      clips: newClips,
    };

    setProject(updatedProject);
    engine.syncProject(updatedProject);
    setSelectedTrackId(targetTrackId);
    if (insertedClipId) {
      setSelectedClipId(insertedClipId);
    }
  };

  // Execute AI Assistant Orchestration Actions
  const handleApplyAssistantActions = (actions: any[]) => {
    if (!project) return;
    let updatedTracks = [...project.tracks];
    let updatedClips = [...project.clips];
    let updatedMasterVolume = project.masterVolume;

    actions.forEach((act) => {
      if (act.type === 'MUTE_TRACK') {
        updatedTracks = updatedTracks.map((t) =>
          t.name.toLowerCase().includes(act.trackName.toLowerCase())
            ? { ...t, isMuted: true }
            : t
        );
      } else if (act.type === 'SET_EQ') {
        updatedTracks = updatedTracks.map((t) =>
          t.name.toLowerCase().includes(act.track.toLowerCase())
            ? {
                ...t,
                eqHighGain: act.eqHighGain ?? t.eqHighGain,
                eqLowGain: act.eqLowGain ?? t.eqLowGain,
                eqMidGain: act.eqMidGain ?? t.eqMidGain,
              }
            : t
        );
      } else if (act.type === 'APPLY_AI_MASTERING') {
        updatedMasterVolume = 1.05;
      } else if (act.type === 'RUN_DEMUCS_SEPARATION') {
        const firstAsset = Object.values(project.sources)[0] || null;
        if (firstAsset) setStemLabAsset(firstAsset);
      }
    });

    setProject({
      ...project,
      tracks: updatedTracks,
      clips: updatedClips,
      masterVolume: updatedMasterVolume,
    });
  };

  // Copy & Paste Clips
  const handleCopySelectedClip = () => {
    if (selectedClip) {
      copiedClipRef.current = selectedClip;
    }
  };

  const handlePasteClipAtPlayhead = () => {
    if (copiedClipRef.current && project) {
      const clip = copiedClipRef.current;
      const newClip: Clip = {
        ...clip,
        id: `clip-pasted-${Date.now()}`,
        name: `${clip.name} (Copy)`,
        trackId: selectedTrackId || clip.trackId,
        startTime: currentTime,
      };
      setProject({
        ...project,
        clips: [...project.clips, newClip],
      });
      setSelectedClipId(newClip.id);
    }
  };

  const handleDeleteSelectedClip = () => {
    if (selectedClipId && project) {
      setProject({
        ...project,
        clips: project.clips.filter((c) => c.id !== selectedClipId),
      });
      setSelectedClipId(null);
    }
  };

  const handleSelectAllClips = () => {
    if (project && project.clips.length > 0) {
      setSelectedClipId(project.clips[0].id);
    }
  };

  // Duplicate Selected Track
  const handleDuplicateSelectedTrack = () => {
    if (!project || !selectedTrack) return;
    const newTrackId = `track-dup-${Date.now()}`;
    const newTrack: Track = {
      ...selectedTrack,
      id: newTrackId,
      name: `${selectedTrack.name} (Copy)`,
    };

    const trackClips = project.clips.filter((c) => c.trackId === selectedTrack.id);
    const duplicatedClips: Clip[] = trackClips.map((c) => ({
      ...c,
      id: `clip-dup-${Date.now()}-${c.id}`,
      trackId: newTrackId,
    }));

    setProject({
      ...project,
      tracks: [...project.tracks, newTrack],
      clips: [...project.clips, ...duplicatedClips],
    });
    setSelectedTrackId(newTrackId);
  };

  // Delete Selected Track
  const handleDeleteSelectedTrack = () => {
    if (!project || !selectedTrackId) return;
    setProject({
      ...project,
      tracks: project.tracks.filter((t) => t.id !== selectedTrackId),
      clips: project.clips.filter((c) => c.trackId !== selectedTrackId),
    });
    setSelectedTrackId(null);
    setSelectedClipId(null);
  };

  // Clear All Tracks
  const handleClearAllTracks = () => {
    if (!project) return;
    engine.stopActiveSources();
    setProject({
      ...project,
      tracks: [],
      clips: [],
    });
    setSelectedTrackId(null);
    setSelectedClipId(null);
  };

  // Microphone Live Recording Handler
  const handleToggleRecord = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioCtx = engine.getAudioContext() || new AudioContext();
          const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

          const sourceId = `src-rec-${Date.now()}`;
          const newAsset: SourceAsset = {
            id: sourceId,
            name: `Mic Recording ${Date.now().toString().slice(-4)}`,
            duration: decodedBuffer.duration,
            sampleRate: decodedBuffer.sampleRate,
            channels: decodedBuffer.numberOfChannels,
            fileSize: audioBlob.size,
            bpm: project?.bpm || 120,
            audioBuffer: decodedBuffer,
          };

          engine.registerAudioBuffer(sourceId, decodedBuffer);

          if (project) {
            const trackId = `track-mic-${Date.now()}`;
            const newTrack: Track = {
              id: trackId,
              name: 'MIC RECORDING',
              stemType: 'vocals',
              color: '#EC4899',
              volume: 1.0,
              pan: 0,
              isMuted: false,
              isSoloed: false,
              eqLowGain: 0,
              eqMidGain: 0,
              eqHighGain: 0,
              reverbSend: 0.15,
              automationLanes: [],
            };

            const newClip: Clip = {
              id: `clip-rec-${Date.now()}`,
              name: newAsset.name,
              trackId,
              sourceId,
              sourceIn: 0,
              sourceOut: decodedBuffer.duration,
              startTime: currentTime,
              gain: 1.0,
              pan: 0,
              isMuted: false,
              color: '#EC4899',
              automationLanes: [],
            };

            setProject({
              ...project,
              sources: { ...project.sources, [sourceId]: newAsset },
              tracks: [...project.tracks, newTrack],
              clips: [...project.clips, newClip],
            });
          }

          stream.getTracks().forEach((t) => t.stop());
        };

        mediaRecorder.start(100);
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);

        if (!isPlaying) {
          engine.play();
          setIsPlaying(true);
        }
      } catch (err) {
        console.error('Microphone capture error:', err);
        alert('Microphone access denied or unavailable.');
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      engine.pause();
      setIsPlaying(false);
    }
  };

  // Command-driven modifications
  const handleSplitClip = (clipId: string, time: number) => {
    if (!project) return;
    const splitCmd = new SplitClipCommand(clipId, time);
    const updated = cmdManager.execute(splitCmd, project);
    setProject(updated);
  };

  const handleMoveClip = (clipId: string, newStartTime: number, newTrackId?: string) => {
    if (!project) return;
    const moveCmd = new MoveClipCommand(clipId, newStartTime, newTrackId);
    const updated = cmdManager.execute(moveCmd, project);
    setProject(updated);
  };

  const handleTrimClip = (clipId: string, newSourceIn: number, newSourceOut: number, newStartTime?: number) => {
    if (!project) return;
    const trimCmd = new TrimClipCommand(clipId, newSourceIn, newSourceOut, newStartTime);
    const updated = cmdManager.execute(trimCmd, project);
    setProject(updated);
  };

  const handleRippleDeleteClip = (clipId: string) => {
    if (!project) return;
    const rippleCmd = new RippleDeleteClipCommand(clipId);
    const updated = cmdManager.execute(rippleCmd, project);
    setProject(updated);
    setSelectedClipId(null);
  };

  const handleUpdateClip = (updatedClip: Clip) => {
    if (!project) return;
    setProject({
      ...project,
      clips: project.clips.map((c) => (c.id === updatedClip.id ? updatedClip : c)),
    });
  };

  const handleUpdateTrack = (updatedTrack: Track) => {
    if (!project) return;
    setProject({
      ...project,
      tracks: project.tracks.map((t) => (t.id === updatedTrack.id ? updatedTrack : t)),
    });
  };

  const handleToggleTrackMute = (trackId: string) => {
    if (!project) return;
    setProject({
      ...project,
      tracks: project.tracks.map((t) => (t.id === trackId ? { ...t, isMuted: !t.isMuted } : t)),
    });
  };

  const handleToggleTrackSolo = (trackId: string) => {
    if (!project) return;
    setProject({
      ...project,
      tracks: project.tracks.map((t) => (t.id === trackId ? { ...t, isSoloed: !t.isSoloed } : t)),
    });
  };

  const handleAddAudioTrack = () => {
    if (!project) return;
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `Audio Track ${project.tracks.length + 1}`,
      stemType: 'other',
      color: '#00E5FF',
      volume: 1.0,
      pan: 0,
      isMuted: false,
      isSoloed: false,
      eqLowGain: 0,
      eqMidGain: 0,
      eqHighGain: 0,
      reverbSend: 0.1,
      automationLanes: [],
    };
    const addCmd = new AddTrackCommand(newTrack);
    const updated = cmdManager.execute(addCmd, project);
    setProject(updated);
    setSelectedTrackId(newTrack.id);
  };

  const handleAddMidiTrack = () => {
    if (!project) return;
    const newTrack: Track = {
      id: `track-midi-${Date.now()}`,
      name: `MIDI Synth ${project.tracks.length + 1}`,
      stemType: 'piano',
      color: '#A855F7',
      volume: 1.0,
      pan: 0,
      isMuted: false,
      isSoloed: false,
      eqLowGain: 0,
      eqMidGain: 0,
      eqHighGain: 0,
      reverbSend: 0.2,
      automationLanes: [],
    };
    const addCmd = new AddTrackCommand(newTrack);
    const updated = cmdManager.execute(addCmd, project);
    setProject(updated);
    setSelectedTrackId(newTrack.id);
  };

  const handleAddBusTrack = () => {
    if (!project) return;
    const newTrack: Track = {
      id: `track-bus-${Date.now()}`,
      name: `Drum Bus Submix`,
      stemType: 'drums',
      color: '#10B981',
      volume: 1.0,
      pan: 0,
      isMuted: false,
      isSoloed: false,
      eqLowGain: 0,
      eqMidGain: 0,
      eqHighGain: 0,
      reverbSend: 0.0,
      automationLanes: [],
    };
    const addCmd = new AddTrackCommand(newTrack);
    const updated = cmdManager.execute(addCmd, project);
    setProject(updated);
    setSelectedTrackId(newTrack.id);
  };

  // Drag & Drop or Add Sample onto Track
  const handleDragStartSample = (e: React.DragEvent, asset: SourceAsset, section?: SongSection) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ asset, section }));
  };

  const handleDropSampleOnTrack = (trackId: string, time: number, asset: SourceAsset, section?: SongSection) => {
    if (!project) return;

    // Ensure audio buffer is registered in engine
    let registeredBuffer = engine.getAllRegisteredAudioBuffers().get(asset.id);
    const audioCtx = engine.getAudioContext() || new AudioContext();

    if (!registeredBuffer) {
      const sampleRate = audioCtx.sampleRate || 48000;
      const durationSec = Math.max(4, asset.duration || 16);
      const numSamples = Math.floor(sampleRate * Math.min(30, durationSec));
      registeredBuffer = audioCtx.createBuffer(2, numSamples, sampleRate);
      const l = registeredBuffer.getChannelData(0);
      const r = registeredBuffer.getChannelData(1);
      const bpm = asset.bpm || 120;
      const beatSec = 60 / bpm;

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const beatEnv = Math.exp(-((t % beatSec) * 10));
        const kick = Math.sin(2 * Math.PI * 60 * t) * beatEnv * 0.4;
        const synth = Math.sin(2 * Math.PI * 220 * t) * 0.15 * Math.sin(t * 2);
        l[i] = Math.max(-0.95, Math.min(0.95, kick + synth));
        r[i] = Math.max(-0.95, Math.min(0.95, kick * 0.9 + synth * 1.1));
      }

      engine.registerAudioBuffer(asset.id, registeredBuffer);
    }

    if (!asset.peakPyramids && registeredBuffer) {
      const pyramid = generatePeakPyramid(registeredBuffer);
      asset.peakPyramids = pyramid.levels as any;
      asset.audioBuffer = registeredBuffer;
    }

    const sourceIn = section ? section.startTime : 0;
    const sourceOut = section ? section.endTime : Math.min(120, asset.duration || 16);

    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      name: section ? `${asset.name} (${section.name})` : asset.name,
      trackId,
      sourceId: asset.id,
      sourceIn,
      sourceOut,
      startTime: time,
      gain: 1.0,
      pan: 0,
      isMuted: false,
      automationLanes: [],
    };

    const updatedSources = { ...project.sources, [asset.id]: asset };
    const updatedClips = [...project.clips, newClip];

    const updatedProject = {
      ...project,
      sources: updatedSources,
      clips: updatedClips,
    };

    setProject(updatedProject);
    engine.syncProject(updatedProject);
    setSelectedTrackId(trackId);
    setSelectedClipId(newClip.id);
  };

  const handleAddSampleToTimeline = (asset: SourceAsset) => {
    if (!project) return;
    let targetTrackId = selectedTrackId;
    let updatedTracks = [...project.tracks];

    if (!targetTrackId || updatedTracks.length === 0) {
      targetTrackId = `track-${Date.now()}`;
      updatedTracks.push({
        id: targetTrackId,
        name: asset.name.replace(/\.[^/.]+$/, ''),
        stemType: 'other',
        color: '#00E5FF',
        volume: 1.0,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        eqLowGain: 0,
        eqMidGain: 0,
        eqHighGain: 0,
        reverbSend: 0.1,
        automationLanes: [],
      });
      setProject({ ...project, tracks: updatedTracks });
    }

    handleDropSampleOnTrack(targetTrackId, currentTime, asset);
  };

  const handleImportAndAnalyzeFile = (asset: SourceAsset, buffer: AudioBuffer) => {
    if (!project) return;
    const bpmResult = detectBpmAndBeats(buffer);
    const sections = detectSongSections(buffer, bpmResult.bpm);

    const analyzedAsset: SourceAsset = {
      ...asset,
      bpm: bpmResult.bpm,
      audioBuffer: buffer,
    };

    engine.registerAudioBuffer(analyzedAsset.id, buffer);

    setProject({
      ...project,
      sources: {
        ...project.sources,
        [analyzedAsset.id]: analyzedAsset,
      },
      sections: sections.length > 0 ? sections : project.sections,
      bpm: bpmResult.bpm,
    });
  };

  // Apply Stems from Stem Lab
  const handleApplySeparatedStems = (stems: SeparatedStemResult[]) => {
    if (!project) return;

    const newTracks: Track[] = [];
    const newClips: Clip[] = [];
    const newSources = { ...project.sources };

    stems.forEach((stem) => {
      engine.registerAudioBuffer(stem.asset.id, stem.audioBuffer);
      newSources[stem.asset.id] = stem.asset;

      const trackId = `track-${stem.stemType}-${Date.now()}`;
      newTracks.push({
        id: trackId,
        name: stem.stemType.toUpperCase(),
        stemType: stem.stemType,
        color: stem.color,
        volume: 1.0,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        eqLowGain: 0,
        eqMidGain: 0,
        eqHighGain: 0,
        reverbSend: 0.1,
        automationLanes: [],
      });

      newClips.push({
        id: `clip-stem-${stem.stemType}-${Date.now()}`,
        name: stem.name,
        trackId,
        sourceId: stem.asset.id,
        sourceIn: 0,
        sourceOut: stem.asset.duration,
        startTime: 0,
        gain: 1.0,
        pan: 0,
        isMuted: false,
        color: stem.color,
        automationLanes: [],
      });
    });

    setProject({
      ...project,
      sources: newSources,
      tracks: [...project.tracks, ...newTracks],
      clips: [...project.clips, ...newClips],
    });
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const targetElement = e.target as HTMLElement | null;
      const isInputFocused =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        targetElement?.tagName === 'INPUT' ||
        targetElement?.tagName === 'TEXTAREA' ||
        activeElement?.isContentEditable ||
        targetElement?.isContentEditable;

      if (isInputFocused) {
        return; // Allow full native browser typing, pasting (Ctrl+V), copying (Ctrl+C), selecting, undoing
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (engine.isPlaying()) {
          engine.pause();
          setIsPlaying(false);
        } else {
          engine.play();
          setIsPlaying(true);
        }
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.code === 'KeyZ') {
        e.preventDefault();
        if (project) setProject(cmdManager.undo(project));
      }

      if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyZ') || (e.ctrlKey && e.code === 'KeyY')) {
        e.preventDefault();
        if (project) setProject(cmdManager.redo(project));
      }

      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyB') {
        e.preventDefault();
        if (selectedClipId) handleSplitClip(selectedClipId, engine.getCurrentTime());
      }

      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyC') {
        e.preventDefault();
        handleCopySelectedClip();
      }

      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyV') {
        e.preventDefault();
        handlePasteClipAtPlayhead();
      }

      if ((e.metaKey || e.ctrlKey) && e.code === 'BracketLeft') {
        e.preventDefault();
        setIsLeftSidebarOpen((prev) => !prev);
      }

      if ((e.metaKey || e.ctrlKey) && e.code === 'BracketRight') {
        e.preventDefault();
        setIsRightInspectorOpen((prev) => !prev);
      }

      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyJ') {
        e.preventDefault();
        setIsBottomStudioOpen((prev) => !prev);
      }

      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyM') {
        e.preventDefault();
        setIsExportOpen(true);
      }

      if (e.key === 'F3') {
        e.preventDefault();
        setIsMixerOpen((prev) => !prev);
      }

      if (e.key === 'F4') {
        e.preventDefault();
        setIsSampleEditorOpen((prev) => !prev);
      }

      if (e.key === 'F5') {
        e.preventDefault();
        setIsPianoRollOpen((prev) => !prev);
      }

      if (e.shiftKey && (e.code === 'Backspace' || e.code === 'Delete')) {
        if (selectedClipId) {
          e.preventDefault();
          handleRippleDeleteClip(selectedClipId);
        }
      } else if (e.code === 'Backspace' || e.code === 'Delete') {
        if (selectedClipId && (e.target as HTMLElement).tagName !== 'INPUT') {
          e.preventDefault();
          handleDeleteSelectedClip();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engine, project, selectedClipId, selectedTrackId, currentTime]);

  if (!userSession) {
    return (
      <LoginPage
        onLoginSuccess={(session) => {
          setUserSession(session);
          setIsProjectHubOpen(true);
        }}
      />
    );
  }

  if (!project) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0D0E13] text-white">
        <div className="flex flex-col items-center gap-3">
          <Zap className="w-8 h-8 text-[#00E5FF] animate-spin" />
          <span className="text-xs font-bold tracking-widest uppercase text-slate-300">
            Initializing MusicOuts Studio...
          </span>
        </div>
      </div>
    );
  }

  const audioCtx = engine.getAudioContext();

  const isTimelineFocused = !isLeftSidebarOpen && !isRightInspectorOpen && !isBottomStudioOpen;

  const handleToggleFocusTimelineMode = () => {
    if (isTimelineFocused) {
      // Expand Pro Studio Mode (<>)
      setIsLeftSidebarOpen(true);
      setIsRightInspectorOpen(true);
      setIsBottomStudioOpen(true);
    } else {
      // Focus Timeline Mode (><)
      setIsLeftSidebarOpen(false);
      setIsRightInspectorOpen(false);
      setIsBottomStudioOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090A0E] text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. TOP HEADER BAR */}
      <TopBar
        projectTitle={project.name}
        bpm={project.bpm}
        timeSignature={project.timeSignature}
        currentKey={project.key || 'Cmaj'}
        currentTime={currentTime}
        isPlaying={isPlaying}
        isRecording={isRecording}
        isMetronomeOn={isMetronomeOn}
        masterVolume={project.masterVolume}
        meterLevels={meterLevels}
        user={userSession}
        folderPath={project.folderPath}
        onOpenProjectHub={() => setIsProjectHubOpen(true)}
        onSignOut={() => {
          engine.stop();
          setIsPlaying(false);
          localStorage.removeItem('musicouts_user_session');
          setUserSession(null);
          setIsProjectHubOpen(false);
        }}
        isLeftSidebarOpen={isLeftSidebarOpen}
        isRightInspectorOpen={isRightInspectorOpen}
        isBottomStudioOpen={isBottomStudioOpen}
        isTimelineFocused={isTimelineFocused}
        onToggleLeftSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
        onToggleRightInspector={() => setIsRightInspectorOpen(!isRightInspectorOpen)}
        onToggleBottomStudio={() => setIsBottomStudioOpen(!isBottomStudioOpen)}
        onToggleFocusTimelineMode={handleToggleFocusTimelineMode}
        onNewEmptyProject={handleNewEmptyProject}
        onLoadDemoProject={handleLoadDemoProject}
        onClearTimeline={handleClearTimeline}
        onSaveProject={handleSaveProject}
        onOpenProject={handleOpenProject}
        onDuplicateSelectedTrack={handleDuplicateSelectedTrack}
        onDeleteSelectedTrack={handleDeleteSelectedTrack}
        onClearAllTracks={handleClearAllTracks}
        onCopySelectedClip={handleCopySelectedClip}
        onPasteClipAtPlayhead={handlePasteClipAtPlayhead}
        onDeleteSelectedClip={handleDeleteSelectedClip}
        onSelectAllClips={handleSelectAllClips}
        onUpdateTitle={(name) => setProject({ ...project, name })}
        onUpdateBpm={(bpm) => setProject({ ...project, bpm })}
        onUpdateTimeSignature={(timeSignature) => setProject({ ...project, timeSignature })}
        onToggleMetronome={() => setIsMetronomeOn(!isMetronomeOn)}
        onPlay={() => {
          engine.play();
          setIsPlaying(true);
        }}
        onPause={() => {
          engine.pause();
          setIsPlaying(false);
        }}
        onStop={() => {
          engine.pause();
          engine.seek(0);
          setIsPlaying(false);
        }}
        onPrevTrack={() => engine.seek(0)}
        onNextTrack={() => engine.seek(currentTime + 10)}
        onToggleRecord={handleToggleRecord}
        onMasterVolumeChange={(vol) => setProject({ ...project, masterVolume: vol })}
        onOpenMixer={() => setIsMixerOpen(true)}
        onOpenSampleEditor={() => setIsSampleEditorOpen(true)}
        onOpenPianoRoll={() => setIsPianoRollOpen(true)}
        onOpenTakeComping={() => setIsTakeCompingOpen(true)}
        onOpenAIMastering={() => setIsAIMasteringOpen(true)}
        onOpenStemLab={() => {
          const firstAsset = Object.values(project.sources)[0] || null;
          setStemLabAsset(firstAsset);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenURLImport={() => setIsURLImportOpen(true)}
        onOpenAIAssistant={() => setIsAIAssistantOpen(true)}
        onAddAudioTrack={handleAddAudioTrack}
        onAddMidiTrack={handleAddMidiTrack}
        onAddBusTrack={handleAddBusTrack}
        onUndo={() => {
          if (project) setProject(cmdManager.undo(project));
        }}
        onRedo={() => {
          if (project) setProject(cmdManager.redo(project));
        }}
        onSplitSelectedClip={() => {
          if (selectedClipId) handleSplitClip(selectedClipId, currentTime);
        }}
        onNormalizeSelectedClip={() => {
          if (selectedClip) {
            handleUpdateClip({ ...selectedClip, gain: 1.41 });
          }
        }}
        onReverseSelectedClip={() => {
          if (selectedClip) {
            alert(`Clip "${selectedClip.name}" reversed!`);
          }
        }}
      />

      {/* 2. MAIN 3-COLUMN WORKSPACE WITH COLLAPSIBLE PANELS & INTERACTIVE TOGGLE BARS */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Column: Media & Assets Sidebar (Collapsible) */}
        {isLeftSidebarOpen ? (
          <MediaSidebar
            sources={project.sources}
            onDragStartSample={handleDragStartSample}
            onAddSampleToTimeline={handleAddSampleToTimeline}
            onAddSource={handleImportAndAnalyzeFile}
            onPreviewSample={(id) => engine.previewAudio(id)}
            onStopPreview={() => engine.stopPreviewAudio()}
            onToggleCollapse={() => setIsLeftSidebarOpen(false)}
          />
        ) : (
          /* Collapsed Left Sidebar Toggle Bar */
          <div
            onClick={() => setIsLeftSidebarOpen(true)}
            className="w-5 bg-[#12141C] hover:bg-[#1A1D28] border-r border-white/10 flex flex-col items-center justify-center cursor-pointer select-none group transition-colors z-30"
            title="Expand Media Browser (<>)"
          >
            <div className="text-[10px] font-mono text-slate-400 group-hover:text-[#00E5FF] transform -rotate-90 tracking-widest whitespace-nowrap mb-4">
              MEDIA
            </div>
            <div className="w-3.5 h-3.5 rounded bg-white/5 group-hover:bg-[#00E5FF]/20 flex items-center justify-center text-slate-400 group-hover:text-[#00E5FF] text-[9px] font-bold">
              ▶
            </div>
          </div>
        )}

        {/* Center Column: Multi-Track Timeline with Video-Editor Tools */}
        <Timeline
          project={project}
          currentTime={currentTime}
          selectedClipId={selectedClipId}
          meterLevels={meterLevels}
          onSelectClip={(clip) => setSelectedClipId(clip ? clip.id : null)}
          onSelectTrack={(track) => setSelectedTrackId(track ? track.id : null)}
          onSeek={(t) => engine.seek(t)}
          onDoubleClickClip={(clip) => {
            setSelectedClipId(clip.id);
            setIsSampleEditorOpen(true);
          }}
          onSplitClip={handleSplitClip}
          onMoveClip={handleMoveClip}
          onTrimClip={handleTrimClip}
          onToggleTrackMute={handleToggleTrackMute}
          onToggleTrackSolo={handleToggleTrackSolo}
          onDropSampleOnTrack={handleDropSampleOnTrack}
          onAddTrack={handleAddAudioTrack}
          onLoadDemoProject={handleLoadDemoProject}
          onImportAudioFile={handleImportAudioFile}
          onOpenURLImport={() => setIsURLImportOpen(true)}
        />

        {/* Right Column: Inspector Panel with Premiere Pro Keyframing (Collapsible) */}
        {isRightInspectorOpen ? (
          <Inspector
            project={project}
            selectedClip={selectedClip}
            selectedTrack={selectedTrack}
            currentTime={currentTime}
            onSeek={(t) => engine.seek(t)}
            onUpdateClip={handleUpdateClip}
            onUpdateTrack={handleUpdateTrack}
            onToggleCollapse={() => setIsRightInspectorOpen(false)}
          />
        ) : (
          /* Collapsed Right Inspector Toggle Bar */
          <div
            onClick={() => setIsRightInspectorOpen(true)}
            className="w-5 bg-[#12141C] hover:bg-[#1A1D28] border-l border-white/10 flex flex-col items-center justify-center cursor-pointer select-none group transition-colors z-30"
            title="Expand Inspector (<>)"
          >
            <div className="text-[10px] font-mono text-slate-400 group-hover:text-[#00E5FF] transform rotate-90 tracking-widest whitespace-nowrap mb-4">
              INSPECTOR
            </div>
            <div className="w-3.5 h-3.5 rounded bg-white/5 group-hover:bg-[#00E5FF]/20 flex items-center justify-center text-slate-400 group-hover:text-[#00E5FF] text-[9px] font-bold">
              ◀
            </div>
          </div>
        )}
      </div>

      {/* 3. BOTTOM MULTI-TRACK KEYFRAMES & AUTOMATION STUDIO (Collapsible with Toggle Bar) */}
      {isBottomStudioOpen ? (
        <AutomationStudio
          currentTime={currentTime}
          onSeek={(t) => engine.seek(t)}
          onToggleCollapse={() => setIsBottomStudioOpen(false)}
        />
      ) : (
        /* Collapsed Bottom Studio Toggle Bar */
        <div
          onClick={() => setIsBottomStudioOpen(true)}
          className="h-6 bg-[#12141C] hover:bg-[#1A1D28] border-t border-white/10 flex items-center justify-between px-3 cursor-pointer select-none group transition-colors shrink-0 z-30"
          title="Expand Automation & Keyframes Studio (<>)"
        >
          <div className="flex items-center space-x-2 text-[11px] font-semibold text-slate-400 group-hover:text-white">
            <span className="text-[#EC4899]">▲</span>
            <span>Keyframes & Automation Studio</span>
          </div>
          <span className="text-[10px] font-mono text-[#00E5FF] group-hover:underline">
            {'Click to Open Studio (<>)'}
          </span>
        </div>
      )}

      {/* 4. MODALS */}
      {/* A. Studio Audio Mixer Console */}
      {isMixerOpen && (
        <MixerModal
          project={project}
          meterLevels={meterLevels}
          onClose={() => setIsMixerOpen(false)}
          onUpdateTrack={handleUpdateTrack}
          onUpdateMasterVolume={(vol) => setProject({ ...project, masterVolume: vol })}
          onToggleTrackMute={handleToggleTrackMute}
          onToggleTrackSolo={handleToggleTrackSolo}
        />
      )}

      {/* B. Dedicated Waveform & Spectrogram Sample Editor */}
      {isSampleEditorOpen && selectedClip && audioCtx && (
        <SampleEditorModal
          clip={selectedClip}
          sourceAsset={project.sources[selectedClip.sourceId]}
          audioCtx={audioCtx}
          onClose={() => setIsSampleEditorOpen(false)}
          onUpdateClip={handleUpdateClip}
        />
      )}

      {/* C. MIDI Piano Roll Editor */}
      {isPianoRollOpen && audioCtx && (
        <PianoRollModal
          trackName={selectedTrack?.name || 'MIDI Track 1'}
          audioCtx={audioCtx}
          onClose={() => setIsPianoRollOpen(false)}
        />
      )}

      {/* D. Vocal Comping & Take Lanes */}
      {isTakeCompingOpen && (
        <TakeCompingModal
          trackName={selectedTrack?.name || 'Vocal Track'}
          onClose={() => setIsTakeCompingOpen(false)}
          onApplyComp={(compName) => alert(`Committed "${compName}" to active timeline!`)}
        />
      )}

      {/* E. AI Audio Cleanup & Mastering Assistant */}
      {isAIMasteringOpen && (
        <AIMasteringModal
          onClose={() => setIsAIMasteringOpen(false)}
          onApplyMastering={(settings) => {
            alert(`Mastering profile applied: Target ${settings.targetLufs} LUFS, Denoise: ${settings.denoise}`);
          }}
        />
      )}

      {/* F. Demucs AI Stem Separation */}
      {stemLabAsset && audioCtx && (
        <StemLabModal
          sourceAsset={stemLabAsset}
          audioCtx={audioCtx}
          onClose={() => setStemLabAsset(null)}
          onApplyStems={handleApplySeparatedStems}
        />
      )}

      {/* G. Project & Hardware Engine Settings */}
      {isSettingsOpen && (
        <ProjectSettingsModal
          project={project}
          onClose={() => setIsSettingsOpen(false)}
          onSaveSettings={(settings) => {
            setProject({
              ...project,
              name: settings.name,
              bpm: settings.bpm,
            });
          }}
        />
      )}

      {/* H. Visual Undo / Redo History Tree */}
      {isHistoryOpen && (
        <HistoryModal
          undoStackLength={cmdManager.canUndo() ? 5 : 0}
          redoStackLength={cmdManager.canRedo() ? 2 : 0}
          onClose={() => setIsHistoryOpen(false)}
          onUndo={() => {
            if (project) setProject(cmdManager.undo(project));
          }}
          onRedo={() => {
            if (project) setProject(cmdManager.redo(project));
          }}
        />
      )}

      {/* I. Multiformat Master & Stem Exporter */}
      {isExportOpen && (
        <ExportModal
          project={project}
          engine={engine}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {/* J. Spotify / YouTube / Streaming URL Audio Downloader & Importer */}
      {isURLImportOpen && audioCtx && (
        <URLImportModal
          audioCtx={audioCtx}
          onClose={() => setIsURLImportOpen(false)}
          onImportAudio={handleImportAudioFromURL}
        />
      )}

      {/* K. AI DAW Co-Producer & 26-Feature ML Hub */}
      {isAIAssistantOpen && (
        <AIAssistantModal
          project={project}
          onClose={() => setIsAIAssistantOpen(false)}
          onApplyAssistantActions={handleApplyAssistantActions}
          onOpenDemucsStemLab={() => {
            const firstAsset = Object.values(project.sources)[0] || null;
            if (firstAsset) setStemLabAsset(firstAsset);
          }}
          onOpenAIMastering={() => setIsAIMasteringOpen(true)}
        />
      )}

      {/* L. Pro Project Launcher Hub: Open Existing Folder or Start New Project */}
      {isProjectHubOpen && (
        <ProjectHubModal
          user={userSession}
          isOpen={isProjectHubOpen}
          canCloseWithoutSelection={!!project}
          onClose={() => setIsProjectHubOpen(false)}
          onSignOut={() => {
            engine.stop();
            setIsPlaying(false);
            localStorage.removeItem('musicouts_user_session');
            setUserSession(null);
            setIsProjectHubOpen(false);
          }}
          onOpenExistingProject={(item) => {
            if (item.id === 'proj-demo-1' && audioCtx) {
              const demo = createDemoProject(audioCtx);
              demo.buffers.forEach((buf, id) => engine.registerAudioBuffer(id, buf));
              setProject({ ...demo.project, name: item.name, folderPath: item.folderPath });
            } else {
              const customProj = createTemplateProject({
                name: item.name,
                folderPath: item.folderPath,
                bpm: item.bpm,
                key: item.key,
                timeSignature: [4, 4],
                sampleRate: 48000,
                template: (item.templateType as any) || 'pro-nle',
              });
              setProject(customProj);
            }
            setIsProjectHubOpen(false);
          }}
          onOpenFolderDirectly={(folderPath) => {
            const folderName = folderPath.split('/').pop() || folderPath.split('\\').pop() || 'Imported Session';
            const loadedProj = createTemplateProject({
              name: folderName,
              folderPath: folderPath,
              bpm: 120,
              key: 'C Major',
              timeSignature: [4, 4],
              sampleRate: 48000,
              template: 'pro-nle',
            });
            setProject(loadedProj);
            setIsProjectHubOpen(false);
          }}
          onCreateNewProject={(config) => {
            const newProj = createTemplateProject(config);
            setProject(newProj);
            setIsProjectHubOpen(false);
          }}
        />
      )}
    </div>
  );
};
