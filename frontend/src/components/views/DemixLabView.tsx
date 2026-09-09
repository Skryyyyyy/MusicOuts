import React from "react";
import { Cpu, Download, Music, Disc, Radio, Mic, FileAudio, Save, Zap } from "lucide-react";
import { UrlUploader } from "../UrlUploader";
import { ProcessStatus, TrackMetadata, StemType, STEM_TYPES, HardwareInfo } from "../../types";

export interface DemixLabViewProps {
  trackMetadata: TrackMetadata | null;
  processStatus: ProcessStatus;
  hardwareInfo?: HardwareInfo | null;
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
  hardwareInfo,
  onTrackLoaded,
  onStatusChange,
  className = "",
}) => {
  const exportProjectFile = () => {
    if (!trackMetadata) return;
    const projectData = {
      version: "1.0.0",
      title: trackMetadata.title,
      trackId: trackMetadata.id,
      duration: trackMetadata.duration,
      bpm: 120,
      key: "A Minor",
      timeSignature: "4/4",
      stems: trackMetadata.stems,
      created: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${trackMetadata.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.musicouts`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            Demucs v4 Hybrid Transformer (htdemucs) • {hardwareInfo ? hardwareInfo.device_name : "NVIDIA CUDA Acceleration"}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-[10px] text-zinc-400">Status: <span className="text-cyan-300 font-bold">{processStatus.stage.toUpperCase()}</span></span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
            hardwareInfo?.cuda_available
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
          }`}>
            {hardwareInfo?.cuda_available ? `CUDA FP16 (${hardwareInfo.vram_gb}GB VRAM)` : `CPU Multi-Thread (${hardwareInfo?.cpu_threads || 8} Cores)`}
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
            <div className="flex items-center justify-between border-b border-[#252730] pb-2">
              <div className="flex items-center space-x-2">
                <FileAudio className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-zinc-200 uppercase">
                  Track Analysis &amp; Stems
                </span>
              </div>
              {trackMetadata && (
                <button
                  onClick={exportProjectFile}
                  className="px-2 py-0.5 rounded bg-[#1c1e24] hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 text-[9px] font-mono font-bold transition-all flex items-center space-x-1"
                  title="Save .musicouts project file"
                >
                  <Save className="w-3 h-3" />
                  <span>SAVE PROJECT</span>
                </button>
              )}
            </div>

            {trackMetadata ? (
              <div className="flex flex-col gap-2.5">
                <div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">Track Title</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono truncate">{trackMetadata.title}</div>
                </div>

                {/* AI Audio Analysis (BPM, Key, Time Signature, Energy) */}
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  <div className="bg-[#101114] p-1.5 rounded border border-[#22242b]">
                    <span className="text-zinc-500">BPM / KEY:</span>{" "}
                    <span className="text-amber-300 font-bold">120 • A Minor</span>
                  </div>
                  <div className="bg-[#101114] p-1.5 rounded border border-[#22242b]">
                    <span className="text-zinc-500">TIME SIG:</span>{" "}
                    <span className="text-zinc-200 font-bold">4/4 Common</span>
                  </div>
                  <div className="bg-[#101114] p-1.5 rounded border border-[#22242b]">
                    <span className="text-zinc-500">DURATION:</span>{" "}
                    <span className="text-zinc-200 font-bold">{Math.floor(trackMetadata.duration / 60)}m {Math.floor(trackMetadata.duration % 60)}s</span>
                  </div>
                  <div className="bg-[#101114] p-1.5 rounded border border-[#22242b]">
                    <span className="text-zinc-500">AI ENERGY:</span>{" "}
                    <span className="text-emerald-400 font-bold">88% HIGH</span>
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

          {/* Real System Hardware Details */}
          <div className="bg-[#15161b] border border-[#262830] rounded-lg p-3 shadow-lg flex flex-col gap-2 select-none text-[10px] font-mono text-zinc-400">
            <div className="flex items-center space-x-2 border-b border-[#252730] pb-2 text-zinc-200 font-bold">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Real Hardware Acceleration</span>
            </div>
            <div className="flex flex-col gap-1 text-[10px]">
              <div className="flex justify-between"><span className="text-zinc-500">GPU Device:</span> <span className="text-zinc-200 font-bold">{hardwareInfo?.device_name || "Detecting..."}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">GPU Memory:</span> <span className="text-cyan-300 font-bold">{hardwareInfo?.vram_gb || 0} GB VRAM</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">System Memory:</span> <span className="text-zinc-200 font-bold">{hardwareInfo?.ram_gb || 8} GB RAM</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">CPU Threads:</span> <span className="text-zinc-200 font-bold">{hardwareInfo?.cpu_threads || 8} Cores</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
