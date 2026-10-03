import React, { useState } from 'react';
import {
  X,
  Settings,
  Cpu,
  Volume2,
} from 'lucide-react';
import { Project } from '../../core/project-model/types';

interface ProjectSettingsModalProps {
  project: Project;
  onClose: () => void;
  onSaveSettings: (settings: {
    name: string;
    bpm: number;
    sampleRate: number;
    bufferSize: number;
    bitDepth: number;
  }) => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  project,
  onClose,
  onSaveSettings,
}) => {
  const [projectName, setProjectName] = useState(project.name);
  const [bpm, setBpm] = useState(project.bpm);
  const [sampleRate, setSampleRate] = useState<number>(48000);
  const [bufferSize, setBufferSize] = useState<number>(256);
  const [bitDepth, setBitDepth] = useState<number>(32);
  const [metronomeSound, setMetronomeSound] = useState<'digital' | 'woodblock' | 'classic'>('digital');
  const [countIn, setCountIn] = useState<number>(1);

  const handleSave = () => {
    onSaveSettings({
      name: projectName,
      bpm,
      sampleRate,
      bufferSize,
      bitDepth,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-[#10121A] border border-white/10 rounded-xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-12 bg-[#171924] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <Settings className="w-4 h-4 text-[#00E5FF]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                PROJECT & AUDIO ENGINE SETTINGS
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Hardware Buffer • Sample Rate Clock • Project Metadata
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
        <div className="p-6 space-y-6 bg-[#090A0E] text-slate-200">
          {/* Section 1: Project Metadata */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider mb-3">
              1. Project Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Project Title
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-[#131520] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Tempo (BPM)
                </label>
                <input
                  type="number"
                  min="40"
                  max="280"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                  className="w-full bg-[#131520] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Audio Engine Configuration */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#00E5FF]" />
              2. Core Audio Engine & Latency
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Sample Rate
                </label>
                <select
                  value={sampleRate}
                  onChange={(e) => setSampleRate(parseInt(e.target.value))}
                  className="w-full bg-[#131520] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value={44100}>44.1 kHz (CD Quality)</option>
                  <option value={48000}>48.0 kHz (Studio Standard)</option>
                  <option value={96000}>96.0 kHz (High-Res Audio)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Bit Depth
                </label>
                <select
                  value={bitDepth}
                  onChange={(e) => setBitDepth(parseInt(e.target.value))}
                  className="w-full bg-[#131520] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value={16}>16-bit Integer</option>
                  <option value={24}>24-bit Integer</option>
                  <option value={32}>32-bit Floating Point</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Buffer Size (Latency)
                </label>
                <select
                  value={bufferSize}
                  onChange={(e) => setBufferSize(parseInt(e.target.value))}
                  className="w-full bg-[#131520] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value={128}>128 samples (2.7 ms)</option>
                  <option value={256}>256 samples (5.3 ms)</option>
                  <option value={512}>512 samples (10.6 ms)</option>
                  <option value={1024}>1024 samples (21.3 ms)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Metronome & Count-in */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider mb-3 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#00E5FF]" />
              3. Metronome & Recording Count-in
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Click Sound Type
                </label>
                <select
                  value={metronomeSound}
                  onChange={(e) => setMetronomeSound(e.target.value as any)}
                  className="w-full bg-[#131520] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="digital">Digital High-Beep</option>
                  <option value="woodblock">Acoustic Woodblock</option>
                  <option value="classic">Classic Mechanical Tick</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Pre-Roll Count-in
                </label>
                <select
                  value={countIn}
                  onChange={(e) => setCountIn(parseInt(e.target.value))}
                  className="w-full bg-[#131520] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value={0}>None (Instant Record)</option>
                  <option value={1}>1 Bar (4 Beats)</option>
                  <option value={2}>2 Bars (8 Beats)</option>
                </select>
              </div>
            </div>
          </div>
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
            onClick={handleSave}
            className="px-5 py-2 bg-gradient-to-r from-[#00E5FF] to-[#00B0FF] hover:opacity-90 text-black font-bold text-xs rounded-lg shadow-lg shadow-[#00E5FF]/20"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
