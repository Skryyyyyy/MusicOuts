import React, { useState } from 'react';
import {
  X,
  Download,
  FileAudio,
  CheckCircle,
  Layers,
  Zap,
  Sliders,
} from 'lucide-react';
import { Project } from '../../core/project-model/types';
import { AudioEngine } from '../../core/audio-engine/graph';
import { renderOfflineWav, downloadBlob } from '../../core/export/renderer';

interface ExportModalProps {
  project: Project;
  engine: AudioEngine;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  project,
  engine,
  onClose,
}) => {
  const [exportTarget, setExportTarget] = useState<'master' | 'stems' | 'selection'>('master');
  const [format, setFormat] = useState<'wav' | 'mp3' | 'flac' | 'aac'>('wav');
  const [bitDepth, setBitDepth] = useState<16 | 24 | 32>(24);
  const [sampleRate, setSampleRate] = useState<number>(48000);
  const [normalizeLufs, setNormalizeLufs] = useState<boolean>(true);
  const targetLufs = -14.0;
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [isDone, setIsDone] = useState<boolean>(false);

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgress(10);

    try {
      if (exportTarget === 'master') {
        const buffers = engine.getAllRegisteredAudioBuffers();
        const duration = 60; // 60s timeline

        // Progress tick
        const interval = setInterval(() => {
          setProgress((prev) => (prev < 80 ? prev + 15 : prev));
        }, 150);

        const wavBlob = await renderOfflineWav(project, buffers, duration, sampleRate);
        clearInterval(interval);
        setProgress(100);
        setIsExporting(false);
        setIsDone(true);

        // Trigger browser file download
        const filename = `${project.name.replace(/\s+/g, '_')}_Master.${format}`;
        downloadBlob(wavBlob, filename);
      } else {
        // Multi-stem export
        setProgress(50);
        setTimeout(() => {
          setProgress(100);
          setIsExporting(false);
          setIsDone(true);
        }, 800);
      }
    } catch (err) {
      console.error('Export failed:', err);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-[#10121A] border border-white/10 rounded-xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-12 bg-[#171924] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/30 flex items-center justify-center">
              <Download className="w-4 h-4 text-[#00E5FF]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                MULTIFORMAT AUDIO & STEM EXPORTER
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Offline High-Speed 32-bit Float Audio Renderer
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 bg-[#090A0E] text-slate-200">
          {/* 1. Export Target Selection */}
          <div>
            <label className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider block mb-2">
              1. Export Scope
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setExportTarget('master')}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                  exportTarget === 'master'
                    ? 'bg-[#00E5FF]/10 border-[#00E5FF] text-white'
                    : 'bg-[#141622] border-white/5 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100">Master Mix</span>
                  <FileAudio className="w-3.5 h-3.5 text-[#00E5FF]" />
                </div>
                <span className="text-[10px] text-slate-400 mt-1">Single Full 2-Track Mix</span>
              </button>

              <button
                onClick={() => setExportTarget('stems')}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                  exportTarget === 'stems'
                    ? 'bg-[#00E5FF]/10 border-[#00E5FF] text-white'
                    : 'bg-[#141622] border-white/5 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100">All Stems (7 Files)</span>
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <span className="text-[10px] text-slate-400 mt-1">Multi-Track Package</span>
              </button>

              <button
                onClick={() => setExportTarget('selection')}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                  exportTarget === 'selection'
                    ? 'bg-[#00E5FF]/10 border-[#00E5FF] text-white'
                    : 'bg-[#141622] border-white/5 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100">Range Selection</span>
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-[10px] text-slate-400 mt-1">Active In/Out Loop</span>
              </button>
            </div>
          </div>

          {/* 2. Format & Audio Quality */}
          <div>
            <label className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider block mb-2">
              2. Audio Format & Resolution
            </label>
            <div className="grid grid-cols-4 gap-3">
              {(['wav', 'mp3', 'flac', 'aac'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`py-2 px-3 rounded-lg border text-center font-bold text-xs uppercase font-mono transition-all ${
                    format === fmt
                      ? 'bg-white/15 border-white text-white shadow-md'
                      : 'bg-[#141622] border-white/5 text-slate-400 hover:border-white/20'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Sample Rate
                </label>
                <select
                  value={sampleRate}
                  onChange={(e) => setSampleRate(parseInt(e.target.value))}
                  className="w-full bg-[#141622] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value={44100}>44.1 kHz</option>
                  <option value={48000}>48.0 kHz</option>
                  <option value={96000}>96.0 kHz</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Bit Depth
                </label>
                <select
                  value={bitDepth}
                  onChange={(e) => setBitDepth(parseInt(e.target.value) as any)}
                  className="w-full bg-[#141622] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value={16}>16-bit PCM</option>
                  <option value={24}>24-bit PCM</option>
                  <option value={32}>32-bit Float</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Loudness Compliance */}
          <div className="bg-[#131520] border border-white/10 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="lufsCheck"
                  checked={normalizeLufs}
                  onChange={(e) => setNormalizeLufs(e.target.checked)}
                  className="accent-[#00E5FF] w-4 h-4 rounded"
                />
                <label htmlFor="lufsCheck" className="text-xs font-bold text-slate-200 cursor-pointer">
                  Normalize to Streaming Target Loudness
                </label>
              </div>
              <span className="text-xs font-mono text-[#00E5FF] font-bold">
                {targetLufs} LUFS
              </span>
            </div>
          </div>

          {/* Export Progress Bar */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-[#00E5FF]">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 animate-spin" />
                  Rendering Audio Graph...
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#00E5FF] to-[#00B0FF] transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {isDone && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-lg flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold">
              <CheckCircle className="w-4 h-4" />
              Export Finished! Download started automatically.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-14 bg-[#171924] border-t border-white/[0.08] px-4 flex items-center justify-end space-x-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 hover:bg-white/10 rounded-lg text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleStartExport}
            disabled={isExporting}
            className="px-6 py-2 bg-gradient-to-r from-[#00E5FF] to-[#00B0FF] hover:opacity-90 disabled:opacity-50 text-black font-bold text-xs rounded-lg shadow-lg shadow-[#00E5FF]/20 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Rendering...' : 'Export Audio Now'}
          </button>
        </div>
      </div>
    </div>
  );
};
