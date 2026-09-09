import React, { useEffect, useRef, useState } from 'react';
import { Video as VideoIcon, BarChart3, Disc, Activity } from 'lucide-react';
import { AudioGraphEngine } from '../engine/audioGraph';
import { STEM_TYPES, StemType, TrackMetadata } from '../types';

export type VisualizerMode = 'bars' | 'circular' | 'oscilloscope' | 'video';

export interface VideoPlayerProps {
  audioGraph: AudioGraphEngine | null;
  trackMetadata: TrackMetadata | null;
  currentTime: number;
  isPlaying: boolean;
  className?: string;
}

const STEM_COLORS: Record<StemType, string> = {
  vocals: '#00f3ff', // Neon Cyan
  drums: '#ff007f',  // Neon Magenta
  bass: '#ffe600',   // Neon Yellow
  other: '#00ff66',  // Neon Green
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  audioGraph,
  trackMetadata,
  currentTime,
  isPlaying,
  className = '',
}) => {
  const [mode, setMode] = useState<VisualizerMode>('bars');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Peak hold data for spectrum bars
  const peakHoldRef = useRef<number[]>(new Array(128).fill(0));

  // Synchronize muted video with audio engine
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !trackMetadata?.hasVideo || !trackMetadata?.videoUrl) return;

    if (isPlaying) {
      if (video.paused) {
        video.play().catch(() => {});
      }
    } else {
      if (!video.paused) {
        video.pause();
      }
    }
  }, [isPlaying, trackMetadata]);

  // Phase lock video timestamp if it drifts
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !trackMetadata?.hasVideo) return;

    if (Math.abs(video.currentTime - currentTime) > 0.35) {
      video.currentTime = currentTime;
    }
  }, [currentTime, trackMetadata]);

  // Real-time canvas rendering loop (60 FPS)
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Handle responsive resize
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.round(rect.width * dpr);
      const targetHeight = Math.round(rect.height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const width = rect.width;
      const height = rect.height;

      // Dark background with subtle alpha fade for trails
      ctx.fillStyle = 'rgba(10, 11, 16, 0.35)';
      ctx.fillRect(0, 0, width, height);

      if (audioGraph) {
        if (mode === 'bars') {
          // MODE 1: 4-Channel Stacked / Split Frequency Bars
          const barCount = 64;
          const barWidth = (width - (barCount - 1) * 2) / barCount;

          // Collect frequency data from each stem
          const stemFreqs = STEM_TYPES.map((stem) => ({
            stem,
            data: audioGraph.getFrequencyData(stem),
            color: STEM_COLORS[stem],
          }));

          const masterFreq = audioGraph.getFrequencyData();

          for (let i = 0; i < barCount; i++) {
            const dataIdx = Math.floor((i / barCount) * Math.min(masterFreq.length, 256));
            const masterVal = (masterFreq[dataIdx] || 0) / 255;
            const barHeight = Math.max(3, masterVal * (height * 0.85));
            const x = i * (barWidth + 2);
            const y = height - barHeight;

            // Gradient per bar based on dominant frequencies
            const gradient = ctx.createLinearGradient(0, height, 0, y);
            gradient.addColorStop(0, 'rgba(0, 243, 255, 0.9)');
            gradient.addColorStop(0.5, 'rgba(255, 0, 127, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 230, 0, 1.0)');

            ctx.fillStyle = gradient;
            ctx.shadowColor = 'rgba(0, 243, 255, 0.4)';
            ctx.shadowBlur = 8;
            ctx.fillRect(x, y, barWidth, barHeight);

            // Peak hold point
            if (barHeight > (peakHoldRef.current[i] || 0)) {
              peakHoldRef.current[i] = barHeight;
            } else {
              peakHoldRef.current[i] = Math.max(0, (peakHoldRef.current[i] || 0) - 1.5);
            }

            const peakY = height - (peakHoldRef.current[i] || 0);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 10;
            ctx.fillRect(x, peakY - 3, barWidth, 2);
          }

          // Top stem overlay lines
          stemFreqs.forEach(({ data, color }, stemIdx) => {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = color;
            ctx.shadowBlur = 6;

            for (let i = 0; i < barCount; i++) {
              const dataIdx = Math.floor((i / barCount) * Math.min(data.length, 256));
              const val = (data[dataIdx] || 0) / 255;
              const valY = height * 0.35 - val * (height * 0.28) + stemIdx * 8;
              const x = i * (barWidth + 2) + barWidth / 2;

              if (i === 0) {
                ctx.moveTo(x, valY);
              } else {
                ctx.lineTo(x, valY);
              }
            }
            ctx.stroke();
          });
        } else if (mode === 'circular') {
          // MODE 2: Circular Spectrum Visualizer
          const masterFreq = audioGraph.getFrequencyData();
          const centerX = width / 2;
          const centerY = height / 2;
          const baseRadius = Math.min(width, height) * 0.22;
          const numBars = 72;

          // Bass pulse detection
          let bassSum = 0;
          for (let i = 0; i < 16; i++) {
            bassSum += masterFreq[i] || 0;
          }
          const bassEnergy = bassSum / (16 * 255);
          const currentRadius = baseRadius + bassEnergy * 25;

          // Inner pulsing core
          ctx.beginPath();
          ctx.arc(centerX, centerY, currentRadius * 0.75, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 243, 255, ${0.1 + bassEnergy * 0.35})`;
          ctx.shadowColor = '#00f3ff';
          ctx.shadowBlur = 20 * (1 + bassEnergy);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(centerX, centerY, currentRadius * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 0, 127, ${0.15 + bassEnergy * 0.4})`;
          ctx.shadowColor = '#ff007f';
          ctx.shadowBlur = 25 * (1 + bassEnergy);
          ctx.fill();

          // Radial spectrum bars
          for (let i = 0; i < numBars; i++) {
            const angle = (i / numBars) * Math.PI * 2 - Math.PI / 2;
            const dataIdx = Math.floor((i / numBars) * Math.min(masterFreq.length, 200));
            const val = (masterFreq[dataIdx] || 0) / 255;
            const barLen = 5 + Math.pow(val, 1.2) * (Math.min(width, height) * 0.28);

            const xStart = centerX + Math.cos(angle) * currentRadius;
            const yStart = centerY + Math.sin(angle) * currentRadius;
            const xEnd = centerX + Math.cos(angle) * (currentRadius + barLen);
            const yEnd = centerY + Math.sin(angle) * (currentRadius + barLen);

            ctx.beginPath();
            ctx.moveTo(xStart, yStart);
            ctx.lineTo(xEnd, yEnd);
            ctx.lineWidth = 3;
            ctx.strokeStyle = i % 2 === 0 ? '#00f3ff' : '#ff007f';
            ctx.shadowColor = i % 2 === 0 ? 'rgba(0, 243, 255, 0.8)' : 'rgba(255, 0, 127, 0.8)';
            ctx.shadowBlur = 10;
            ctx.stroke();
          }
        } else if (mode === 'oscilloscope') {
          // MODE 3: Time-Domain Waveform Oscilloscope
          const waveData = audioGraph.getWaveformData();
          const sliceWidth = width / waveData.length;

          ctx.beginPath();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#00ff66';
          ctx.shadowColor = '#00ff66';
          ctx.shadowBlur = 14;

          let x = 0;
          for (let i = 0; i < waveData.length; i++) {
            const v = waveData[i] / 128.0; // 0 to 2, 1.0 is center
            const y = (v * height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }

            x += sliceWidth;
          }

          ctx.stroke();

          // Horizontal center reference line
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.moveTo(0, height / 2);
          ctx.lineTo(width, height / 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else {
        // Idle animation when audio is not playing
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AUDIO VISUALIZER STANDBY', width / 2, height / 2);
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [audioGraph, mode]);

  return (
    <div className={`relative bg-deck-card border border-deck-border rounded-xl overflow-hidden shadow-2xl flex flex-col ${className}`}>
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-deck-dark/80 backdrop-blur-md border-b border-deck-border flex items-center justify-between z-20">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-neon-cyan" />
          <span className="text-xs font-bold tracking-wider text-slate-200 uppercase font-mono">
            Reactive Audio Stage
          </span>
          {trackMetadata?.title && (
            <span className="text-[11px] text-slate-400 font-mono truncate max-w-[200px]">
              - {trackMetadata.title}
            </span>
          )}
        </div>

        {/* Visualizer Mode Selector */}
        <div className="flex items-center space-x-1 bg-deck-dark p-0.5 rounded-lg border border-deck-border text-xs">
          <button
            onClick={() => setMode('bars')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
              mode === 'bars'
                ? 'bg-deck-card text-neon-cyan shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Frequency Bars"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono">Bars</span>
          </button>

          <button
            onClick={() => setMode('circular')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
              mode === 'circular'
                ? 'bg-deck-card text-neon-magenta shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Circular Spectrum"
          >
            <Disc className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono">Radial</span>
          </button>

          <button
            onClick={() => setMode('oscilloscope')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
              mode === 'oscilloscope'
                ? 'bg-deck-card text-neon-green shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Waveform Scope"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono">Scope</span>
          </button>

          {trackMetadata?.hasVideo && (
            <button
              onClick={() => setMode('video')}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
                mode === 'video'
                  ? 'bg-deck-card text-neon-yellow shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Phase-Locked Video"
            >
              <VideoIcon className="w-3.5 h-3.5" />
              <span className="text-[11px] font-mono">Video</span>
            </button>
          )}
        </div>
      </div>

      {/* Stage Viewport */}
      <div className="relative flex-1 bg-black min-h-[360px] flex items-center justify-center overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293d10_1px,transparent_1px),linear-gradient(to_bottom,#1f293d10_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] pointer-events-none" />

        {/* Video Mode Player */}
        {trackMetadata?.hasVideo && trackMetadata.videoUrl && (
          <video
            ref={videoRef}
            src={trackMetadata.videoUrl}
            muted
            playsInline
            className={`absolute inset-0 w-full h-full object-contain ${
              mode === 'video' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
            }`}
          />
        )}

        {/* 60 FPS HTML5 Canvas Visualizer */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${
            mode === 'video' ? 'opacity-20 pointer-events-none z-15' : 'opacity-100 z-10'
          }`}
        />

        {/* Stem Legend in Bars Mode */}
        {mode === 'bars' && (
          <div className="absolute bottom-3 left-4 bg-deck-dark/80 backdrop-blur-md border border-deck-border rounded-lg px-3 py-1.5 flex items-center space-x-4 text-[10px] font-mono z-20">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-neon-cyan" />
              <span className="text-slate-300">Vocals</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-neon-magenta" />
              <span className="text-slate-300">Drums</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-neon-yellow" />
              <span className="text-slate-300">Bass</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-neon-green" />
              <span className="text-slate-300">Other</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
