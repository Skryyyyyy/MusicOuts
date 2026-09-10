import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Youtube, Upload, Sparkles, AlertCircle, RefreshCw, Music, X, Play, Pause, Scissors, RotateCcw } from 'lucide-react';
import { ProcessStatus, ProcessStage, TrackMetadata, StemType, MediaPreviewData } from '../types';

export interface UrlUploaderProps {
  onTrackLoaded: (track: TrackMetadata) => void;
  onStatusChange?: (status: ProcessStatus) => void;
  className?: string;
}

export type PlatformType = 'youtube' | 'spotify' | 'apple' | 'soundcloud' | 'upload';

interface PlatformConfig {
  id: PlatformType;
  name: string;
  badge: string;
  placeholder: string;
  activeBorder: string;
  activeBg: string;
  activeText: string;
  accentHex: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    badge: 'Video & Audio',
    placeholder: 'Paste YouTube music or video URL...',
    activeBorder: 'border-red-500/60',
    activeBg: 'bg-red-500/10',
    activeText: 'text-red-400',
    accentHex: '#ef4444',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    badge: 'Tracks & Albums',
    placeholder: 'Paste Spotify track link (e.g. https://open.spotify.com/track/...)...',
    activeBorder: 'border-emerald-500/60',
    activeBg: 'bg-emerald-500/10',
    activeText: 'text-emerald-400',
    accentHex: '#10b981',
  },
  {
    id: 'apple',
    name: 'Apple Music',
    badge: 'Lossless Audio',
    placeholder: 'Paste Apple Music track link (e.g. https://music.apple.com/...)...',
    activeBorder: 'border-rose-500/60',
    activeBg: 'bg-rose-500/10',
    activeText: 'text-rose-400',
    accentHex: '#f43f5e',
  },
  {
    id: 'soundcloud',
    name: 'SoundCloud',
    badge: 'Direct Stream',
    placeholder: 'Paste SoundCloud track URL (e.g. https://soundcloud.com/...)...',
    activeBorder: 'border-orange-500/60',
    activeBg: 'bg-orange-500/10',
    activeText: 'text-orange-400',
    accentHex: '#f97316',
  },
  {
    id: 'upload',
    name: 'Local File',
    badge: 'MP3/WAV/FLAC',
    placeholder: 'Select or drag local audio file to demix...',
    activeBorder: 'border-primary/60',
    activeBg: 'bg-primary/10',
    activeText: 'text-primary',
    accentHex: '#89ceff',
  },
];

const PLATFORM_PRESETS: Record<PlatformType, Array<{ name: string; url: string }>> = {
  youtube: [
    {
      name: 'Synthwave Cyber Anthem',
      url: 'https://www.youtube.com/watch?v=k3WkJq4gkUA',
    },
    {
      name: 'Future Bass Drop',
      url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
    },
    {
      name: 'Lo-Fi Chill Hop Beat',
      url: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
    },
  ],
  spotify: [
    {
      name: 'Blinding Lights (The Weeknd)',
      url: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
    },
    {
      name: 'Starboy (Daft Punk)',
      url: 'https://open.spotify.com/track/7MXVkk9YM5IZxh0wAEAGdo',
    },
    {
      name: 'Midnight City (M83)',
      url: 'https://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt',
    },
  ],
  apple: [
    {
      name: 'Levitating (Dua Lipa)',
      url: 'https://music.apple.com/us/album/levitating/1538003494?i=1538003499',
    },
    {
      name: 'Save Your Tears (The Weeknd)',
      url: 'https://music.apple.com/us/album/save-your-tears/1499378108?i=1499378613',
    },
    {
      name: 'Stay (Kid LAROI & Justin Bieber)',
      url: 'https://music.apple.com/us/album/stay/1575970498?i=1575970500',
    },
  ],
  soundcloud: [
    {
      name: 'Chillhop Essentials',
      url: 'https://soundcloud.com/chillhopdotcom/sets/chillhop-essentials-spring-2023',
    },
    {
      name: 'Cyber City Vibes',
      url: 'https://soundcloud.com/synthwave-radio/cyber-city-vibes',
    },
    {
      name: 'Synthwave Outrun',
      url: 'https://soundcloud.com/retro-synthwave/synthwave-outrun-drive',
    },
  ],
  upload: [],
};

