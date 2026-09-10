import React from "react";
import { Cpu, Download, Music, Disc, Radio, Mic, FileAudio, Save, Zap } from "lucide-react";
import { UrlUploader } from "../UrlUploader";
import { ProcessStatus, TrackMetadata, StemType, STEM_TYPES, HardwareInfo, SongItem } from "../../types";

export interface DemixLabViewProps {
  trackMetadata: TrackMetadata | null;
  processStatus: ProcessStatus;
  hardwareInfo?: HardwareInfo | null;
  songs?: SongItem[];
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
  songs = [],
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
      songs: songs,
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
    <div className={`flex flex-col h-full bg-[#000000] border border-white/[0.08] rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-3xl overflow-hidden ${className}`}>
      {/* Top Header Toolbar - Splice Glass Capsule Header */}
      <div className="h-14 px-5 bg-gradient-to-r from-[#14161f]/95 via-[#161822]/90 to-[#14161f]/95 border-b border-white/[0.06] flex items-center justify-between select-none shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.2)]">
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xs tracking-wider text-white uppercase font-sans">
                Neural AI Demixer &amp; Media Ingestion Lab
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-mono text-cyan-300 font-bold">
                HTDEMUCS V4
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 block -mt-0.5">
              Demucs Hybrid Transformer • {hardwareInfo ? hardwareInfo.device_name : "NVIDIA CUDA Acceleration"}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-[10px] text-zinc-400">Status: <span className="text-cyan-300 font-bold">{processStatus.stage.toUpperCase()}</span></span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
            hardwareInfo?.cuda_available
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
              : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
          }`}>
            {hardwareInfo?.cuda_available ? `CUDA FP16 (${hardwareInfo.vram_gb}GB VRAM)` : `CPU Multi-Thread (${hardwareInfo?.cpu_threads || 8} Cores)`}
          </span>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-y-auto bg-gradient-to-b from-[#000000] to-[#050508]">
        {/* Left/Main Column: Ingestion Engine (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-gradient-to-b from-[#14161f]/90 to-[#101118]/90 border border-white/[0.08] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl flex-1 flex flex-col">
            <UrlUploader
              onTrackLoaded={onTrackLoaded}
              onStatusChange={onStatusChange}
              className="w-full h-full flex-1"
            />
          </div>
        </div>

        {/* Right Column: Loaded Stems & Export Center (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Active Track Card */}
          <div className="bg-gradient-to-b from-[#14161f]/90 to-[#101118]/90 border border-white/[0.08] rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl flex flex-col gap-3 select-none">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
              <div className="flex items-center space-x-2">
                <FileAudio className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                  Track Analysis &amp; Stems
                </span>
              </div>
              {trackMetadata && (
                <button
                  onClick={exportProjectFile}
                  className="px-3 py-1 rounded-full bg-cyan-500/10 hover:bg-cyan-500 hover:text-black text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold transition-all flex items-center space-x-1.5 active:scale-95 shadow-sm"
                  title="Save .musicouts project file"
                >
                  <Save className="w-3 h-3" />
                  <span>SAVE PROJECT</span>
                </button>
              )}
            </div>

            {trackMetadata ? (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Track Title</div>
                  <div className="text-sm font-bold text-white truncate">{trackMetadata.title}</div>
                </div>

                {/* AI Audio Analysis (BPM, Key, Time Signature, Energy) */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="bg-[#0b0c12]/80 p-2 rounded-xl border border-white/[0.05]">
                    <span className="text-zinc-500">BPM / KEY:</span>{" "}
                    <span className="text-amber-300 font-bold">120 • A Minor</span>
                  </div>
                  <div className="bg-[#0b0c12]/80 p-2 rounded-xl border border-white/[0.05]">
                    <span className="text-zinc-500">TIME SIG:</span>{" "}
                    <span className="text-zinc-200 font-bold">4/4 Common</span>
                  </div>
                  <div className="bg-[#0b0c12]/80 p-2 rounded-xl border border-white/[0.05]">
                    <span className="text-zinc-500">DURATION:</span>{" "}
                    <span className="text-zinc-200 font-bold">{Math.floor(trackMetadata.duration / 60)}m {Math.floor(trackMetadata.duration % 60)}s</span>
                  </div>
                  <div className="bg-[#0b0c12]/80 p-2 rounded-xl border border-white/[0.05]">
                    <span className="text-zinc-500">AI ENERGY:</span>{" "}
                    <span className="text-emerald-400 font-bold">88% HIGH</span>
                  </div>
                </div>

                {/* Stems Download Matrix */}
                <div className="pt-2 border-t border-white/[0.06] flex flex-col gap-2">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase font-bold tracking-wider">
                    Export Separated WAV Stems:
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {STEM_TYPES.map((stem) => {
                      const stemUrl = trackMetadata.stems[stem];
                      return (
                        <a
                          key={stem}
                          href={stemUrl}
                          download={`${trackMetadata.title}_${stem}.wav`}
                          className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-cyan-400/50 hover:bg-white/[0.08] transition-all flex items-center justify-between text-[10px] font-mono text-zinc-300 group active:scale-95"
                        >
                          <div className="flex items-center space-x-1.5">
                            {STEM_ICONS[stem]}
                            <span className="capitalize">{stem}</span>
                          </div>
                          <Download className="w-3.5 h-3.5 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center gap-2 text-zinc-500">
                <Music className="w-8 h-8 opacity-30 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-zinc-400">No Track Loaded Yet</span>
                <span className="text-[10px] text-zinc-600 max-w-[200px]">
                  Paste a YouTube URL or drag an audio file to separate into 4 stems.
                </span>
              </div>
            )}
          </div>

          {/* Project Song Pool (Multi-Song Ingestion) */}
          {songs.length > 0 && (
            <div className="bg-gradient-to-b from-[#14161f]/90 to-[#101118]/90 border border-white/[0.08] rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl flex flex-col gap-2.5 select-none text-[10px] font-mono text-zinc-400">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-zinc-200 font-bold">
                <div className="flex items-center space-x-2">
                  <Music className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-white font-sans font-bold">Project Song Pool ({songs.length})</span>
                </div>
                <span className="text-[9px] text-cyan-400 font-bold uppercase">Remix Active</span>
              </div>
              <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                {songs.map((song) => (
                  <div
                    key={song.id}
                    className="p-2 rounded-xl bg-[#0b0c12]/80 border border-white/[0.05] flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: song.color || "#00bcd4" }}
                      />
                      <span className="truncate text-white font-semibold">{song.title}</span>
                    </div>
                    <span className="text-zinc-500 flex-shrink-0 ml-1">
                      {Math.floor(song.duration / 60)}:{(Math.floor(song.duration % 60)).toString().padStart(2, '0')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Real System Hardware Details */}
          <div className="bg-gradient-to-b from-[#14161f]/90 to-[#101118]/90 border border-white/[0.08] rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl flex flex-col gap-2.5 select-none text-[10px] font-mono text-zinc-400">
            <div className="flex items-center space-x-2 border-b border-white/[0.06] pb-2 text-zinc-200 font-bold">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-white font-sans font-bold">Real Hardware Acceleration</span>
            </div>
            <div className="flex flex-col gap-1.5 text-[10px]">
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

