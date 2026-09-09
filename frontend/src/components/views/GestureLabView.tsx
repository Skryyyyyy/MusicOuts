import React from "react";
import { Sparkles, Eye, Camera, Activity, Sliders, AlertCircle } from "lucide-react";
import { GestureHUD } from "../GestureHUD";
import { GestureTracker } from "../../engine/gestureTracker";
import { GestureState } from "../../types";

export interface GestureLabViewProps {
  gestureTracker: GestureTracker | null;
  gestureState: GestureState;
  isGestureEnabled: boolean;
  onToggleGestureEnabled: (enabled: boolean) => void;
  onGestureStateChange?: (state: GestureState) => void;
  className?: string;
}

export const GestureLabView: React.FC<GestureLabViewProps> = ({
  gestureTracker,
  gestureState,
  isGestureEnabled,
  onToggleGestureEnabled,
  onGestureStateChange,
  className = "",
}) => {
  return (
    <div className={`flex flex-col h-full bg-[#121316] border border-[#262830] rounded-lg shadow-2xl overflow-hidden ${className}`}>
      {/* Top Header Toolbar */}
      <div className="h-10 px-4 bg-[#18191e] border-b border-[#262830] flex items-center justify-between select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-xs tracking-wider text-zinc-100 font-mono uppercase">
              Vision AI & Spatial Gesture Lab
            </span>
          </div>
          <span className="text-zinc-700">|</span>
          <span className="text-[11px] font-mono text-zinc-400">
            MediaPipe 21-Point Hand Landmarker • Exponential Moving Average Smoothing
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <button
            onClick={() => onToggleGestureEnabled(!isGestureEnabled)}
            className={`px-3 py-1 rounded text-xs font-bold border transition-all flex items-center space-x-1.5 ${
              isGestureEnabled
                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                : "bg-[#1c1d22] border-[#2d303a] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isGestureEnabled ? "GESTURE TRACKING ACTIVE" : "ACTIVATE VISION TRACKER"}</span>
          </button>
        </div>
      </div>

      {/* Main Split-View Workspace */}
      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-y-auto bg-[#0d0e11]">
        {/* Left: Interactive Camera & Skeleton View (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3 min-h-[420px]">
          <div className="flex-1 bg-[#15161b] border border-[#262830] rounded-lg p-3 flex flex-col shadow-lg overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-[#252730] mb-2 select-none">
              <div className="flex items-center space-x-2">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-zinc-200 uppercase">
                  Spatial Camera Viewport
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                60 FPS WASM Neural Pipeline
              </span>
            </div>

            <div className="flex-1 min-h-[350px] relative rounded-md overflow-hidden bg-black/50 border border-[#20222a]">
              <GestureHUD
                gestureTracker={gestureTracker}
                gestureState={gestureState}
                isEnabled={isGestureEnabled}
                onToggleEnabled={onToggleGestureEnabled}
                onGestureStateChange={onGestureStateChange}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>

        {/* Right: Live Telemetry Gauges & Interactive Gesture Guide (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Active Telemetry Panel */}
          <div className="bg-[#15161b] border border-[#262830] rounded-lg p-3 flex flex-col gap-3 shadow-lg select-none">
            <div className="flex items-center justify-between border-b border-[#252730] pb-2">
              <div className="flex items-center space-x-2">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-zinc-200 uppercase">
                  Live Modulation Telemetry
                </span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold ${
                  gestureState.leftHand.present || gestureState.rightHand.present
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {gestureState.leftHand.present || gestureState.rightHand.present ? "TRACKING LOCK" : "WAITING FOR HANDS"}
              </span>
            </div>

            {/* Left Hand: Vocals & Solo */}
            <div className="bg-[#101114] p-2.5 rounded border border-[#22242b] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-cyan-400">
                  LEFT HAND • VOCAL STEM
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {gestureState.leftHand.present ? `Y: ${Math.round(gestureState.leftHand.height * 100)}%` : "ABSENT"}
                </span>
              </div>

              {/* Height Bar */}
              <div className="w-full h-2 bg-[#20222a] rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-cyan-400 rounded-full transition-all duration-100 shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                  style={{ width: `${Math.round(gestureState.leftHand.height * 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] font-mono">
                <div
                  className={`p-1.5 rounded border text-center font-bold transition-all ${
                    gestureState.leftHand.isPinching
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                      : "bg-[#181920] text-zinc-500 border-[#262830]"
                  }`}
                >
                  PINCH (SOLO)
                </div>
                <div
                  className={`p-1.5 rounded border text-center font-bold transition-all ${
                    gestureState.leftHand.isFist
                      ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                      : "bg-[#181920] text-zinc-500 border-[#262830]"
                  }`}
                >
                  FIST (MUTE)
                </div>
              </div>
            </div>

            {/* Right Hand: Instruments & DJ Filter */}
            <div className="bg-[#101114] p-2.5 rounded border border-[#22242b] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-orange-400">
                  RIGHT HAND • INSTRUMENTS & FILTER
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {gestureState.rightHand.present ? `Y: ${Math.round(gestureState.rightHand.height * 100)}%` : "ABSENT"}
                </span>
              </div>

              <div className="w-full h-2 bg-[#20222a] rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-orange-400 rounded-full transition-all duration-100 shadow-[0_0_8px_rgba(249,115,22,0.6)]"
                  style={{ width: `${Math.round(gestureState.rightHand.height * 100)}%` }}
                />
              </div>

              <div className="bg-[#181920] p-1.5 rounded border border-[#262830] flex items-center justify-between text-[10px] font-mono">
                <span className="text-zinc-400">DJ FILTER SWEEP:</span>
                <span className="text-cyan-300 font-bold">
                  {gestureState.djFilterCutoff > 1000
                    ? `${(gestureState.djFilterCutoff / 1000).toFixed(1)} kHz`
                    : `${gestureState.djFilterCutoff} Hz`} `[${gestureState.djFilterType.toUpperCase()}]`
                </span>
              </div>
            </div>

            {/* Dual Fist Master Kill Switch Alert */}
            <div
              className={`p-2.5 rounded border flex items-center space-x-2 transition-all ${
                gestureState.isDualFist
                  ? "bg-red-600/30 border-red-500 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.6)]"
                  : "bg-[#101114] border-[#22242b] text-zinc-500"
              }`}
            >
              <AlertCircle className={`w-4 h-4 ${gestureState.isDualFist ? "text-red-400 animate-bounce" : "text-zinc-600"}`} />
              <div className="flex flex-col text-[10px] font-mono">
                <span className="font-bold uppercase">
                  {gestureState.isDualFist ? "DUAL FIST KILL SWITCH ENGAGED" : "Master Kill Switch: Standby"}
                </span>
                <span className="text-[9px] opacity-80">
                  Close both hands into fists simultaneously to instantly cut master audio.
                </span>
              </div>
            </div>
          </div>

          {/* Gesture Cheat-Sheet & Guide */}
          <div className="bg-[#15161b] border border-[#262830] rounded-lg p-3 flex flex-col gap-2 shadow-lg select-none">
            <div className="flex items-center space-x-2 border-b border-[#252730] pb-2">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-mono font-bold text-zinc-200 uppercase">
                Gesture Mapping Reference
              </span>
            </div>

            <div className="flex flex-col gap-2 text-[10px] font-mono text-zinc-400">
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1" />
                <div>
                  <strong className="text-zinc-200">Left Hand Up/Down:</strong> Raises or lowers Vocal stem volume in real-time.
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1" />
                <div>
                  <strong className="text-zinc-200">Left Hand Pinch (Thumb+Index):</strong> Instantly isolates & solos Vocals.
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1" />
                <div>
                  <strong className="text-zinc-200">Right Hand Up/Down:</strong> Raises or lowers backing instruments volume.
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1" />
                <div>
                  <strong className="text-zinc-200">Right Hand Left/Right:</strong> Sweeps DJ Low-Pass & High-Pass Biquad filter.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
