import React, { useState } from 'react';
import {
  X,
  Pencil,
  Eraser,
  Sparkles,
  Piano,
  RotateCcw,
} from 'lucide-react';

interface MidiNote {
  id: string;
  pitch: number; // 0-127 (60 = Middle C / C4)
  startTime: number; // 16th notes
  duration: number; // 16th notes
  velocity: number; // 0-127
}

interface PianoRollModalProps {
  trackName: string;
  audioCtx: AudioContext;
  onClose: () => void;
}

export const PianoRollModal: React.FC<PianoRollModalProps> = ({
  trackName,
  audioCtx,
  onClose,
}) => {
  const [activeTool, setActiveTool] = useState<'draw' | 'erase' | 'select'>('draw');
  const [quantizeSnap, setQuantizeSnap] = useState<'1/16' | '1/8' | '1/4'>('1/16');

  // Initial demo notes (C Major 7 Chord & melody)
  const [notes, setNotes] = useState<MidiNote[]>([
    { id: 'n-1', pitch: 60, startTime: 0, duration: 4, velocity: 100 }, // C4
    { id: 'n-2', pitch: 64, startTime: 0, duration: 4, velocity: 95 },  // E4
    { id: 'n-3', pitch: 67, startTime: 0, duration: 4, velocity: 90 },  // G4
    { id: 'n-4', pitch: 71, startTime: 0, duration: 4, velocity: 85 },  // B4
    { id: 'n-5', pitch: 72, startTime: 4, duration: 2, velocity: 110 }, // C5
    { id: 'n-6', pitch: 74, startTime: 6, duration: 2, velocity: 105 }, // D5
    { id: 'n-7', pitch: 76, startTime: 8, duration: 4, velocity: 115 }, // E5
    { id: 'n-8', pitch: 72, startTime: 12, duration: 4, velocity: 100 },// C5
    { id: 'n-9', pitch: 69, startTime: 16, duration: 4, velocity: 90 }, // A4
    { id: 'n-10', pitch: 67, startTime: 20, duration: 4, velocity: 95 },// G4
    { id: 'n-11', pitch: 65, startTime: 24, duration: 4, velocity: 85 },// F4
    { id: 'n-12', pitch: 60, startTime: 28, duration: 4, velocity: 100 },// C4
  ]);

  const numSteps = 32; // 2 bars of 16th notes
  const minPitch = 48; // C3
  const maxPitch = 79; // G5
  const pitches: number[] = [];
  for (let p = maxPitch; p >= minPitch; p--) {
    pitches.push(p);
  }

  const pitchNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const getPitchLabel = (pitch: number) => {
    const octave = Math.floor(pitch / 12) - 1;
    const name = pitchNames[pitch % 12];
    return `${name}${octave}`;
  };

  const isBlackKey = (pitch: number) => {
    const n = pitch % 12;
    return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
  };

  // Play audio synth note on Web Audio API
  const playSynthNote = (pitch: number, durationSec = 0.3) => {
    try {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const freq = 440 * Math.pow(2, (pitch - 69) / 12);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationSec);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + durationSec);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGridClick = (pitch: number, step: number) => {
    playSynthNote(pitch, 0.25);

    if (activeTool === 'erase') {
      setNotes(notes.filter((n) => !(n.pitch === pitch && step >= n.startTime && step < n.startTime + n.duration)));
      return;
    }

    const existingIndex = notes.findIndex(
      (n) => n.pitch === pitch && step >= n.startTime && step < n.startTime + n.duration
    );

    if (existingIndex >= 0) {
      setNotes(notes.filter((_, idx) => idx !== existingIndex));
    } else {
      const snapLen = quantizeSnap === '1/4' ? 4 : quantizeSnap === '1/8' ? 2 : 1;
      const newNote: MidiNote = {
        id: `note-${Date.now()}-${pitch}-${step}`,
        pitch,
        startTime: step,
        duration: snapLen,
        velocity: 100,
      };
      setNotes([...notes, newNote]);
    }
  };

  const handleQuantize = () => {
    const snap = quantizeSnap === '1/4' ? 4 : quantizeSnap === '1/8' ? 2 : 1;
    setNotes(
      notes.map((n) => ({
        ...n,
        startTime: Math.round(n.startTime / snap) * snap,
        duration: Math.max(snap, Math.round(n.duration / snap) * snap),
      }))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-[#10121A] border border-white/10 rounded-xl w-full max-w-6xl h-[650px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-12 bg-[#171924] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <Piano className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                MIDI PIANO ROLL
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {trackName}
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                88-Key Grid • Real-time Polyphonic Synthesizer Engine
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Tool Selection */}
            <div className="flex bg-[#0C0D14] border border-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTool('draw')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 ${
                  activeTool === 'draw'
                    ? 'bg-[#00E5FF] text-black font-semibold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Draw Note (P)"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Draw</span>
              </button>
              <button
                onClick={() => setActiveTool('erase')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 ${
                  activeTool === 'erase'
                    ? 'bg-pink-500 text-white font-semibold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Eraser (E)"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Erase</span>
              </button>
            </div>

            {/* Snap & Quantize */}
            <div className="flex items-center space-x-2 bg-[#0C0D14] border border-white/10 px-2 py-1 rounded-lg">
              <span className="text-[10px] font-mono text-slate-400">Snap:</span>
              {(['1/16', '1/8', '1/4'] as const).map((snap) => (
                <button
                  key={snap}
                  onClick={() => setQuantizeSnap(snap)}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                    quantizeSnap === snap
                      ? 'bg-white/20 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {snap}
                </button>
              ))}
              <button
                onClick={handleQuantize}
                className="ml-2 px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-medium hover:bg-indigo-500/30 flex items-center gap-1"
              >
                <Sparkles className="w-2.5 h-2.5" />
                Quantize
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

        {/* Piano Roll Grid & Keyboard */}
        <div className="flex-1 flex overflow-hidden bg-[#07080C]">
          {/* Left Piano Keyboard Keys (Fixed) */}
          <div className="w-16 bg-[#111218] border-r border-white/10 overflow-y-auto shrink-0 flex flex-col pt-6 select-none scrollbar-none">
            {pitches.map((pitch) => {
              const isBlack = isBlackKey(pitch);
              const label = getPitchLabel(pitch);
              return (
                <button
                  key={pitch}
                  onClick={() => playSynthNote(pitch, 0.4)}
                  className={`h-5 border-b text-[9px] font-mono text-right pr-2 flex items-center justify-end transition-colors ${
                    isBlack
                      ? 'bg-[#1C1E2A] text-slate-300 border-black/40 hover:bg-[#2A2C3E]'
                      : 'bg-[#EDEDED] text-black font-bold border-black/20 hover:bg-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Right Scrollable Grid */}
          <div className="flex-1 overflow-auto relative">
            <div className="min-w-[800px] flex flex-col pt-6">
              {/* Top Measure Ruler */}
              <div className="h-6 bg-[#141620] border-b border-white/10 sticky top-0 z-20 flex">
                {Array.from({ length: 8 }).map((_, barIdx) => (
                  <div
                    key={barIdx}
                    className="w-28 border-r border-white/20 px-2 text-[10px] font-mono text-slate-400 flex items-center"
                  >
                    Bar {barIdx + 1}
                  </div>
                ))}
              </div>

              {/* Matrix Rows */}
              {pitches.map((pitch) => {
                const isBlack = isBlackKey(pitch);
                return (
                  <div
                    key={pitch}
                    className={`h-5 border-b flex relative ${
                      isBlack
                        ? 'bg-[#0B0C12] border-white/[0.03]'
                        : 'bg-[#10121A] border-white/[0.05]'
                    }`}
                  >
                    {/* Grid Columns (16th notes) */}
                    {Array.from({ length: numSteps }).map((_, step) => {
                      const isBarStart = step % 4 === 0;
                      return (
                        <div
                          key={step}
                          onClick={() => handleGridClick(pitch, step)}
                          className={`w-7 h-full border-r cursor-pointer hover:bg-white/10 transition-colors ${
                            isBarStart ? 'border-white/15' : 'border-white/[0.04]'
                          }`}
                        />
                      );
                    })}

                    {/* Active Notes in this row */}
                    {notes
                      .filter((n) => n.pitch === pitch)
                      .map((note) => {
                        const noteLeft = note.startTime * 28;
                        const noteWidth = note.duration * 28;

                        return (
                          <div
                            key={note.id}
                            className="absolute top-0.5 bottom-0.5 rounded bg-gradient-to-r from-[#00E5FF] to-[#00B0FF] border border-white/40 shadow-md flex items-center px-1 text-[9px] font-bold text-black truncate z-10"
                            style={{
                              left: `${noteLeft}px`,
                              width: `${Math.max(26, noteWidth)}px`,
                            }}
                          >
                            {getPitchLabel(note.pitch)}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Velocity Lane & Bottom Bar */}
        <div className="h-16 bg-[#12141D] border-t border-white/[0.08] px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono text-slate-400">Total Notes: {notes.length}</span>
            <button
              onClick={() => setNotes([])}
              className="text-xs font-mono text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Clear All
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90 text-white font-bold text-xs rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
            >
              Save MIDI Pattern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
