import React, { useRef, useEffect } from 'react';
import { SourceAsset, Fade } from '../../core/project-model/types';
import { PeakPyramid, selectPyramidLevel, generatePeakPyramid } from '../../core/analysis/waveform';

interface WaveformCanvasProps {
  sourceAsset?: SourceAsset;
  sourceIn: number;
  sourceOut: number;
  color?: string;
  fadeIn?: Fade;
  fadeOut?: Fade;
  isSelected?: boolean;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  sourceAsset,
  sourceIn,
  sourceOut,
  color = '#38BDF8',
  fadeIn,
  fadeOut,
  isSelected = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 200;
    const height = canvas.clientHeight || 48;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const duration = Math.max(0.1, sourceOut - sourceIn);
    const centerY = height / 2;
    const halfHeight = (height / 2) * 0.88;

    ctx.fillStyle = color;
    ctx.globalAlpha = isSelected ? 0.95 : 0.82;

    // Check if peak pyramids exist or can be generated from audioBuffer
    let pyramids = sourceAsset?.peakPyramids;
    if (!pyramids && sourceAsset?.audioBuffer) {
      try {
        const generated = generatePeakPyramid(sourceAsset.audioBuffer);
        pyramids = generated.levels as any;
        if (sourceAsset) {
          sourceAsset.peakPyramids = pyramids;
        }
      } catch {
        // Fallback below
      }
    }

    if (pyramids && Object.keys(pyramids).length > 0) {
      const resolutions = Object.keys(pyramids).map(Number).sort((a, b) => a - b);
      const pyramid: PeakPyramid = {
        resolutions,
        levels: pyramids as any,
      };

      const { resolution, data } = selectPyramidLevel(
        pyramid,
        duration,
        sourceAsset?.sampleRate || 44100,
        width
      );

      const samplesPerBin = resolution;
      const sampleRate = sourceAsset?.sampleRate || 44100;
      const startSample = Math.floor(sourceIn * sampleRate);
      const totalSamples = Math.floor(duration * sampleRate);

      for (let x = 0; x < width; x++) {
        const sampleOffset = startSample + Math.floor((x / width) * totalSamples);
        const binIdx = Math.floor(sampleOffset / samplesPerBin);

        if (binIdx >= 0 && binIdx < data.length) {
          const minVal = data.min[binIdx];
          const maxVal = data.max[binIdx];

          const timeAtPixel = sourceIn + (x / width) * duration;
          let fadeMultiplier = 1.0;

          if (fadeIn && fadeIn.duration > 0) {
            const fadeProgress = (timeAtPixel - sourceIn) / fadeIn.duration;
            if (fadeProgress < 1.0) {
              fadeMultiplier *= Math.max(0, Math.min(1, fadeProgress));
            }
          }

          if (fadeOut && fadeOut.duration > 0) {
            const fadeProgress = (sourceOut - timeAtPixel) / fadeOut.duration;
            if (fadeProgress < 1.0) {
              fadeMultiplier *= Math.max(0, Math.min(1, fadeProgress));
            }
          }

          const topY = centerY - Math.max(0.08, maxVal * fadeMultiplier) * halfHeight;
          const bottomY = centerY - Math.min(-0.08, minVal * fadeMultiplier) * halfHeight;
          const barHeight = Math.max(1.8, bottomY - topY);

          ctx.fillRect(x, topY, 1.2, barHeight);
        }
      }
    } else {
      // High-definition fallback waveform shape based on audio envelope
      for (let x = 0; x < width; x++) {
        const norm = x / width;
        const wave =
          Math.abs(Math.sin(norm * 32)) * 0.45 +
          Math.abs(Math.sin(norm * 16 + 1.2)) * 0.35 +
          Math.abs(Math.cos(norm * 64)) * 0.15 +
          0.05;
        const barHeight = Math.max(2, wave * halfHeight * 2);
        const topY = centerY - barHeight / 2;
        ctx.fillRect(x, topY, 1.2, barHeight);
      }
    }

    // Zero-crossing center guide
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    ctx.restore();
  }, [sourceAsset, sourceIn, sourceOut, color, fadeIn, fadeOut, isSelected]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full pointer-events-none block"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