const formatTime = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// SVG Platform Icon renderer
const renderPlatformIcon = (platform: PlatformType, className: string = 'w-4 h-4') => {
  switch (platform) {
    case 'youtube':
      return <Youtube className={className} />;
    case 'spotify':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10 5.524 0 10-4.476 10-10 0-5.523-4.476-10-10-10zm4.587 14.428a.625.625 0 0 1-.861.206c-2.355-1.44-5.32-1.765-8.813-.966a.625.625 0 1 1-.278-1.219c3.826-.874 7.106-.505 9.746 1.118a.625.625 0 0 1 .206.861zm1.226-2.727a.782.782 0 0 1-1.077.257c-2.697-1.658-6.808-2.136-9.997-1.168a.783.783 0 0 1-.456-1.498c3.642-1.106 8.19-.575 11.274 1.332a.782.782 0 0 1 .256 1.077zm.106-2.836C14.693 8.93 9.385 8.749 6.305 9.684a.938.938 0 1 1-.546-1.794c3.535-1.073 9.404-.863 13.125 1.346a.938.938 0 1 1-.965 1.629z" />
        </svg>
      );
    case 'apple':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.66-1.08 1.73-.95 2.76 1.01.08 2.05-.51 2.68-1.26z" />
        </svg>
      );
    case 'soundcloud':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M1.175 12.225c-.097 0-.175.08-.175.176v4.619c0 .097.078.176.175.176.096 0 .175-.079.175-.176v-4.619c0-.096-.079-.176-.175-.176zm1.313-1.57c-.11 0-.2.09-.2.2v7.76c0 .11.09.2.2.2.11 0 .2-.09.2-.2v-7.76c0-.11-.09-.2-.2-.2zm1.4 1.15c-.12 0-.218.098-.218.218v6.452c0 .12.098.218.218.218.12 0 .218-.098.218-.218v-6.452c0-.12-.098-.218-.218-.218zm1.488-2.685c-.13 0-.236.106-.236.236v11.836c0 .13.106.236.236.236.13 0 .236-.106.236-.236v-11.836c0-.13-.106-.236-.236-.236zm1.575-.92c-.141 0-.255.114-.255.255v13.676c0 .141.114.255.255.255.141 0 .255-.114.255-.255V8.455c0-.141-.114-.255-.255-.255zm1.663-1.02c-.152 0-.274.122-.274.273v15.717c0 .151.122.274.274.274.151 0 .273-.123.273-.274V7.433c0-.151-.122-.273-.273-.273zm1.75-.436c-.162 0-.293.131-.293.293v16.586c0 .162.131.293.293.293.162 0 .293-.131.293-.293V7.002c0-.162-.131-.293-.293-.293zm1.838-.073c-.173 0-.313.14-.313.313v16.732c0 .173.14.313.313.313.173 0 .313-.14.313-.313V6.929c0-.173-.14-.313-.313-.313zm1.846.505c-.132 0-.246.08-.292.197a6.23 6.23 0 0 1 1.637-.217c2.32 0 4.318 1.282 5.347 3.164a4.975 4.975 0 0 1 2.22-.52c2.756 0 4.992 2.236 4.992 4.993s-2.236 4.992-4.992 4.992H12.5a.333.333 0 0 1-.333-.333V7.458c0-.184-.149-.333-.333-.333-.065 0-.125.019-.176.051-.044-.085-.128-.142-.228-.142z" />
        </svg>
      );
    case 'upload':
      return <Upload className={className} />;
  }
};

