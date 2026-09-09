import React from "react";
import { Cpu, Download, Sparkles, Music, Disc, Radio, Mic, FileAudio } from "lucide-react";
import { UrlUploader } from "../UrlUploader";
import { ProcessStatus, TrackMetadata, StemType, STEM_TYPES } from "../../types";

export interface DemixLabViewProps {
  trackMetadata: TrackMetadata | null;
  processStatus: ProcessStatus;
  onTrackLoaded: (track: TrackMetadata) => void;
  onStatusChange?: (status: ProcessStatus) => void;
  className?: string;
}

const STEM_ICONS: Record<StemType, React.ReactNode> = {
  vocals: <Mic className="w-3.5 h-3.5 text-cyan-400" />,
  drums: <Disc className="w-3.5 h-3.5 text-orange-400" />,
  bass: <Music className="w-3.5 h-3.5 text-purple-400" />,
  other: <Radio className="w-3.5 h-3.5 text-emerald-400" />,
};

export const DemixLabView: React.FC<DemixLabViewProps> = ({
  trackMetadata,
  processStatus,
  onTrackLoaded,
  onStatusChange,
  className = "",
}) => {
  return (
    <div className={`flex flex-col h-full bg-[#121316] border border-[#262830] rounded-lg shadow-2xl overflow-hidden ${className}`}>
      {/* Top Header Toolbar */}
      <div className="h-10 px-4 bg-[#18191e] border-b border-[#262830] flex items-center justify-between select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-xs tracking-wider text-zinc-100 font-mono uppercase">
              Neural AI Demixer &amp; Media Ingestion Lab
            </span>
          </div>
          <span className="text-zinc-700">|</span>
          <span className="text-[11px] font-mono text-zinc-400">
            Demucs v4 Hybrid Transformer (htdemucs) • NVIDIA RTX 2050 CUDA Acceleration
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-[10px] text-zinc-400">Status: <span className="text-cyan-300 font-bold">{processStatus.stage.toUpperCase()}</span></span>
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
            CUDA FP16 Active
          </span>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-y-auto bg-[#0d0e11]">
        {/* Left/Main Column: Ingestion Engine (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-[#15161b] border border-[#262830] rounded-lg p-4 shadow-lg flex-1 flex flex-col">
            <UrlUploader
              onTrackLoaded={onTrackLoaded}
              onStatusChange={onStatusChange}
              className="w-full h-full flex-1"
            />
          </div>
        </div>

        {/* Right Column: Loaded Stems & Export Center (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* Active Track Card */}
          <div className="bg-[#15161b] border border-[#262830] rounded-lg p-3 shadow-lg flex flex-col gap-3 select-none">
            <div className="flex items-center space-x-2 border-b border-[#252730] pb-2">
              <FileAudio className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-mono font-bold text-zinc-200 uppercase">
                Active Track Inspector
              </span>
            </div>

            {trackMetadata ? (
              <div className="flex flex-col gap-2.5">
                <div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">Track Title</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono truncate">{trackMetadata.title}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="bg-[#101114] p-1.5 rounded border border-[#22242b]">
                    <span className="text-zinc-500">Duration:</span>{" "}
                    <span className="text-zinc-200 font-bold">{Math.floor(trackMetadata.duration / 60)}m {Math.floor(trackMetadata.duration % 60)}s</span>
                  </div>
                  <div className="bg-[#101114] p-1.5 rounded border border-[#22242b]">
                    <span className="text-zinc-500">Video Sync:</span>{" "}
                    <span className={`font-bold ${trackMetadata.hasVideo ? "text-emerald-400" : "text-zinc-400"}`}>
                      {trackMetadata.hasVideo ? "AVAILABLE" : "AUDIO ONLY"}
                    </span>
                  </div>
                </div>

                {/* Stems Download Matrix */}
                <div className="pt-2 border-t border-[#252730] flex flex-col gap-1.5">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">
                    Export Separated WAV Stems:
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {STEM_TYPES.map((stem) => {
                      const stemUrl = trackMetadata.stems[stem];
                      return (
                        <a
                          key={stem}
                          href={stemUrl}
                          download={`${trackMetadata.title}_${stem}.wav`}
                          className="px-2 py-1.5 rounded bg-[#1c1d22] border border-[#2d303a] hover:border-cyan-500/50 hover:bg-[#252830] transition-all flex items-center justify-between text-[10px] font-mono text-zinc-300 group"
                        >
                          <div className="flex items-center space-x-1.5">
                            {STEM_ICONS[stem]}
                            <span className="capitalize">{stem}</span>
                          </div>
                          <Download className="w-3 h-3 text-zinc-500 group-hover:text-cyan-400" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center gap-2 text-zinc-500">
                <Music className="w-8 h-8 opacity-30" />
                <span className="text-xs font-mono">No Track Loaded Yet</span>
                <span className="text-[10px] text-zinc-600 max-w-[200px]">
                  Paste a YouTube URL or drag an audio file to separate into 4 stems.
                </span>
              </div>
            )}
          </div>

          {/* AI Architecture Info */}
          <div className="bg-[#15161b] border border-[#262830] rounded-lg p-3 shadow-lg flex flex-col gap-2 select-none text-[10px] font-mono text-zinc-400">
            <div className="flex items-center space-x-2 border-b border-[#252730] pb-2 text-zinc-200 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Demucs v4 Hybrid Architecture</span>
            </div>
            <p className="leading-relaxed">
              MusicOuts uses a dual Time-Frequency Convolutional + Transformer network to isolate 4 discrete stereo stems:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-zinc-300">
              <li><strong className="text-cyan-400">Vocals:</strong> Lead/backing vocals &amp; speech</li>
              <li><strong className="text-orange-400">Drums:</strong> Kick, snare, hi-hats, percussions</li>
              <li><strong className="text-purple-400">Bass:</strong> Sub-bass, 808s, bass guitar</li>
              <li><strong className="text-emerald-400">Other:</strong> Synths, guitars, keys, effects</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
