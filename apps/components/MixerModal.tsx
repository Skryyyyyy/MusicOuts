import React from 'react';
import { Project, Track } from '../../core/project-model/types';
import {
  X,
  Sliders,
  RotateCcw,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';

interface MixerModalProps {
  project: Project;
  meterLevels: { left: number; right: number };
  onClose: () => void;
  onUpdateTrack: (track: Track) => void;
  onUpdateMasterVolume: (vol: number) => void;
  onToggleTrackMute: (trackId: string) => void;
  onToggleTrackSolo: (trackId: string) => void;
}

export const MixerModal: React.FC<MixerModalProps> = ({
  project,
  meterLevels,
  onClose,
  onUpdateTrack,
  onUpdateMasterVolume,
  onToggleTrackMute,
  onToggleTrackSolo,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-[#10121A] border border-white/10 rounded-xl w-full max-w-6xl h-[650px] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="h-12 bg-[#171924] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/30 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-[#00E5FF]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                STUDIO AUDIO MIXER
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300 font-normal">
                  8-Channel Console
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {project.tracks.length} Track Strips • 1 Master Bus • 32-bit Float Audio Processing
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mixer Body: Channel Strips */}
        <div className="flex-1 flex overflow-x-auto p-4 gap-3 bg-[#0A0B10]">
          {/* Track Channel Strips */}
          {project.tracks.map((track, idx) => {
            const volDb =
              track.volume <= 0.001
                ? -Infinity
                : (20 * Math.log10(track.volume)).toFixed(1);

            return (
              <div
                key={track.id}
                className="w-32 bg-[#141622] border border-white/[0.08] rounded-lg p-2.5 flex flex-col shrink-0 justify-between relative overflow-hidden shadow-lg group hover:border-white/20 transition-colors"
              >
                {/* Track Header & Color Bar */}
                <div className="flex flex-col gap-1 shrink-0">
                  <div
                    className="h-1.5 w-full rounded-full"
                    style={{ backgroundColor: track.color }}
                  />
                  <div className="flex items-center justify-between text-xs font-bold text-slate-200 truncate">
                    <span className="truncate">{track.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                  </div>
                </div>

                {/* FX Inserts Slots */}
                <div className="my-2 bg-[#0C0D14] border border-white/5 rounded p-1.5 flex flex-col gap-1 shrink-0">
                  <div className="text-[9px] font-mono font-semibold text-slate-400 flex items-center justify-between">
                    <span>INSERTS</span>
                    <Layers className="w-2.5 h-2.5 text-slate-500" />
                  </div>
                  <div className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 truncate flex items-center justify-between">
                    <span>Parametric EQ</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  </div>
                  <div className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 truncate flex items-center justify-between">
                    <span>VCA Comp</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  </div>
                  <div className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5 truncate hover:bg-white/10 cursor-pointer">
                    <span>+ Add FX</span>
                  </div>
                </div>

                {/* Pan Pot */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="flex items-center justify-between w-full text-[9px] font-mono text-slate-400">
                    <span>PAN</span>
                    <span className="text-white font-bold">
                      {track.pan === 0
                        ? 'C'
                        : track.pan < 0
                        ? `L${Math.abs(Math.round(track.pan * 100))}`
                        : `R${Math.round(track.pan * 100)}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.02"
                    value={track.pan}
                    onChange={(e) =>
                      onUpdateTrack({ ...track, pan: parseFloat(e.target.value) })
                    }
                    className="w-full h-1 accent-[#00E5FF] bg-white/10 rounded cursor-pointer"
                  />
                </div>

                {/* Aux Reverb Send */}
                <div className="flex flex-col items-center gap-1 my-1 shrink-0">
                  <div className="flex items-center justify-between w-full text-[9px] font-mono text-slate-400">
                    <span>REV SEND</span>
                    <span className="text-slate-300">
                      {Math.round(track.reverbSend * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={track.reverbSend}
                    onChange={(e) =>
                      onUpdateTrack({
                        ...track,
                        reverbSend: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-1 accent-purple-400 bg-white/10 rounded cursor-pointer"
                  />
                </div>

                {/* Vertical Fader & LED Meter Section */}
                <div className="flex-1 flex items-center justify-center gap-3 py-2">
                  {/* Vertical Level Fader */}
                  <div className="h-full flex flex-col items-center justify-center">
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.01"
                      value={track.volume}
                      onChange={(e) =>
                        onUpdateTrack({
                          ...track,
                          volume: parseFloat(e.target.value),
                        })
                      }
                      style={{
                        writingMode: 'vertical-lr',
                        direction: 'rtl',
                        transform: 'rotate(180deg)',
                      }}
                      className="h-36 w-3 accent-[#00B0FF] bg-white/10 rounded cursor-pointer"
                    />
                  </div>

                  {/* Stereo LED VU Meter */}
                  <div className="h-36 w-4 bg-[#08090E] border border-white/10 rounded p-0.5 flex gap-0.5 justify-between">
                    <div className="w-1.5 h-full bg-[#12131A] rounded-sm relative overflow-hidden flex flex-col-reverse">
                      <div
                        className="w-full bg-gradient-to-t from-[#00E676] via-[#FFD600] to-[#FF1744] transition-all duration-75"
                        style={{
                          height: `${Math.min(
                            100,
                            track.isMuted
                              ? 0
                              : (meterLevels.left * 100 * track.volume +
                                  (idx % 2 ? 8 : 4))
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="w-1.5 h-full bg-[#12131A] rounded-sm relative overflow-hidden flex flex-col-reverse">
                      <div
                        className="w-full bg-gradient-to-t from-[#00E676] via-[#FFD600] to-[#FF1744] transition-all duration-75"
                        style={{
                          height: `${Math.min(
                            100,
                            track.isMuted
                              ? 0
                              : (meterLevels.right * 95 * track.volume +
                                  (idx % 2 ? 4 : 8))
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* dB Readout */}
                <div className="text-center font-mono text-[10px] text-slate-300 mb-2">
                  {volDb === -Infinity ? '-∞ dB' : `${volDb} dB`}
                </div>

                {/* Mute / Solo / Arm Controls */}
                <div className="grid grid-cols-3 gap-1 shrink-0">
                  <button
                    onClick={() => onToggleTrackMute(track.id)}
                    className={`text-[10px] font-mono font-bold py-1 rounded transition-colors ${
                      track.isMuted
                        ? 'bg-red-500 text-white font-black'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    M
                  </button>
                  <button
                    onClick={() => onToggleTrackSolo(track.id)}
                    className={`text-[10px] font-mono font-bold py-1 rounded transition-colors ${
                      track.isSoloed
                        ? 'bg-amber-400 text-black font-black'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    S
                  </button>
                  <button
                    className="text-[10px] font-mono font-bold py-1 rounded bg-white/5 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                    title="Record Arm"
                  >
                    ●
                  </button>
                </div>
              </div>
            );
          })}

          {/* Master Bus Channel Strip (Far Right) */}
          <div className="w-36 bg-[#161826] border-2 border-[#00E5FF]/40 rounded-lg p-2.5 flex flex-col shrink-0 justify-between relative shadow-2xl">
            <div className="flex flex-col gap-1 shrink-0">
              <div className="h-1.5 w-full rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>MASTER BUS</span>
                <Sparkles className="w-3 h-3 text-[#00E5FF]" />
              </div>
            </div>

            {/* Master Inserts */}
            <div className="my-2 bg-[#0A0B10] border border-white/10 rounded p-1.5 flex flex-col gap-1 shrink-0">
              <div className="text-[9px] font-mono font-semibold text-[#00E5FF] flex items-center justify-between">
                <span>MASTER FX</span>
                <Activity className="w-2.5 h-2.5" />
              </div>
              <div className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 truncate">
                Stereo Widener
              </div>
              <div className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 truncate">
                Brickwall Limiter
              </div>
            </div>

            {/* Master Volume Fader & High-Res Meter */}
            <div className="flex-1 flex items-center justify-center gap-3 py-2">
              <div className="h-full flex flex-col items-center justify-center">
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.01"
                  value={project.masterVolume}
                  onChange={(e) => onUpdateMasterVolume(parseFloat(e.target.value))}
                  style={{
                    writingMode: 'vertical-lr',
                    direction: 'rtl',
                    transform: 'rotate(180deg)',
                  }}
                  className="h-36 w-3.5 accent-[#00E5FF] bg-white/10 rounded cursor-pointer"
                />
              </div>

              {/* Master Stereo VU Meter */}
              <div className="h-36 w-5 bg-[#08090E] border border-[#00E5FF]/30 rounded p-0.5 flex gap-1 justify-between shadow-inner">
                <div className="w-2 h-full bg-[#12131A] rounded-sm relative overflow-hidden flex flex-col-reverse">
                  <div
                    className="w-full bg-gradient-to-t from-[#00E676] via-[#FFD600] to-[#FF1744] transition-all duration-75"
                    style={{
                      height: `${Math.min(
                        100,
                        meterLevels.left * 100 * project.masterVolume
                      )}%`,
                    }}
                  />
                </div>
                <div className="w-2 h-full bg-[#12131A] rounded-sm relative overflow-hidden flex flex-col-reverse">
                  <div
                    className="w-full bg-gradient-to-t from-[#00E676] via-[#FFD600] to-[#FF1744] transition-all duration-75"
                    style={{
                      height: `${Math.min(
                        100,
                        meterLevels.right * 100 * project.masterVolume
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Master dB Readout */}
            <div className="text-center font-mono text-xs font-bold text-[#00E5FF] mb-2">
              {project.masterVolume <= 0.001
                ? '-∞ dB'
                : `${(20 * Math.log10(project.masterVolume)).toFixed(1)} dB`}
            </div>

            {/* Reset / Mute Master */}
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => onUpdateMasterVolume(1.0)}
                className="flex-1 flex items-center justify-center gap-1 text-[10px] font-mono py-1 rounded bg-white/10 text-slate-300 hover:text-white hover:bg-white/20"
                title="Reset Master to 0 dB"
              >
                <RotateCcw className="w-3 h-3" />
                <span>0 dB</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
