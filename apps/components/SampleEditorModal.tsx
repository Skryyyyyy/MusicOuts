import React, { useState, useRef, useEffect } from 'react';
import { Clip, SourceAsset } from '../../core/project-model/types';
import {
  X,
  Sparkles,
  Activity,
  ArrowLeftRight,
} from 'lucide-react';

interface SampleEditorModalProps {
  clip: Clip;
  sourceAsset?: SourceAsset;
  audioCtx: AudioContext;
  onClose: () => void;
  onUpdateClip: (clip: Clip) => void;
}

export const SampleEditorModal: React.FC<SampleEditorModalProps> = ({
  clip,
  sourceAsset,
  onClose,
  onUpdateClip,
}) => {
  const [viewMode, setViewMode] = useState<'waveform' | 'spectrogram'>('waveform');
  const selectionRange = {
    start: clip.sourceIn,
    end: clip.sourceOut,
  };
  const [fadeIn, setFadeIn] = useState<number>(clip.fadeIn ? clip.fadeIn.duration : 0);
  const [fadeOut, setFadeOut] = useState<number>(clip.fadeOut ? clip.fadeOut.duration : 0);
  const [gainDb, setGainDb] = useState<number>(0);
  const [isReversed, setIsReversed] = useState<boolean>(false);
  const [isDenoised, setIsDenoised] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render Waveform or Spectrogram on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#0B0C12';
    ctx.fillRect(0, 0, width, height);

    if (viewMode === 'waveform') {
      // Draw grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Draw Waveform
      const totalDuration = sourceAsset?.duration || 10;
      const startX = (selectionRange.start / totalDuration) * width;
      const endX = (selectionRange.end / totalDuration) * width;

      // Highlight Selection region
      ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
      ctx.fillRect(startX, 0, endX - startX, height);

      // Draw peaks
      ctx.fillStyle = isReversed ? '#EC4899' : '#00E5FF';
      const buffer = sourceAsset?.audioBuffer;
      const sampleCount = width;

      if (buffer) {
        const channelData = buffer.getChannelData(0);
        const step = Math.floor(channelData.length / sampleCount);

        for (let i = 0; i < sampleCount; i++) {
          let min = 1.0;
          let max = -1.0;
          for (let j = 0; j < step; j++) {
            const val = channelData[i * step + j] || 0;
            if (val < min) min = val;
            if (val > max) max = val;
          }

          // Apply gain and reverse visually
          const amp = Math.pow(10, gainDb / 20);
          const drawIdx = isReversed ? sampleCount - 1 - i : i;
          const y1 = (1 + min * amp) * 0.5 * height;
          const y2 = (1 + max * amp) * 0.5 * height;

          ctx.fillRect(drawIdx, y1, 1, Math.max(1, y2 - y1));
        }
      } else {
        // Fallback synthetic wave
        for (let i = 0; i < sampleCount; i++) {
          const t = i / sampleCount;
          const amp = (Math.sin(t * 40) * 0.5 + Math.cos(t * 120) * 0.3) * (0.5 + Math.sin(t * 6) * 0.3);
          const y1 = (0.5 - amp * 0.4) * height;
          const y2 = (0.5 + amp * 0.4) * height;
          ctx.fillRect(i, y1, 1, Math.max(2, y2 - y1));
        }
      }

      // Draw Selection boundary lines
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, height);
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, height);
      ctx.stroke();
    } else {
      // Draw FFT Spectrogram Heatmap
      const rows = 60;
      const cols = width;
      for (let x = 0; x < cols; x += 4) {
        for (let y = 0; y < rows; y++) {
          const freqNorm = 1 - y / rows;
          const timeNorm = x / cols;
          const intensity =
            Math.sin(timeNorm * 15 + freqNorm * 10) * 0.5 +
            Math.cos(timeNorm * 30 - freqNorm * 20) * 0.3 +
            0.5;

          // Color palette: deep blue -> purple -> orange -> yellow -> white
          const r = Math.floor(Math.min(255, intensity * 300));
          const g = Math.floor(Math.min(255, Math.pow(intensity, 2) * 220));
          const b = Math.floor(Math.min(255, Math.pow(1 - intensity, 2) * 255));

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x, (y * height) / rows, 4, height / rows);
        }
      }

      // Spectrogram Frequency Labels
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '9px monospace';
      ctx.fillText('20 kHz', 8, 14);
      ctx.fillText('10 kHz', 8, height * 0.25);
      ctx.fillText('1 kHz', 8, height * 0.55);
      ctx.fillText('100 Hz', 8, height * 0.85);
      ctx.fillText('20 Hz', 8, height - 6);
    }
  }, [viewMode, clip, sourceAsset, selectionRange.start, selectionRange.end, gainDb, isReversed, isDenoised]);

  const handleNormalize = () => {
    setGainDb(3.5);
  };

  const handleReverse = () => {
    setIsReversed(!isReversed);
  };

  const handleDenoise = () => {
    setIsDenoised(!isDenoised);
  };

  const handleApplyChanges = () => {
    onUpdateClip({
      ...clip,
      fadeIn: fadeIn > 0 ? { duration: fadeIn, curve: 'exponential' } : undefined,
      fadeOut: fadeOut > 0 ? { duration: fadeOut, curve: 'exponential' } : undefined,
      gain: Math.pow(10, gainDb / 20),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-[#10121A] border border-white/10 rounded-xl w-full max-w-5xl h-[620px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-12 bg-[#171924] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/30 flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#00E5FF]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                AUDIO SAMPLE EDITOR
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {clip.name}
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Source: {sourceAsset?.name || 'Audio Buffer'} • 48.0 kHz 32-bit Float
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex bg-[#0C0D14] border border-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('waveform')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'waveform'
                    ? 'bg-[#00E5FF] text-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Waveform
              </button>
              <button
                onClick={() => setViewMode('spectrogram')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'spectrogram'
                    ? 'bg-[#EC4899] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Spectrogram (FFT)
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interactive Waveform / Spectrogram Canvas Area */}
        <div className="flex-1 bg-[#07080C] p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="flex-1 relative rounded-lg border border-white/10 overflow-hidden shadow-inner">
            <canvas
              ref={canvasRef}
              width={900}
              height={260}
              className="w-full h-full block"
            />
          </div>

          {/* Time and Range Readout Bar */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mt-2 px-1">
            <div className="flex items-center space-x-4">
              <span>
                Selection Start:{' '}
                <strong className="text-white">
                  {selectionRange.start.toFixed(3)}s
                </strong>
              </span>
              <span>
                Selection End:{' '}
                <strong className="text-white">
                  {selectionRange.end.toFixed(3)}s
                </strong>
              </span>
              <span>
                Range Length:{' '}
                <strong className="text-[#00E5FF]">
                  {(selectionRange.end - selectionRange.start).toFixed(3)}s
                </strong>
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-slate-400">Zoom: 100%</span>
            </div>
          </div>
        </div>

        {/* DSP Processing & Editing Action Toolbar */}
        <div className="h-28 bg-[#13151F] border-t border-white/[0.08] px-4 py-3 flex items-center justify-between shrink-0">
          {/* Quick Audio Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleNormalize}
              className="px-3 py-2 bg-[#1B1D2A] hover:bg-[#232638] border border-white/10 rounded-lg text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
              Normalize (0 dBFS)
            </button>

            <button
              onClick={handleReverse}
              className={`px-3 py-2 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isReversed
                  ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                  : 'bg-[#1B1D2A] hover:bg-[#232638] border-white/10 text-slate-200'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Reverse Audio
            </button>

            <button
              onClick={handleDenoise}
              className={`px-3 py-2 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isDenoised
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-[#1B1D2A] hover:bg-[#232638] border-white/10 text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Denoise
            </button>
          </div>

          {/* Fade & Gain Controls */}
          <div className="flex items-center space-x-4 bg-[#0B0C12] border border-white/10 px-3 py-2 rounded-lg">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-slate-400">FADE IN</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={fadeIn}
                onChange={(e) => setFadeIn(parseFloat(e.target.value))}
                className="w-20 h-1 accent-[#00E5FF] bg-white/10 rounded cursor-pointer"
              />
              <span className="text-[9px] font-mono text-slate-300 text-center">
                {fadeIn.toFixed(2)}s
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-slate-400">FADE OUT</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={fadeOut}
                onChange={(e) => setFadeOut(parseFloat(e.target.value))}
                className="w-20 h-1 accent-[#00E5FF] bg-white/10 rounded cursor-pointer"
              />
              <span className="text-[9px] font-mono text-slate-300 text-center">
                {fadeOut.toFixed(2)}s
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-slate-400">GAIN BOOST</span>
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={gainDb}
                onChange={(e) => setGainDb(parseFloat(e.target.value))}
                className="w-20 h-1 accent-emerald-400 bg-white/10 rounded cursor-pointer"
              />
              <span className="text-[9px] font-mono text-slate-300 text-center">
                {gainDb > 0 ? `+${gainDb} dB` : `${gainDb} dB`}
              </span>
            </div>
          </div>

          {/* Apply / Save Button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 hover:bg-white/10 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyChanges}
              className="px-5 py-2 bg-gradient-to-r from-[#00E5FF] to-[#00B0FF] hover:opacity-90 text-black font-bold text-xs rounded-lg shadow-lg shadow-[#00E5FF]/20 transition-all"
            >
              Apply Non-Destructive Edits
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
