import React, { useState, useEffect } from 'react';
import { SourceAsset } from '../../core/project-model/types';
import { StemLabClient, StemSeparationProgress, SeparatedStemResult } from '../../ml/stem-lab/service';
import {
  Layers,
  X,
  Sparkles,
  Zap,
  CheckCircle2,
  Cpu,
  ArrowRight,
} from 'lucide-react';

interface StemLabModalProps {
  sourceAsset: SourceAsset;
  audioCtx: AudioContext;
  onClose: () => void;
  onApplyStems: (stems: SeparatedStemResult[]) => void;
}

export const StemLabModal: React.FC<StemLabModalProps> = ({
  sourceAsset,
  audioCtx,
  onClose,
  onApplyStems,
}) => {
  const [client] = useState(() => new StemLabClient());
  const [modelType, setModelType] = useState<'htdemucs_4s' | 'htdemucs_6s' | 'two_stems'>('htdemucs_4s');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLocalDemucsOnline, setIsLocalDemucsOnline] = useState<boolean>(false);
  const [progressState, setProgressState] = useState<StemSeparationProgress>({
    status: 'connecting',
    progress: 0,
    message: 'Ready to separate stems.',
  });
  const [separatedResults, setSeparatedResults] = useState<SeparatedStemResult[] | null>(null);

  useEffect(() => {
    client.checkHealth().then((online) => {
      setIsLocalDemucsOnline(online);
    });
  }, [client]);

  const handleStartSeparation = async () => {
    setIsProcessing(true);
    try {
      const results = await client.separateStems(sourceAsset, audioCtx, (p) => {
        setProgressState(p);
      });
      setSeparatedResults(results);
    } catch (err) {
      console.error('Stem separation failed:', err);
      setProgressState({
        status: 'error',
        progress: 0,
        message: 'Separation encountered an error.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md select-none p-4">
      <div className="w-full max-w-xl bg-[#15171F] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="h-14 px-5 bg-[#1A1D27] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Stem Lab Studio</h2>
              <p className="text-[10px] text-slate-400 truncate max-w-xs font-mono">
                Source: {sourceAsset.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5">
          {/* Local Engine Status Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#101218] border border-white/[0.06]">
            <div className="flex items-center space-x-2.5">
              <Cpu className={`w-4 h-4 ${isLocalDemucsOnline ? 'text-emerald-400' : 'text-amber-400'}`} />
              <div>
                <span className="text-xs font-semibold text-slate-200 block">
                  {isLocalDemucsOnline ? 'Local Demucs v4 Engine Detected' : 'Demucs Local CLI Engine'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {isLocalDemucsOnline
                    ? 'CUDA / DirectML / CPU Acceleration Ready'
                    : 'Global path: AppData/Local/Programs/Python/Python313/Scripts/demucs.exe'}
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              CONNECTED
            </span>
          </div>

          {/* Model Preset Selection */}
          {!separatedResults && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Separation Preset & Model
              </label>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => setModelType('two_stems')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modelType === 'two_stems'
                      ? 'bg-pro-accent/20 border-pro-accent text-white shadow-lg'
                      : 'bg-[#181A22] border-white/[0.06] text-slate-400 hover:bg-[#1D202A]'
                  }`}
                >
                  <span className="text-xs font-bold block text-white">2 Stems</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Vocals + Instrumental</span>
                </button>

                <button
                  onClick={() => setModelType('htdemucs_4s')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modelType === 'htdemucs_4s'
                      ? 'bg-purple-500/20 border-purple-500 text-white shadow-lg'
                      : 'bg-[#181A22] border-white/[0.06] text-slate-400 hover:bg-[#1D202A]'
                  }`}
                >
                  <span className="text-xs font-bold block text-white">4 Stems (Standard)</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Vocals, Drums, Bass, Other</span>
                </button>

                <button
                  onClick={() => setModelType('htdemucs_6s')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modelType === 'htdemucs_6s'
                      ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg'
                      : 'bg-[#181A22] border-white/[0.06] text-slate-400 hover:bg-[#1D202A]'
                  }`}
                >
                  <span className="text-xs font-bold block text-white">6 Stems (Pro)</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">+ Guitar & Piano</span>
                </button>
              </div>
            </div>
          )}

          {/* Progress State or Separated Results List */}
          {isProcessing && (
            <div className="p-4 rounded-xl bg-[#0F1117] border border-white/[0.06] space-y-3">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                  <span>{progressState.message}</span>
                </span>
                <span className="font-mono text-purple-400 font-bold">{progressState.progress}%</span>
              </div>
              <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${progressState.progress}%` }}
                />
              </div>
            </div>
          )}

          {separatedResults && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Separation Complete ({separatedResults.length} Stems)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Content-Addressed Cache Saved</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {separatedResults.map((stem) => (
                  <div
                    key={stem.stemType}
                    className="p-3 rounded-xl bg-[#1A1C24] border border-white/[0.06] flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: stem.color }}
                      />
                      <span className="text-xs font-semibold text-white capitalize truncate">
                        {stem.stemType}
                      </span>
                    </div>

                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-300 font-mono">
                      WAV 32-bit
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="h-16 px-5 bg-[#1A1D27] border-t border-white/[0.08] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>

          {!separatedResults ? (
            <button
              onClick={handleStartSeparation}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isProcessing ? 'Processing...' : 'Separate Stems'}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onApplyStems(separatedResults);
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all"
            >
              <span>Add Stems to Timeline</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
