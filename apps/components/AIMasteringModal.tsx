import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle,
  Zap,
  ShieldCheck,
} from 'lucide-react';

interface AIMasteringModalProps {
  onClose: () => void;
  onApplyMastering: (settings: { targetLufs: number; denoise: boolean; stereoSpread: number }) => void;
}

export const AIMasteringModal: React.FC<AIMasteringModalProps> = ({
  onClose,
  onApplyMastering,
}) => {
  const [preset, setPreset] = useState<'spotify' | 'apple' | 'youtube' | 'cd' | 'club'>('spotify');
  const [denoiseEnabled, setDenoiseEnabled] = useState(true);
  const [dereverbEnabled, setDereverbEnabled] = useState(false);
  const [spectralEnhance, setSpectralEnhance] = useState(true);
  const [stereoSpread, setStereoSpread] = useState(120); // 100% to 150%
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const presets = [
    { id: 'spotify', label: 'Spotify Standard', lufs: -14.0, truePeak: -1.0, desc: 'Optimized for streaming loudness compliance' },
    { id: 'apple', label: 'Apple Music', lufs: -16.0, truePeak: -1.0, desc: 'Sound Check compatible with wide dynamic range' },
    { id: 'youtube', label: 'YouTube / Video', lufs: -14.0, truePeak: -1.0, desc: 'Clarity and vocal focus for video sound' },
    { id: 'cd', label: 'CD / Lossless Master', lufs: -9.0, truePeak: -0.1, desc: 'High punch and maximum commercial energy' },
    { id: 'club', label: 'Club / DJ Loud', lufs: -8.0, truePeak: -0.1, desc: 'Heavy sub-bass impact and maximum density' },
  ];

  const currentPreset = presets.find((p) => p.id === preset) || presets[0];

  const handleRunAI = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsComplete(true);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-[#10121A] border border-white/10 rounded-xl w-full max-w-5xl h-[620px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-12 bg-[#171924] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                AI AUDIO CLEANUP & MASTERING ASSISTANT
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Neural DSP Engine
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                EBU R128 Loudness Normalization • True-Peak Brickwall Limiting • Spectral Restoration
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

        {/* Modal Body */}
        <div className="flex-1 p-5 grid grid-cols-12 gap-5 bg-[#090A0E] overflow-y-auto">
          {/* Left Column: Preset Loudness Target Selector */}
          <div className="col-span-5 flex flex-col gap-3">
            <span className="text-xs font-bold text-slate-300 tracking-wide uppercase font-mono">
              1. Select Distribution Target
            </span>

            <div className="flex flex-col gap-2">
              {presets.map((p) => {
                const isSelected = preset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id as any)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-400 text-white shadow-lg'
                        : 'bg-[#141622] border-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-200">{p.label}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-[#00E5FF]">
                        {p.lufs} LUFS
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{p.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: AI Neural Restoration & Dynamic Processing */}
          <div className="col-span-7 flex flex-col justify-between bg-[#13151F] border border-white/10 rounded-xl p-4">
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-300 tracking-wide uppercase font-mono flex items-center justify-between">
                <span>2. Neural DSP Enhancement Modules</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </span>

              {/* Module Toggles */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setDenoiseEnabled(!denoiseEnabled)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    denoiseEnabled
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                      : 'bg-black/30 border-white/5 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">Spectral Denoise</span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {denoiseEnabled ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Removes hiss, room noise, and AC rumble automatically.
                  </p>
                </div>

                <div
                  onClick={() => setDereverbEnabled(!dereverbEnabled)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    dereverbEnabled
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                      : 'bg-black/30 border-white/5 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">AI De-Reverb</span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {dereverbEnabled ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Tightens room reflections for studio dryness.
                  </p>
                </div>

                <div
                  onClick={() => setSpectralEnhance(!spectralEnhance)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    spectralEnhance
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                      : 'bg-black/30 border-white/5 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">Air & Clarity Exciter</span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {spectralEnhance ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Restores upper 12kHz-20kHz harmonics cleanly.
                  </p>
                </div>

                <div className="p-3 rounded-lg border bg-black/30 border-white/10 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200">Stereo Width</span>
                    <span className="text-[10px] font-mono text-[#00E5FF]">
                      {stereoSpread}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="160"
                    step="5"
                    value={stereoSpread}
                    onChange={(e) => setStereoSpread(parseInt(e.target.value))}
                    className="w-full h-1 accent-[#00E5FF] bg-white/10 rounded cursor-pointer mt-1"
                  />
                </div>
              </div>

              {/* Mastering Target Meters */}
              <div className="bg-[#0A0B10] border border-white/10 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-2">
                  <span>Integrated Target: {currentPreset.lufs} LUFS</span>
                  <span>Max True-Peak: {currentPreset.truePeak} dBTP</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.abs(currentPreset.lufs) * 5.5)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Run Button / Status */}
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              {isComplete ? (
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Mastering Graph Generated & Applied!
                </div>
              ) : isProcessing ? (
                <div className="flex items-center gap-2 text-xs font-mono text-[#00E5FF]">
                  <Zap className="w-4 h-4 animate-spin" />
                  Analyzing Multi-Band Dynamic Spectrogram...
                </div>
              ) : (
                <span className="text-[11px] text-slate-400 font-mono">
                  Ready to calculate optimal mastering curve.
                </span>
              )}

              <button
                onClick={handleRunAI}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 disabled:opacity-50 text-black font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                {isComplete ? 'Re-Analyze Audio' : 'Analyze & Master Now'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 bg-[#171924] border-t border-white/[0.08] px-4 flex items-center justify-end space-x-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 hover:bg-white/10 rounded-lg text-xs text-slate-400 hover:text-white"
          >
            Close
          </button>
          <button
            onClick={() => {
              onApplyMastering({
                targetLufs: currentPreset.lufs,
                denoise: denoiseEnabled,
                stereoSpread,
              });
              onClose();
            }}
            className="px-5 py-2 bg-[#00E5FF] hover:bg-[#00B0FF] text-black font-bold text-xs rounded-lg shadow-lg"
          >
            Apply to Master Graph
          </button>
        </div>
      </div>
    </div>
  );
};
