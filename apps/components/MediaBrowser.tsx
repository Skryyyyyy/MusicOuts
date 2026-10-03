import React, { useRef } from 'react';
import { Project, SourceAsset, SongSection } from '../../core/project-model/types';
import { generatePeakPyramid } from '../../core/analysis/waveform';
import {
  Music,
  FolderOpen,
  Sparkles,
  Layers,
  Clock,
  Plus,
  Radio,
  FileAudio,
} from 'lucide-react';

interface MediaBrowserProps {
  project: Project;
  onAddSource: (asset: SourceAsset, buffer: AudioBuffer) => void;
  onInsertClip: (sourceId: string, trackId: string, startTime: number, section?: SongSection) => void;
  onRunStemSplitter: (assetId: string) => void;
}

export const MediaBrowser: React.FC<MediaBrowserProps> = ({
  project,
  onAddSource,
  onInsertClip,
  onRunStemSplitter,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const arrayBuffer = await file.arrayBuffer();

    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    const tempCtx = new AudioCtxClass();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);

    const pyramids = generatePeakPyramid(audioBuffer);

    const newAsset: SourceAsset = {
      id: `asset-${Date.now()}`,
      name: file.name,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      fileSize: file.size,
      bpm: 120, // Default estimated BPM
      key: 'C Major',
      peakPyramids: pyramids.levels,
      audioBuffer,
    };

    onAddSource(newAsset, audioBuffer);
  };

  return (
    <aside className="w-72 bg-pro-panel border-r border-pro-border flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-pro-border flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Music className="w-4 h-4 text-pro-accent" />
          <span className="font-semibold text-xs tracking-wider uppercase text-slate-300">
            Media Pool & Assets
          </span>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 hover:bg-pro-surface rounded-md text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs bg-pro-surface/50 border border-pro-border"
          title="Import Local Audio File"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Import</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* Sections Quick Selector */}
      <div className="p-3 border-b border-pro-border/70 bg-pro-bg/40">
        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Auto-Detected Sections</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {project.sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => {
                const targetTrack = project.tracks[0]?.id;
                const targetSource = Object.keys(project.sources)[0];
                if (targetTrack && targetSource) {
                  onInsertClip(targetSource, targetTrack, sec.startTime, sec);
                }
              }}
              className="px-2 py-1.5 text-left rounded bg-pro-surface/80 hover:bg-pro-surface border border-white/5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200 group-hover:text-pro-accent">
                  {sec.name}
                </span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: sec.color }}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {sec.startTime}s - {sec.endTime}s
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Source Assets List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <FolderOpen className="w-3 h-3 text-blue-400" />
          <span>Project Sources ({Object.keys(project.sources).length})</span>
        </div>

        {Object.values(project.sources).map((asset) => (
          <div
            key={asset.id}
            className="p-2.5 rounded-lg bg-pro-surface/60 border border-pro-border hover:border-pro-accent/40 transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileAudio className="w-4 h-4 text-pro-accent shrink-0" />
                <div className="overflow-hidden">
                  <p className="text-xs font-medium text-slate-200 truncate group-hover:text-white">
                    {asset.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {asset.duration.toFixed(1)}s
                    </span>
                    <span>{asset.key || 'Auto'}</span>
                    <span>{asset.bpm ? `${asset.bpm} BPM` : ''}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between gap-1">
              <button
                onClick={() => {
                  const targetTrack = project.tracks[0]?.id;
                  if (targetTrack) {
                    onInsertClip(asset.id, targetTrack, 0);
                  }
                }}
                className="px-2 py-1 text-[11px] bg-pro-accent/20 hover:bg-pro-accent/30 text-pro-accent rounded transition-colors font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add to Timeline</span>
              </button>

              <button
                onClick={() => onRunStemSplitter(asset.id)}
                className="px-2 py-1 text-[11px] bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded transition-colors font-medium flex items-center gap-1"
                title="Split into Stems (Vocals, Drums, Bass, Other)"
              >
                <Layers className="w-3 h-3" />
                <span>Stem Lab</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Non-destructive EDL Badge */}
      <div className="p-3 bg-pro-surface/40 border-t border-pro-border text-[11px] text-slate-400 flex items-center gap-2">
        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        <span>Non-Destructive EDL Mode Active</span>
      </div>
    </aside>
  );
};
