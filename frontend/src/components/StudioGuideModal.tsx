import { X, Sparkles, Layers, Keyboard, Hand } from "lucide-react";

export interface StudioGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudioGuideModal: React.FC<StudioGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#15161b] border border-[#2d303a] rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="h-12 px-5 bg-[#1a1b22] border-b border-[#262830] flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-sm text-zinc-100 font-mono uppercase tracking-wider">
              MusicOuts Pro Studio • Quick Guide &amp; Reference
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#121316] text-zinc-400 hover:text-white hover:bg-[#252830] border border-[#262830] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-5 text-xs font-mono text-zinc-300">
          {/* Workspaces Overview */}
          <div>
            <h4 className="text-cyan-400 font-bold mb-2 uppercase flex items-center space-x-1.5">
              <Layers className="w-4 h-4" />
              <span>5 Dedicated Studio Workspaces</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="bg-[#101114] p-2.5 rounded border border-[#22242b]">
                <strong className="text-zinc-100 flex items-center space-x-1 mb-1">
                  <span className="px-1 bg-cyan-900 text-cyan-200 rounded text-[9px]">1</span>
                  <span>Arrangement Window</span>
                </strong>
                <p className="text-[11px] text-zinc-400">
                  Multitrack timeline with 4 discrete stem lanes, live waveform displays, solo/mute/pan, and section markers (Intro, Verse, Chorus, Drop, Outro).
                </p>
              </div>

              <div className="bg-[#101114] p-2.5 rounded border border-[#22242b]">
                <strong className="text-zinc-100 flex items-center space-x-1 mb-1">
                  <span className="px-1 bg-cyan-900 text-cyan-200 rounded text-[9px]">2</span>
                  <span>MixConsole Desk</span>
                </strong>
                <p className="text-[11px] text-zinc-400">
                  Studio mixing desk with 4 long-throw dB faders, stereo peak meters, Master Buss, DJ filter sweep, and 1-click Scene snapshots.
                </p>
              </div>

              <div className="bg-[#101114] p-2.5 rounded border border-[#22242b]">
                <strong className="text-zinc-100 flex items-center space-x-1 mb-1">
                  <span className="px-1 bg-cyan-900 text-cyan-200 rounded text-[9px]">3</span>
                  <span>Vision &amp; Gesture Lab</span>
                </strong>
                <p className="text-[11px] text-zinc-400">
                  Real-time 60 FPS webcam tracking with glowing 21-point hand skeleton landmarks and dynamic audio modulation.
                </p>
              </div>

              <div className="bg-[#101114] p-2.5 rounded border border-[#22242b]">
                <strong className="text-zinc-100 flex items-center space-x-1 mb-1">
                  <span className="px-1 bg-cyan-900 text-cyan-200 rounded text-[9px]">4</span>
                  <span>Reactive Visual Stage</span>
                </strong>
                <p className="text-[11px] text-zinc-400">
                  Full-screen audio visualizer with 128-band FFT spectrum, radial orbit, oscilloscope with idle breathing, and synchronized video.
                </p>
              </div>

              <div className="bg-[#101114] p-2.5 rounded border border-[#22242b] md:col-span-2">
                <strong className="text-zinc-100 flex items-center space-x-1 mb-1">
                  <span className="px-1 bg-cyan-900 text-cyan-200 rounded text-[9px]">5</span>
                  <span>Neural Demix Lab</span>
                </strong>
                <p className="text-[11px] text-zinc-400">
                  Demucs v4 Hybrid Transformer AI separator. Ingest YouTube URLs or local audio/video files and export individual 24-bit WAV stems.
                </p>
              </div>
            </div>
          </div>

          {/* Gesture Controls Cheat Sheet */}
          <div>
            <h4 className="text-amber-400 font-bold mb-2 uppercase flex items-center space-x-1.5">
              <Hand className="w-4 h-4" />
              <span>Spatial Gesture Controls</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#101114] p-3 rounded border border-[#22242b] text-[11px]">
              <div><strong className="text-cyan-300">Left Hand Height:</strong> Vocals Stem Volume (0% - 100%)</div>
              <div><strong className="text-amber-300">Left Hand Pinch:</strong> Solo Vocals Stem</div>
              <div><strong className="text-red-400">Left Hand Fist:</strong> Mute Vocals Stem</div>
              <div><strong className="text-orange-300">Right Hand Height:</strong> Instruments / Other Volume</div>
              <div><strong className="text-purple-300">Right Hand X-Axis:</strong> DJ Lowpass &amp; Highpass Sweep</div>
              <div><strong className="text-red-400">Dual Closed Fists:</strong> Hold 350ms to Cut Master Audio</div>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div>
            <h4 className="text-purple-400 font-bold mb-2 uppercase flex items-center space-x-1.5">
              <Keyboard className="w-4 h-4" />
              <span>Keyboard Shortcuts</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-[11px]">
              <div className="bg-[#101114] p-2 rounded border border-[#22242b]"><span className="text-cyan-400 font-bold">1 - 6</span>: Switch Workspace</div>
              <div className="bg-[#101114] p-2 rounded border border-[#22242b]"><span className="text-cyan-400 font-bold">Space</span>: Play / Pause</div>
              <div className="bg-[#101114] p-2 rounded border border-[#22242b]"><span className="text-cyan-400 font-bold">Home / R</span>: Return to 0:00</div>
              <div className="bg-[#101114] p-2 rounded border border-[#22242b]"><span className="text-cyan-400 font-bold">L</span>: Toggle Loop Cycle</div>
              <div className="bg-[#101114] p-2 rounded border border-[#22242b]"><span className="text-amber-400 font-bold">Ctrl+Z</span>: Undo Action</div>
              <div className="bg-[#101114] p-2 rounded border border-[#22242b]"><span className="text-amber-400 font-bold">Ctrl+Y / Shift+Z</span>: Redo Action</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-10 px-5 bg-[#1a1b22] border-t border-[#262830] flex items-center justify-between sticky bottom-0 z-20">
          <span className="text-[10px] text-zinc-500 font-mono">MusicOuts Pro Studio v0.1.0</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded font-mono transition-all"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudioGuideModal;