export const UrlUploader: React.FC<UrlUploaderProps> = ({
  onTrackLoaded,
  onStatusChange,
  className = '',
}) => {
  const [activePlatform, setActivePlatform] = useState<PlatformType>('youtube');
  const [url, setUrl] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [status, setStatus] = useState<ProcessStatus>({
    stage: 'ready',
    progress: 0,
    message: 'Ready for track ingestion',
  });

  // Preview & Timeline Range Pickup State
  const [preview, setPreview] = useState<MediaPreviewData | null>(null);
  const [rangeStart, setRangeStart] = useState<number>(0);
  const [rangeEnd, setRangeEnd] = useState<number>(60);
  const [previewCurrentTime, setPreviewCurrentTime] = useState<number>(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const currentPlatformConfig = PLATFORMS.find((p) => p.id === activePlatform) || PLATFORMS[0];

  const updateStatus = useCallback(
    (newStatus: ProcessStatus) => {
      setStatus(newStatus);
      if (onStatusChange) {
        onStatusChange(newStatus);
      }
    },
    [onStatusChange]
  );

  // Sync audio element time
  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setPreviewCurrentTime(audio.currentTime);
    };
    const handleEnded = () => {
      setIsPreviewPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [preview]);

  const togglePreviewPlay = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    if (isPreviewPlaying) {
      audio.pause();
      setIsPreviewPlaying(false);
    } else {
      if (audio.currentTime < rangeStart || audio.currentTime >= rangeEnd) {
        audio.currentTime = rangeStart;
      }
      audio.play().catch(() => {});
      setIsPreviewPlaying(true);
    }
  };

  const seekPreview = (timeSec: number) => {
    const audio = previewAudioRef.current;
    if (audio) {
      audio.currentTime = timeSec;
      setPreviewCurrentTime(timeSec);
    }
  };

  // Connect to SSE stream for live progress updates
  const listenToProgress = useCallback(
    (taskId: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(`/api/process/${taskId}/events`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const stage: ProcessStage = data.stage || 'separating';
          const progress = typeof data.progress === 'number' ? data.progress : 0;
          const message = data.message || 'Processing audio stems...';

          updateStatus({
            stage,
            progress,
            message,
            result: data.result,
          });

          if (stage === 'ready' || progress >= 100) {
            es.close();
            setIsProcessing(false);

            // Construct loaded track metadata
            const trackId = data.result?.id || taskId;
            const stems: Record<StemType, string> = {
              vocals: `/api/media/${trackId}/vocals`,
              drums: `/api/media/${trackId}/drums`,
              bass: `/api/media/${trackId}/bass`,
              other: `/api/media/${trackId}/other`,
            };

            const trackMetadata: TrackMetadata = {
              id: trackId,
              title: data.result?.title || preview?.title || 'Processed Stem Track',
              duration: data.result?.duration || (rangeEnd - rangeStart) || 180,
              hasVideo: !!data.result?.has_video,
              videoUrl: data.result?.video_url || `/api/media/${trackId}/video`,
              stems,
            };

            onTrackLoaded(trackMetadata);
          } else if (stage === 'error') {
            es.close();
            setIsProcessing(false);
          }
        } catch {
          // SSE parsing error
        }
      };

      es.onerror = () => {
        es.close();
        setIsProcessing(false);
        updateStatus({
          stage: 'error',
          progress: 0,
          message: 'Connection to processing server interrupted.',
        });
      };
    },
    [onTrackLoaded, updateStatus, preview, rangeStart, rangeEnd]
  );

  // Fetch preview information for interactive timeline range pickup
  const handleFetchPreview = async (targetUrl?: string) => {
    const cleanUrl = (targetUrl || url).trim();
    if (!cleanUrl) return;

    try {
      setIsLoadingPreview(true);
      updateStatus({
        stage: 'downloading',
        progress: 15,
        message: `Inspecting & retrieving audio for preview waveform...`,
      });

      const res = await fetch('/api/process/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
      });

      if (!res.ok) {
        throw new Error(`Failed to load audio preview: ${res.statusText}`);
      }

      const data: MediaPreviewData = await res.json();
      setPreview(data);
      setRangeStart(0);
      setRangeEnd(Math.max(10, Math.min(data.duration, 60)));
      setIsLoadingPreview(false);
      updateStatus({
        stage: 'ready',
        progress: 100,
        message: `Preview ready: ${data.title} (${formatTime(data.duration)})`,
      });
    } catch (err: unknown) {
      setIsLoadingPreview(false);
      const msg = err instanceof Error ? err.message : 'Failed to retrieve audio preview.';
      updateStatus({
        stage: 'error',
        progress: 0,
        message: msg,
      });
    }
  };

  // Submit media link separation with optional timeline range
  const handleStartSeparation = async (useRange: boolean = true) => {
    const cleanUrl = url.trim();
    if (!cleanUrl && !preview?.trackId) return;

    try {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        setIsPreviewPlaying(false);
      }

      setIsProcessing(true);
      const hasValidRange = useRange && rangeEnd > rangeStart && (rangeStart > 0 || (preview && rangeEnd < preview.duration));
      
      const payload: {
        url?: string;
        track_id?: string;
        start_time?: number;
        end_time?: number;
      } = {
        url: cleanUrl || undefined,
        track_id: preview?.trackId,
      };

      if (hasValidRange) {
        payload.start_time = Math.round(rangeStart * 10) / 10;
        payload.end_time = Math.round(rangeEnd * 10) / 10;
      }

      updateStatus({
        stage: 'queued',
        progress: 5,
        message: hasValidRange
          ? `Queuing segment separation (${formatTime(rangeStart)} - ${formatTime(rangeEnd)})...`
          : `Queuing full track separation...`,
      });

      const res = await fetch('/api/process/separate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.task_id) {
        listenToProgress(data.task_id);
      }
    } catch (err: unknown) {
      setIsProcessing(false);
      const msg = err instanceof Error ? err.message : 'Failed to start stem separation.';
      updateStatus({
        stage: 'error',
        progress: 0,
        message: msg,
      });
    }
  };

  // Submit local file upload with preview extraction
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    try {
      setIsLoadingPreview(true);
      updateStatus({
        stage: 'queued',
        progress: 10,
        message: `Uploading & inspecting ${file.name}...`,
      });

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/process/preview-upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload preview failed: ${res.statusText}`);
      }

      const data: MediaPreviewData = await res.json();
      setPreview(data);
      setUrl(file.name);
      setRangeStart(0);
      setRangeEnd(Math.max(10, Math.min(data.duration, 60)));
      setIsLoadingPreview(false);
      updateStatus({
        stage: 'ready',
        progress: 100,
        message: `Audio ready for trimming: ${data.title} (${formatTime(data.duration)})`,
      });
    } catch (err: unknown) {
      setIsLoadingPreview(false);
      const msg = err instanceof Error ? err.message : 'Failed to upload audio file.';
      updateStatus({
        stage: 'error',
        progress: 0,
        message: msg,
      });
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const currentPresets = PLATFORM_PRESETS[activePlatform] || [];

  return (
    <div className={`bg-deck-card border border-deck-border rounded-xl p-5 shadow-2xl flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-deck-border mb-4">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-white" />
          <span className="text-sm font-bold tracking-wider text-white uppercase font-mono">
            Demucs Neural Stem Ingestion
          </span>
        </div>
        <span className="text-[10px] text-zinc-400 font-mono">
          HTDemucs v4 Hybrid Transformer
        </span>
      </div>

      {/* Hidden audio element for preview playback */}
      {preview?.audioUrl && (
        <audio
          ref={previewAudioRef}
          src={preview.audioUrl}
          preload="auto"
        />
      )}

      {/* Platform Selector Tabs */}
      {!preview && (
        <div className="mb-4">
          <div className="text-[10px] font-mono text-zinc-400 mb-2 flex items-center justify-between">
            <span className="uppercase tracking-wider font-bold">Select Media Source Platform:</span>
            <span className="text-[9px] text-zinc-500 font-mono">YouTube • Spotify • Apple • SoundCloud • Disk</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PLATFORMS.map((platform) => {
              const isActive = activePlatform === platform.id;
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => {
                    setActivePlatform(platform.id);
                    if (platform.id === 'upload') {
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                    isActive
                      ? `${platform.activeBg} ${platform.activeBorder} ${platform.activeText} shadow-[0_0_12px_rgba(255,255,255,0.06)]`
                      : 'bg-deck-dark/60 border-deck-border text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-black/30' : 'bg-deck-dark'
                    }`}
                  >
                    {renderPlatformIcon(platform.id, `w-4 h-4 ${isActive ? platform.activeText : 'text-zinc-400'}`)}
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="text-xs font-bold font-sans truncate">{platform.name}</div>
                    <div className="text-[9px] font-mono opacity-70 truncate">{platform.badge}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ingestion Station: Either Preview & Timeline Range Picker OR Input Form */}
      {preview ? (
        /* INTERACTIVE TIMELINE RANGE PICKUP & PREVIEW STATION */
        <div className="space-y-4 bg-[#0d0f18] border border-cyan-500/30 rounded-xl p-4 shadow-2xl">
          {/* Preview Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center space-x-2 truncate">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/40">
                PREVIEW LOADED
              </span>
              <h4 className="text-xs font-mono font-bold text-white truncate max-w-sm">
                {preview.title}
              </h4>
            </div>
            <button
              onClick={() => {
                if (previewAudioRef.current) {
                  previewAudioRef.current.pause();
                }
                setIsPreviewPlaying(false);
                setPreview(null);
              }}
              className="flex items-center space-x-1 text-[10px] font-mono text-zinc-400 hover:text-white px-2 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] transition-all"
              title="Change Track / Select New URL"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Change</span>
            </button>
          </div>

          {/* Audio Waveform Scrubber & Range Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={togglePreviewPlay}
                  className="w-7 h-7 rounded-full bg-cyan-400 text-black flex items-center justify-center hover:bg-cyan-300 transition-all active:scale-95 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                  title={isPreviewPlaying ? 'Pause Preview' : 'Play Preview'}
                >
                  {isPreviewPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                </button>
                <span className="text-cyan-300 font-bold">{formatTime(previewCurrentTime)}</span>
                <span className="text-zinc-500">/</span>
                <span className="text-zinc-400">{formatTime(preview.duration)}</span>
              </div>

              <div className="flex items-center space-x-2 text-[10px] font-mono">
                <span className="text-zinc-400">SELECTED RANGE:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                  {formatTime(rangeStart)} → {formatTime(rangeEnd)} ({(rangeEnd - rangeStart).toFixed(1)}s)
                </span>
              </div>
            </div>

            {/* Interactive Timeline Range Waveform Display */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                const seekTime = ratio * preview.duration;
                seekPreview(seekTime);
              }}
              className="relative h-12 bg-black/60 rounded-lg border border-white/[0.1] overflow-hidden cursor-pointer group"
              title="Click anywhere to seek preview audio"
            >
              {/* Dummy stylized waveform bars */}
              <div className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none opacity-30">
                {Array.from({ length: 60 }).map((_, i) => {
                  const h = 20 + Math.sin(i * 0.4) * 15 + Math.cos(i * 0.8) * 12;
                  return (
                    <div
                      key={i}
                      className="w-1 bg-zinc-300 rounded-full"
                      style={{ height: `${h}px` }}
                    />
                  );
                })}
              </div>

              {/* Highlighted Sliced Segment Box */}
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/25 border-l-2 border-r-2 border-emerald-400 pointer-events-none shadow-[0_0_15px_rgba(52,211,153,0.3)] flex items-center justify-between px-1"
                style={{
                  left: `${(rangeStart / preview.duration) * 100}%`,
                  width: `${((rangeEnd - rangeStart) / preview.duration) * 100}%`,
                }}
              >
                <span className="text-[8px] font-mono font-bold text-emerald-300 bg-black/70 px-1 rounded">
                  {formatTime(rangeStart)}
                </span>
                <span className="text-[8px] font-mono font-bold text-emerald-300 bg-black/70 px-1 rounded">
                  {formatTime(rangeEnd)}
                </span>
              </div>

              {/* Real-time Playhead Indicator */}
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-cyan-300 pointer-events-none z-20 shadow-[0_0_8px_#00f2ff]"
                style={{ left: `${(previewCurrentTime / preview.duration) * 100}%` }}
              >
                <div className="w-2.5 h-2.5 bg-cyan-300 rotate-45 -translate-x-[4px] -translate-y-1" />
              </div>
            </div>
          </div>

          {/* Draggable Range Handles & Quick Range Presets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Start Time Knob / Slider */}
            <div className="bg-[#141624] border border-white/[0.06] rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-zinc-400 font-bold uppercase">Start Time:</span>
                <button
                  type="button"
                  onClick={() => setRangeStart(Math.min(previewCurrentTime, rangeEnd - 1))}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 font-bold transition-all"
                  title="Snap start time to current playhead"
                >
                  ◀ Snap to Playhead
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, rangeEnd - 1)}
                  step={0.5}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-emerald-400"
                />
                <span className="text-xs font-mono font-bold text-emerald-400 w-12 text-right">
                  {formatTime(rangeStart)}
                </span>
              </div>
            </div>

            {/* End Time Knob / Slider */}
            <div className="bg-[#141624] border border-white/[0.06] rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-zinc-400 font-bold uppercase">End Time:</span>
                <button
                  type="button"
                  onClick={() => setRangeEnd(Math.max(rangeStart + 1, previewCurrentTime))}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 font-bold transition-all"
                  title="Snap end time to current playhead"
                >
                  Snap to Playhead ▶
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min={Math.min(preview.duration, rangeStart + 1)}
                  max={preview.duration}
                  step={0.5}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-emerald-400"
                />
                <span className="text-xs font-mono font-bold text-emerald-400 w-12 text-right">
                  {formatTime(rangeEnd)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Segment Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[9px] font-mono text-zinc-400 uppercase font-bold mr-1">
              Quick Slices:
            </span>
            <button
              type="button"
              onClick={() => {
                setRangeStart(0);
                setRangeEnd(preview.duration);
              }}
              className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[9px] font-mono text-zinc-300 hover:text-white"
            >
              Full Song (100%)
            </button>
            <button
              type="button"
              onClick={() => {
                setRangeStart(0);
                setRangeEnd(Math.min(preview.duration, 30));
              }}
              className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[9px] font-mono text-zinc-300 hover:text-white"
            >
              First 30s (Intro)
            </button>
            <button
              type="button"
              onClick={() => {
                const s = Math.min(preview.duration * 0.3, preview.duration - 10);
                setRangeStart(s);
                setRangeEnd(Math.min(preview.duration, s + 60));
              }}
              className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[9px] font-mono text-zinc-300 hover:text-white"
            >
              Mid 60s (Chorus / Drop)
            </button>
            <button
              type="button"
              onClick={() => {
                setRangeStart(Math.max(0, preview.duration - 30));
                setRangeEnd(preview.duration);
              }}
              className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[9px] font-mono text-zinc-300 hover:text-white"
            >
              Last 30s (Outro)
            </button>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={() => handleStartSeparation(true)}
              disabled={isProcessing}
              className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-400 text-black font-extrabold text-xs rounded-lg shadow-lg hover:brightness-110 transition-all flex items-center justify-center space-x-2 font-mono disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  <span>Demixing Selected Slice...</span>
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4 text-black" />
                  <span>
                    Separate Selected Range ({formatTime(rangeStart)} - {formatTime(rangeEnd)})
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleStartSeparation(false)}
              disabled={isProcessing}
              className="px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/[0.15] font-extrabold text-xs rounded-lg transition-all flex items-center justify-center space-x-1.5 font-mono disabled:opacity-50"
            >
              <span>Separate Full Song</span>
            </button>
          </div>
        </div>
      ) : (
        /* STANDARD INGESTION FORM & DROPZONE */
        <div className="space-y-3 flex-1 flex flex-col justify-between">
          {/* Media URL Input Form */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                {renderPlatformIcon(activePlatform, `w-4 h-4 ${currentPlatformConfig.activeText}`)}
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isProcessing || isLoadingPreview}
                placeholder={currentPlatformConfig.placeholder}
                className="w-full pl-9 pr-8 py-2.5 bg-deck-dark border border-deck-border rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-white transition-colors disabled:opacity-50 font-mono"
              />
              {url && !isProcessing && !isLoadingPreview && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white"
                  title="Clear input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {/* Preview & Pick Timeline Range Button */}
              <button
                type="button"
                onClick={() => handleFetchPreview()}
                disabled={isProcessing || isLoadingPreview || !url.trim()}
                className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center space-x-1.5 font-mono shrink-0"
                title="Preview track and pick timeline range to separate"
              >
                {isLoadingPreview ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>Loading Audio...</span>
                  </>
                ) : (
                  <>
                    <Scissors className="w-3.5 h-3.5 text-black" />
                    <span>Pick Timeline Range</span>
                  </>
                )}
              </button>

              {/* Direct Full Demix Button */}
              <button
                type="button"
                onClick={() => handleStartSeparation(false)}
                disabled={isProcessing || isLoadingPreview || !url.trim()}
                className="px-3.5 py-2 bg-white text-black font-extrabold text-xs rounded-lg shadow-mono-glow hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center space-x-1.5 font-mono shrink-0"
                title="Demix entire song immediately"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-black" />
                    <span>Demix Full</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Local Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              isDragging || activePlatform === 'upload'
                ? 'border-primary/80 bg-primary/5 shadow-mono-glow'
                : 'border-deck-border hover:border-zinc-500 bg-deck-dark/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
            <div className="flex flex-col items-center justify-center space-y-1">
              <Upload className="w-5 h-5 text-white" />
              <span className="text-xs font-semibold text-zinc-200">
                Drag &amp; drop audio file, or <span className="text-white underline">browse</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                MP3, WAV, FLAC, AAC, MP4 up to 100MB • Interactive timeline trimmer included
              </span>
            </div>
          </div>

          {/* Quick Sample Presets */}
          <div className="pt-2">
            <div className="text-[10px] font-mono text-zinc-400 mb-1.5 flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <Music className="w-3 h-3 text-zinc-300" />
                <span>QUICK SAMPLE PRESETS:</span>
              </div>
              <span className={`text-[9px] font-bold uppercase ${currentPlatformConfig.activeText}`}>
                {currentPlatformConfig.name} Presets
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(currentPresets.length > 0 ? currentPresets : PLATFORM_PRESETS.youtube).map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  disabled={isProcessing || isLoadingPreview}
                  onClick={() => {
                    setUrl(preset.url);
                  }}
                  className="px-2.5 py-1 rounded bg-deck-dark hover:bg-zinc-800 border border-deck-border text-[10px] font-mono text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

        {/* SSE Live Progress Bar */}
        {isProcessing && (
          <div className="mt-3 bg-deck-dark/90 border border-deck-border rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-3.5 h-3.5 text-white animate-spin" />
                <span className="text-white font-bold uppercase">{status.stage}</span>
              </div>
              <span className="text-white font-bold">{Math.round(status.progress)}%</span>
            </div>

            <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-deck-border">
              <div
                className="h-full bg-gradient-to-r from-zinc-500 via-zinc-200 to-white transition-all duration-300 shadow-mono-glow"
                style={{ width: `${Math.max(3, status.progress)}%` }}
              />
            </div>

            <p className="text-[10px] text-zinc-400 font-mono truncate">{status.message}</p>
          </div>
        )}

        {/* Error Alert */}
        {status.stage === 'error' && !isProcessing && (
          <div className="mt-2 bg-zinc-900 border border-white/40 rounded-lg p-2.5 flex items-center space-x-2 text-xs text-zinc-200 font-mono">
            <AlertCircle className="w-4 h-4 text-white shrink-0" />
            <span className="truncate">{status.message}</span>
          </div>
        )}
      </div>
    );
  };

export default UrlUploader;

