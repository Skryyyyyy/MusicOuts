import React, { useState, useRef, useCallback } from 'react';
import { Youtube, Upload, Sparkles, AlertCircle, RefreshCw, Music } from 'lucide-react';
import { ProcessStatus, ProcessStage, TrackMetadata, StemType } from '../types';

export interface UrlUploaderProps {
  onTrackLoaded: (track: TrackMetadata) => void;
  onStatusChange?: (status: ProcessStatus) => void;
  className?: string;
}

const SAMPLE_PRESETS = [
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
];

export const UrlUploader: React.FC<UrlUploaderProps> = ({
  onTrackLoaded,
  onStatusChange,
  className = '',
}) => {
  const [url, setUrl] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [status, setStatus] = useState<ProcessStatus>({
    stage: 'ready',
    progress: 0,
    message: 'Ready for track ingestion',
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const updateStatus = useCallback(
    (newStatus: ProcessStatus) => {
      setStatus(newStatus);
      if (onStatusChange) {
        onStatusChange(newStatus);
      }
    },
    [onStatusChange]
  );

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
              title: data.result?.title || 'Processed Stem Track',
              duration: data.result?.duration || 180,
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
    [onTrackLoaded, updateStatus]
  );

  // Submit YouTube URL
  const handleYoutubeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    try {
      setIsProcessing(true);
      updateStatus({
        stage: 'queued',
        progress: 5,
        message: 'Submitting YouTube download task...',
      });

      const res = await fetch('/api/process/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
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
      const msg = err instanceof Error ? err.message : 'Failed to start YouTube processing.';
      updateStatus({
        stage: 'error',
        progress: 0,
        message: msg,
      });
    }
  };

  // Submit local file upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    try {
      setIsProcessing(true);
      updateStatus({
        stage: 'queued',
        progress: 5,
        message: `Uploading ${file.name}...`,
      });

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/process/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.task_id) {
        listenToProgress(data.task_id);
      }
    } catch (err: unknown) {
      setIsProcessing(false);
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

      {/* Ingestion Form & Dropzone */}
      <div className="space-y-3 flex-1 flex flex-col justify-between">
        {/* YouTube Input */}
        <form onSubmit={handleYoutubeSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Youtube className="w-4 h-4 text-zinc-300" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isProcessing}
              placeholder="Paste YouTube music or video URL..."
              className="w-full pl-9 pr-4 py-2.5 bg-deck-dark border border-deck-border rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-white transition-colors disabled:opacity-50 font-mono"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isProcessing || !url.trim()}
              className="px-4 py-2 bg-white text-black font-extrabold text-xs rounded-lg shadow-mono-glow hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center space-x-1.5 font-mono"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                  <span>Demix Stems</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Local Drag & Drop Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-white bg-white/10 shadow-mono-glow'
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
              MP3, WAV, FLAC, AAC, MP4 up to 100MB
            </span>
          </div>
        </div>

        {/* Quick Sample Presets */}
        <div className="pt-2">
          <div className="text-[10px] font-mono text-zinc-400 mb-1.5 flex items-center space-x-1">
            <Music className="w-3 h-3 text-zinc-300" />
            <span>QUICK SAMPLE PRESETS:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                disabled={isProcessing}
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
    </div>
  );
};

export default UrlUploader;
