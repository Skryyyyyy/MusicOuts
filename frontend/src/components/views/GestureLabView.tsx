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
    <div className={`flex flex-col h-full bg-[#0b0c10] rounded-2xl border border-white/[0.08] shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl overflow-hidden ${className}`}>
      {/* Top Header Toolbar - Splice Glass Capsule Header */}
      <div className="h-14 px-5 bg-gradient-to-r from-[#14161f]/95 via-[#161822]/90 to-[#14161f]/95 border-b border-white/[0.06] flex items-center justify-between select-none shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.2)]">
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xs tracking-wider text-white uppercase font-sans">
                Spatial Gesture HUD
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-mono text-cyan-300 font-bold">
                MEDIAPIPE AI
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 block -mt-0.5">
              21-Point Hand Landmarker • 60 FPS Exponential Smoothing
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <button
            onClick={() => onToggleGestureEnabled(!isGestureEnabled)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center space-x-2 shadow-sm active:scale-95 ${
              isGestureEnabled
                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(0,229,255,0.4)]"
                : "bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08]"
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isGestureEnabled ? "TRACKING ENGAGED" : "ACTIVATE CAMERA"}</span>
          </button>
        </div>
      </div>

      {/* Main Split-View Workspace */}
      <div className="flex-1 p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-y-auto bg-gradient-to-b from-[#0b0c10] to-[#08090c]">
        {/* Left: Interactive Camera & Skeleton View (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3 min-h-[420px]">
          <div className="flex-1 bg-gradient-to-b from-[#14161f]/90 to-[#101118]/90 border border-white/[0.08] rounded-2xl p-4 flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3 select-none">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                  Spatial Camera Viewport
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
                60 FPS WASM AI PIPELINE
              </span>
            </div>

            <div className="flex-1 min-h-[350px] relative rounded-xl overflow-hidden bg-black/60 border border-white/[0.06] shadow-inner">
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
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Active Telemetry Panel */}
          <div className="bg-gradient-to-b from-[#14161f]/90 to-[#101118]/90 border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl select-none">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                  Live Modulation Telemetry
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase font-bold tracking-wider ${
                  gestureState.leftHand.present || gestureState.rightHand.present
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    : "bg-white/[0.05] text-zinc-500 border border-white/[0.06]"
                }`}
              >
                {gestureState.leftHand.present || gestureState.rightHand.present ? "TRACKING LOCK" : "WAITING FOR HANDS"}
              </span>
            </div>

            {/* Left Hand: Vocals & Solo */}
            <div className="bg-[#0b0c12]/70 p-3 rounded-xl border border-white/[0.05] flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-cyan-400">
                  LEFT HAND • VOCAL STEM
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {gestureState.leftHand.present ? `HEIGHT: ${Math.round(gestureState.leftHand.height * 100)}%` : "ABSENT"}
                </span>
              </div>

              {/* Height Bar */}
              <div className="w-full h-2.5 bg-[#08090c] rounded-full overflow-hidden p-0.5 border border-white/[0.06]">
                <div
                  className="h-full bg-cyan-400 rounded-full transition-all duration-100 shadow-[0_0_10px_rgba(0,229,255,0.8)]"
                  style={{ width: `${Math.round(gestureState.leftHand.height * 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] font-mono">
                <div
                  className={`py-1.5 px-2 rounded-lg border text-center font-extrabold transition-all ${
                    gestureState.leftHand.isPinching
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                      : "bg-white/[0.03] text-zinc-500 border-white/[0.05]"
                  }`}
                >
                  PINCH (SOLO)
                </div>
                <div
                  className={`py-1.5 px-2 rounded-lg border text-center font-extrabold transition-all ${
                    gestureState.leftHand.isFist
                      ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                      : "bg-white/[0.03] text-zinc-500 border-white/[0.05]"
                  }`}
                >
                  FIST (MUTE)
                </div>
              </div>
            </div>

            {/* Right Hand: Instruments & DJ Filter */}
            <div className="bg-[#0b0c12]/70 p-3 rounded-xl border border-white/[0.05] flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-orange-400">
                  RIGHT HAND • BACKING STEMS &amp; FILTER
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {gestureState.rightHand.present ? `HEIGHT: ${Math.round(gestureState.rightHand.height * 100)}%` : "ABSENT"}
                </span>
              </div>

              <div className="w-full h-2.5 bg-[#08090c] rounded-full overflow-hidden p-0.5 border border-white/[0.06]">
                <div
                  className="h-full bg-orange-400 rounded-full transition-all duration-100 shadow-[0_0_10px_rgba(255,87,34,0.8)]"
                  style={{ width: `${Math.round(gestureState.rightHand.height * 100)}%` }}
                />
              </div>

              <div className="bg-[#0b0c12]/90 p-2 rounded-lg border border-white/[0.06] flex items-center justify-between text-[10px] font-mono">
                <span className="text-zinc-400 font-bold">DJ FILTER SWEEP:</span>
                <span className="text-cyan-300 font-extrabold">
                  {gestureState.djFilterCutoff > 1000
                    ? `${(gestureState.djFilterCutoff / 1000).toFixed(1)} kHz`
                    : `${gestureState.djFilterCutoff} Hz`} `[${gestureState.djFilterType.toUpperCase()}]`
                </span>
              </div>
            </div>

            {/* Dual Fist Master Kill Switch Alert */}
            <div
              className={`p-3 rounded-xl border flex items-center space-x-2.5 transition-all ${
                gestureState.isDualFist
                  ? "bg-red-600/30 border-red-500 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.6)]"
                  : "bg-[#0b0c12]/70 border-white/[0.05] text-zinc-400"
              }`}
            >
              <AlertCircle className={`w-4 h-4 shrink-0 ${gestureState.isDualFist ? "text-red-400 animate-bounce" : "text-zinc-500"}`} />
              <div className="flex flex-col text-[10px] font-mono">
                <span className="font-extrabold uppercase">
                  {gestureState.isDualFist ? "DUAL FIST KILL SWITCH ENGAGED" : "Master Kill Switch: Standby"}
                </span>
                <span className="text-[9px] opacity-75">
                  Close both hands into fists simultaneously to instantly cut master output.
                </span>
              </div>
            </div>
          </div>

          {/* Gesture Cheat-Sheet & Guide */}
          <div className="bg-gradient-to-b from-[#14161f]/90 to-[#101118]/90 border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl select-none">
            <div className="flex items-center space-x-2 border-b border-white/[0.06] pb-2.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                Gesture Mapping Reference
              </span>
            </div>

            <div className="flex flex-col gap-2.5 text-[10px] font-mono text-zinc-400">
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shadow-[0_0_6px_rgba(0,229,255,0.8)]" />
                <div>
                  <strong className="text-white">Left Hand Up/Down:</strong> Raises or lowers Vocal stem volume in real-time.
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
                <div>
                  <strong className="text-white">Left Hand Pinch (Thumb+Index):</strong> Instantly isolates & solos Vocals.
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shadow-[0_0_6px_rgba(255,87,34,0.8)]" />
                <div>
                  <strong className="text-white">Right Hand Up/Down:</strong> Raises or lowers backing instruments volume.
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
                <div>
                  <strong className="text-white">Right Hand Left/Right:</strong> Sweeps DJ Low-Pass & High-Pass Biquad filter.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

