import {
  Sparkles,
  X,
  CheckCircle2,
  Download,
  Play,
  Clock,
} from 'lucide-react';
import { PerformanceSession } from '../types';
import { saveProjectToFile } from '../engine/projectManager';

export interface CapturePerformanceModalProps {
  session: PerformanceSession | null;
  onClose: () => void;
  onPlayTake: (session: PerformanceSession) => void;
}

export const CapturePerformanceModal: React.FC<CapturePerformanceModalProps> = ({
  session,
  onClose,
  onPlayTake,
}) => {
  if (!session) return null;

  const formatDuration = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleSave = () => {
    saveProjectToFile(session.projectSnapshot, `${session.title.replace(/\s+/g, '_')}_Take`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none font-mono">
      <div className="bg-[#14151a] border border-[#2d303b] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-14 px-6 bg-[#1a1b22] border-b border-[#282a35] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm text-zinc-100 uppercase tracking-wider">
              Performance Take Captured
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#111215] text-zinc-400 hover:text-white hover:bg-[#252834] border border-[#252834] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-5 text-zinc-300 text-xs">
          {/* Main Stats Banner */}
          <div className="bg-[#0c0d10] p-4 rounded-xl border border-[#232530] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Take Duration</div>
                <div className="text-xl font-bold text-zinc-100">{formatDuration(session.duration)}</div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Session ID</div>
              <div className="text-xs text-cyan-400 font-bold">{session.id.slice(0, 14)}</div>
            </div>
          </div>

          {/* Captured Data Checklist */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
              Live Modulations Tracked
            </div>
            <div className="flex flex-col gap-2 bg-[#0c0d10] p-3 rounded-xl border border-[#20222a]">
              <div className="flex items-center justify-between text-zinc-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Stem Mixer Faders &amp; Pan</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">Captured</span>
              </div>

              <div className="flex items-center justify-between text-zinc-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Hand Gesture Spatial Trajectories</span>
                </div>
                <span className="text-[10px] text-cyan-400 font-bold">{session.totalGestures} points</span>
              </div>

              <div className="flex items-center justify-between text-zinc-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>DJ Filter Sweeps &amp; Resonance</span>
                </div>
                <span className="text-[10px] text-purple-400 font-bold">20Hz - 20kHz</span>
              </div>

              <div className="flex items-center justify-between text-zinc-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Scene Performance Snapshots</span>
                </div>
                <span className="text-[10px] text-amber-400 font-bold">
                  {session.scenesTriggered.length > 0 ? session.scenesTriggered.join(', ') : 'Default'}
                </span>
              </div>

              <div className="flex items-center justify-between text-zinc-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>5-Insert FX Rack Parameters</span>
                </div>
                <span className="text-[10px] text-pink-400 font-bold">Synced</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-0 flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={() => onPlayTake(session)}
            className="flex-1 py-2.5 bg-[#1f212a] hover:bg-[#2b2e3b] text-cyan-300 font-bold rounded-xl border border-cyan-500/30 flex items-center justify-center space-x-2 transition-all shadow-sm"
          >
            <Play className="w-4 h-4 fill-cyan-400 text-cyan-400" />
            <span>Playback Take</span>
          </button>

          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold rounded-xl flex items-center justify-center space-x-2 transition-all shadow-lg"
          >
            <Download className="w-4 h-4" />
            <span>Save Performance</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CapturePerformanceModal;
