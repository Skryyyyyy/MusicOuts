import React, { useState, useRef, useEffect } from "react";
import { Music } from "lucide-react";
import { AudioGraphEngine } from "../engine/audioGraph";

export type SynthInstrument = "piano" | "lead" | "bass808" | "pad";

export interface VirtualSynthProps {
  audioGraph?: AudioGraphEngine | null;
  onClose?: () => void;
  className?: string;
}

const NOTES = [
  { note: "C", freq: 261.63, isBlack: false, key: "a" },
  { note: "C#", freq: 277.18, isBlack: true, key: "w" },
  { note: "D", freq: 293.66, isBlack: false, key: "s" },
  { note: "D#", freq: 311.13, isBlack: true, key: "e" },
  { note: "E", freq: 329.63, isBlack: false, key: "d" },
  { note: "F", freq: 349.23, isBlack: false, key: "f" },
  { note: "F#", freq: 369.99, isBlack: true, key: "t" },
  { note: "G", freq: 392.00, isBlack: false, key: "g" },
  { note: "G#", freq: 415.30, isBlack: true, key: "y" },
  { note: "A", freq: 440.00, isBlack: false, key: "h" },
  { note: "A#", freq: 466.16, isBlack: true, key: "u" },
  { note: "B", freq: 493.88, isBlack: false, key: "j" },
  { note: "C5", freq: 523.25, isBlack: false, key: "k" },
];

export const VirtualSynth: React.FC<VirtualSynthProps> = ({ onClose, className = "" }) => {
  const [instrument, setInstrument] = useState<SynthInstrument>("lead");
  const [octave, setOctave] = useState<number>(0);
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());

  // Web Audio Context for synthesizer
  const synthCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (synthCtxRef.current && synthCtxRef.current.state !== "closed") {
        synthCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const getSynthContext = (): AudioContext => {
    if (!synthCtxRef.current || synthCtxRef.current.state === "closed") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      synthCtxRef.current = new AudioCtx();
    }
    if (synthCtxRef.current.state === "suspended") {
      synthCtxRef.current.resume().catch(() => {});
    }
    return synthCtxRef.current;
  };

  const playNote = (baseFreq: number, noteName: string) => {
    try {
      const ctx = getSynthContext();
      const mult = Math.pow(2, octave);
      const freq = baseFreq * mult;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      const now = ctx.currentTime;

      if (instrument === "piano") {
        osc.type = "triangle";
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(2500, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.stop(now + 1.25);
      } else if (instrument === "lead") {
        osc.type = "sawtooth";
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(3500, now);
        filter.frequency.exponentialRampToValueAtTime(800, now + 0.6);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.stop(now + 0.85);
      } else if (instrument === "bass808") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq / 2, now);
        osc.frequency.exponentialRampToValueAtTime(freq / 4, now + 0.08);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(300, now);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        osc.stop(now + 1.55);
      } else if (instrument === "pad") {
        osc.type = "sawtooth";
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1200, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
        osc.stop(now + 2.1);
      }

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);

      setActiveNotes((prev) => new Set(prev).add(noteName));
      setTimeout(() => {
        setActiveNotes((prev) => {
          const next = new Set(prev);
          next.delete(noteName);
          return next;
        });
      }, 350);
    } catch (e) {
      console.warn("Synth play error:", e);
    }
  };

  return (
    <div className={`bg-[#15161b] border border-[#262830] rounded-lg p-3 flex flex-col gap-3 shadow-xl select-none ${className}`}>
      {/* Synth Toolbar */}
      <div className="flex items-center justify-between border-b border-[#252730] pb-2">
        <div className="flex items-center space-x-2">
          <Music className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold text-zinc-100 uppercase tracking-wider">
            Web Synth &amp; Live Piano Roll
          </span>
        </div>

        {/* Instrument Selector */}
        <div className="flex items-center space-x-2">
          <div className="flex bg-[#101114] p-0.5 rounded border border-[#262830]">
            {(
              [
                { id: "lead", name: "Cyber Lead" },
                { id: "piano", name: "Grand Piano" },
                { id: "bass808", name: "808 Bass" },
                { id: "pad", name: "Warm Pad" },
              ] as const
            ).map((inst) => (
              <button
                key={inst.id}
                onClick={() => setInstrument(inst.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  instrument === inst.id
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {inst.name}
              </button>
            ))}
          </div>

          {/* Octave Controls */}
          <div className="flex items-center space-x-1 bg-[#101114] px-1.5 py-0.5 rounded border border-[#262830] text-[10px] font-mono">
            <span className="text-zinc-500">OCT:</span>
            <button
              onClick={() => setOctave((o) => Math.max(-2, o - 1))}
              className="px-1 bg-[#1c1d22] text-zinc-300 rounded hover:text-white"
            >
              -
            </button>
            <span className="text-cyan-400 font-bold w-4 text-center">{octave >= 0 ? `+${octave}` : octave}</span>
            <button
              onClick={() => setOctave((o) => Math.min(2, o + 1))}
              className="px-1 bg-[#1c1d22] text-zinc-300 rounded hover:text-white"
            >
              +
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center rounded bg-[#101114] hover:bg-[#20222a] text-zinc-400 hover:text-white border border-[#262830] transition-colors text-[11px] font-bold"
              title="Close Synthesizer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Piano Keys Deck */}
      <div className="flex justify-center items-stretch h-28 bg-[#0a0a0d] p-1.5 rounded-lg border border-[#20222a] overflow-x-auto relative">
        {NOTES.map((n) => {
          const isActive = activeNotes.has(n.note);
          if (n.isBlack) {
            return (
              <button
                key={n.note}
                onClick={() => playNote(n.freq, n.note)}
                className={`w-7 h-16 -mx-3.5 z-20 rounded-b-md border transition-all flex flex-col justify-end items-center pb-1 ${
                  isActive
                    ? "bg-cyan-400 border-cyan-300 text-black shadow-[0_0_12px_rgba(6,182,212,0.8)] scale-95"
                    : "bg-[#181920] border-[#30323c] text-zinc-400 hover:bg-[#252834]"
                }`}
                title={`Play ${n.note} (Key: ${n.key.toUpperCase()})`}
              >
                <span className="text-[8px] font-mono font-bold leading-none">{n.note}</span>
                <span className="text-[7px] text-zinc-600 font-mono leading-none mt-0.5">{n.key}</span>
              </button>
            );
          }

          return (
            <button
              key={n.note}
              onClick={() => playNote(n.freq, n.note)}
              className={`w-9 h-full z-10 rounded-b-md border transition-all flex flex-col justify-end items-center pb-1 ${
                isActive
                  ? "bg-cyan-500 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.7)] scale-95"
                  : "bg-[#e4e4e7] border-zinc-400 text-zinc-800 hover:bg-white"
              }`}
              title={`Play ${n.note} (Key: ${n.key.toUpperCase()})`}
            >
              <span className="text-[9px] font-mono font-bold leading-none">{n.note}</span>
              <span className="text-[8px] text-zinc-500 font-mono leading-none mt-0.5">{n.key}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualSynth;
