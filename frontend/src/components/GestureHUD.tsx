import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, Eye, EyeOff, FlipHorizontal, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { GestureTracker } from '../engine/gestureTracker';
import { GestureState } from '../types';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface GestureHUDProps {
  gestureTracker: GestureTracker | null;
  gestureState: GestureState;
  onGestureStateChange?: (state: GestureState) => void;
  isEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  className?: string;
}

// 21-point hand skeleton connection lines
const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle & Palm
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring & Palm
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky & Palm base
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

export const GestureHUD: React.FC<GestureHUDProps> = ({
  gestureTracker,
  gestureState,
  onGestureStateChange,
  isEnabled,
  onToggleEnabled,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);

  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(performance.now());
  const latestLandmarksRef = useRef<NormalizedLandmark[][]>([]);

  // Initialize and stop camera stream
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Webcam API is not supported in this browser environment.');
      return;
    }

    try {
      setIsLoadingCamera(true);
      setCameraError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 60 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsLoadingCamera(false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Camera access denied or unavailable.';
      setCameraError(errorMsg);
      setIsLoadingCamera(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Handle enable/disable tracking
  useEffect(() => {
    if (isEnabled) {
      startCamera();
    } else {
      stopCamera();
      if (gestureTracker) {
        gestureTracker.stopTracking();
      }
    }

    return () => {
      stopCamera();
    };
  }, [isEnabled, startCamera, stopCamera, gestureTracker]);

  // Hook GestureTracker to video stream
  useEffect(() => {
    if (!isEnabled || !gestureTracker || !videoRef.current) return;

    const videoEl = videoRef.current;

    const handleFrame = (state: GestureState, rawLandmarks?: NormalizedLandmark[][]) => {
      if (rawLandmarks) {
        latestLandmarksRef.current = rawLandmarks;
      }
      if (onGestureStateChange) {
        onGestureStateChange(state);
      }

      // FPS calculation
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsUpdateRef.current >= 1000) {
        const measuredFps = Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current));
        setFps(measuredFps);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }
    };

    gestureTracker.startTracking(videoEl, handleFrame);

    return () => {
      gestureTracker.stopTracking();
    };
  }, [isEnabled, gestureTracker, onGestureStateChange]);

  // Canvas drawing render loop for glowing skeleton overlay
  useEffect(() => {
    let animId: number;

    const renderOverlay = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (canvas && video && video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (showSkeleton && latestLandmarksRef.current.length > 0) {
            ctx.save();

            if (isMirrored) {
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
            }

            // Draw hand skeletons
            latestLandmarksRef.current.forEach((handLandmarks, handIdx) => {
              if (!handLandmarks || handLandmarks.length < 21) return;

              // Left hand cyan (#00f3ff), Right hand magenta (#ff007f)
              const isLeftHand = handIdx === 0;
              const mainColor = isLeftHand ? '#00f3ff' : '#ff007f';
              const glowColor = isLeftHand ? 'rgba(0, 243, 255, 0.8)' : 'rgba(255, 0, 127, 0.8)';
              const tipColor = isLeftHand ? '#ffffff' : '#ffe600';

              // Draw connections / bones
              ctx.lineWidth = 3;
              ctx.strokeStyle = mainColor;
              ctx.shadowColor = glowColor;
              ctx.shadowBlur = 12;

              for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
                const p1 = handLandmarks[startIdx];
                const p2 = handLandmarks[endIdx];
                if (!p1 || !p2) continue;

                ctx.beginPath();
                ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
                ctx.stroke();
              }

              // Draw joints
              for (let i = 0; i < handLandmarks.length; i++) {
                const pt = handLandmarks[i];
                const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
                const radius = isTip ? 5 : 3.5;

                ctx.beginPath();
                ctx.arc(pt.x * canvas.width, pt.y * canvas.height, radius, 0, 2 * Math.PI);
                ctx.fillStyle = isTip ? tipColor : mainColor;
                ctx.shadowColor = isTip ? tipColor : glowColor;
                ctx.shadowBlur = isTip ? 16 : 8;
                ctx.fill();
              }
            });

            ctx.restore();
          }
        }
      }

      animId = requestAnimationFrame(renderOverlay);
    };

    animId = requestAnimationFrame(renderOverlay);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [showSkeleton, isMirrored]);

  return (
    <div className={`relative bg-deck-card border border-deck-border rounded-xl overflow-hidden shadow-2xl flex flex-col ${className}`}>
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-deck-dark/80 backdrop-blur-md border-b border-deck-border flex items-center justify-between z-20">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-neon-cyan animate-ping" />
          <span className="text-xs font-bold tracking-wider text-slate-200 uppercase font-mono">
            Vision HUD / Skeleton Tracker
          </span>
        </div>

        {/* HUD Controls */}
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-deck-card border border-deck-border text-neon-cyan">
            {fps} FPS
          </span>

          <button
            onClick={() => setIsMirrored(!isMirrored)}
            title="Mirror Video Feed"
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              isMirrored
                ? 'bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan'
                : 'bg-deck-dark border-deck-border text-slate-400 hover:text-slate-200'
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowSkeleton(!showSkeleton)}
            title="Toggle Skeleton Overlay"
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              showSkeleton
                ? 'bg-neon-magenta/20 border-neon-magenta/50 text-neon-magenta'
                : 'bg-deck-dark border-deck-border text-slate-400 hover:text-slate-200'
            }`}
          >
            {showSkeleton ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => onToggleEnabled(!isEnabled)}
            className={`px-3 py-1 rounded-lg border text-xs font-mono font-semibold flex items-center space-x-1.5 transition-all ${
              isEnabled
                ? 'bg-red-500/20 border-red-500/60 text-red-400 hover:bg-red-500/30'
                : 'bg-neon-cyan/20 border-neon-cyan/60 text-neon-cyan hover:bg-neon-cyan/30'
            }`}
          >
            {isEnabled ? (
              <>
                <CameraOff className="w-3.5 h-3.5" />
                <span>Disable</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                <span>Enable Camera</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Video + Canvas Viewport */}
      <div className="relative flex-1 bg-black min-h-[360px] flex items-center justify-center overflow-hidden">
        {/* Subtle Cyberpunk Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293d10_1px,transparent_1px),linear-gradient(to_bottom,#1f293d10_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] pointer-events-none" />

        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-transform duration-200 ${
            isMirrored ? 'scale-x-[-1]' : ''
          } ${isEnabled && !cameraError ? 'opacity-90' : 'opacity-0'}`}
        />

        {/* Canvas Landmark Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
        />

        {/* Disabled / Empty State */}
        {!isEnabled && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-deck-dark/95 z-10">
            <div className="w-16 h-16 rounded-2xl bg-deck-card border border-neon-cyan/30 flex items-center justify-center mb-4 shadow-neon-cyan/20 shadow-lg">
              <Camera className="w-8 h-8 text-neon-cyan animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-1 font-mono">
              Webcam Gesture Tracking Inactive
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              Click &apos;Enable Camera&apos; to track hand heights, pinch gestures, and fist kill switches in real time.
            </p>
            <button
              onClick={() => onToggleEnabled(true)}
              className="px-4 py-2 bg-gradient-to-r from-neon-cyan to-neon-magenta text-deck-dark font-bold text-xs rounded-lg shadow-neon-cyan/50 shadow-md hover:scale-105 transition-transform flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Activate Spatial Vision</span>
            </button>
          </div>
        )}

        {/* Camera Loading State */}
        {isEnabled && isLoadingCamera && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-deck-dark/80 z-15 backdrop-blur-sm">
            <RefreshCw className="w-8 h-8 text-neon-cyan animate-spin mb-3" />
            <span className="text-xs font-mono text-slate-300">Initializing MediaPipe Vision Model...</span>
          </div>
        )}

        {/* Camera Error State */}
        {isEnabled && cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-deck-dark/90 z-15">
            <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
            <h4 className="text-sm font-bold text-red-400 mb-1 font-mono">Camera Stream Unavailable</h4>
            <p className="text-xs text-slate-400 max-w-xs mb-3">{cameraError}</p>
            <button
              onClick={startCamera}
              className="px-3 py-1.5 bg-deck-card border border-deck-border text-xs rounded text-slate-200 hover:text-white"
            >
              Retry Camera Connection
            </button>
          </div>
        )}

        {/* Dynamic Telemetry Badges */}
        {isEnabled && !cameraError && (
          <>
            {/* Left Hand Telemetry Badge */}
            <div className="absolute top-3 left-3 bg-deck-dark/85 backdrop-blur-md border border-neon-cyan/40 rounded-lg px-3 py-2 text-xs font-mono shadow-neon-cyan/20 shadow-lg z-20 max-w-[210px]">
              <div className="flex items-center space-x-2 mb-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    gestureState.leftHand.present ? 'bg-neon-cyan animate-ping' : 'bg-slate-600'
                  }`}
                />
                <span className="text-neon-cyan font-extrabold tracking-wider">LEFT HAND</span>
              </div>
              <div className="text-[11px] text-slate-300">
                VOCALS:{' '}
                <span className="text-neon-cyan font-bold">
                  {gestureState.leftHand.present
                    ? `${Math.round(gestureState.leftHand.height * 100)}%`
                    : 'OFF'}
                </span>
              </div>
              {gestureState.leftHand.isPinching && (
                <div className="mt-1 px-1.5 py-0.5 bg-neon-yellow/20 border border-neon-yellow/60 rounded text-[10px] text-neon-yellow font-bold animate-pulse">
                  SOLO ACTIVE (PINCH)
                </div>
              )}
              {gestureState.leftHand.isFist && (
                <div className="mt-1 px-1.5 py-0.5 bg-red-500/20 border border-red-500/60 rounded text-[10px] text-red-400 font-bold">
                  MUTED (FIST)
                </div>
              )}
            </div>

            {/* Right Hand Telemetry Badge */}
            <div className="absolute top-3 right-3 bg-deck-dark/85 backdrop-blur-md border border-neon-magenta/40 rounded-lg px-3 py-2 text-xs font-mono shadow-neon-magenta/20 shadow-lg z-20 max-w-[210px] text-right">
              <div className="flex items-center justify-end space-x-2 mb-1">
                <span className="text-neon-magenta font-extrabold tracking-wider">RIGHT HAND</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    gestureState.rightHand.present ? 'bg-neon-magenta animate-ping' : 'bg-slate-600'
                  }`}
                />
              </div>
              <div className="text-[11px] text-slate-300">
                INSTRUMENTS:{' '}
                <span className="text-neon-magenta font-bold">
                  {gestureState.rightHand.present
                    ? `${Math.round(gestureState.rightHand.height * 100)}%`
                    : 'OFF'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                DJ FILTER:{' '}
                <span className="text-neon-magenta font-bold">
                  {(gestureState.djFilterCutoff / 1000).toFixed(1)} kHz [
                  {gestureState.djFilterType === 'lowpass' ? 'LP' : 'HP'}]
                </span>
              </div>
            </div>

            {/* Dual Fist Master Kill Switch Alert */}
            {gestureState.isDualFist && (
              <div className="absolute bottom-4 inset-x-8 bg-red-600/90 backdrop-blur-md border border-red-400 rounded-xl py-2 px-4 text-center shadow-red-500/50 shadow-2xl z-30 animate-pulse">
                <span className="text-white font-mono font-extrabold text-xs tracking-widest uppercase">
                  ⚠️ KILL SWITCH ACTIVE (DUAL FIST) — ALL STEMS MUTED ⚠️
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GestureHUD;
