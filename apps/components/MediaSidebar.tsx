import React, { useState } from 'react';
import { SourceAsset, SongSection } from '../../core/project-model/types';
import {
  Folder,
  Headphones,
  Music,
  Sliders,
  Repeat,
  Mic,
  Piano,
  Heart,
  Search,
  Plus,
  Play,
  Pause,
  Sparkles,
} from 'lucide-react';

interface MediaSidebarProps {
  sources: Record<string, SourceAsset>;
  onDragStartSample: (e: React.DragEvent, asset: SourceAsset, section?: SongSection) => void;
  onAddSampleToTimeline?: (asset: SourceAsset) => void;
  onAddSource?: (asset: SourceAsset, buffer: AudioBuffer) => void;
  onPreviewSample?: (sampleId: string) => void;
  onStopPreview?: () => void;
  onToggleCollapse?: () => void;
}

interface MediaSampleItem {
  id: string;
  name: string;
  category: 'Audio' | 'Music' | 'SFX' | 'Voice' | 'Loops' | 'Samples' | 'Recordings' | 'MIDI' | 'Plugins';
  durationStr: string;
  durationSec: number;
  bpm: number;
  key: string;
  format: string;
  color: string;
  isFavorite?: boolean;
}

export const MediaSidebar: React.FC<MediaSidebarProps> = ({
  sources,
  onDragStartSample,
  onAddSampleToTimeline,
  onAddSource,
  onPreviewSample,
  onStopPreview,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'Media' | 'Effects' | 'Instruments' | 'Samples'>('Media');
  const [activeCategory, setActiveCategory] = useState<string>('All Files');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewingSampleId, setPreviewingSampleId] = useState<string | null>(null);

  const sampleItems: MediaSampleItem[] = [
    { id: 'src-drums', name: 'Trap Drum Loop 01.wav', category: 'Loops', durationStr: '0:12', durationSec: 12, bpm: 128, key: 'F min', format: 'WAV 24b', color: '#1E88E5', isFavorite: true },
    { id: 'src-vocals', name: 'Lead Vocal Dry.wav', category: 'Voice', durationStr: '0:27', durationSec: 27, bpm: 128, key: 'C maj', format: 'WAV 32f', color: '#EC4899', isFavorite: true },
    { id: 'src-guitar', name: 'Electric Guitar Riff.wav', category: 'Audio', durationStr: '0:18', durationSec: 18, bpm: 128, key: 'A min', format: 'WAV 24b', color: '#8B5CF6' },
    { id: 'src-bass', name: '808 Sub Bassline.wav', category: 'Samples', durationStr: '0:20', durationSec: 20, bpm: 128, key: 'C maj', format: 'WAV 24b', color: '#00C853', isFavorite: true },
    { id: 'src-synth', name: 'Analog Synth Pad.wav', category: 'Audio', durationStr: '0:14', durationSec: 14, bpm: 128, key: 'G maj', format: 'WAV 24b', color: '#EAB308' },
    { id: 'src-ambient', name: 'Atmospheric Bed.wav', category: 'Music', durationStr: '0:32', durationSec: 32, bpm: 128, key: 'D min', format: 'WAV 24b', color: '#00E5FF' },
    { id: 'src-whoosh', name: 'Cinematic Whoosh.wav', category: 'SFX', durationStr: '0:06', durationSec: 6, bpm: 128, key: '-', format: 'WAV 24b', color: '#6366F1' },
    { id: 'src-impact', name: 'Sub Heavy Impact.wav', category: 'SFX', durationStr: '0:03', durationSec: 3, bpm: 128, key: '-', format: 'WAV 24b', color: '#F43F5E' },
    { id: 'src-midi-piano', name: 'Chopin Nocturne.mid', category: 'MIDI', durationStr: '1:45', durationSec: 105, bpm: 120, key: 'Eb maj', format: 'MIDI 1', color: '#A855F7' },
    { id: 'src-rec-take', name: 'Studio Mic Take 02.wav', category: 'Recordings', durationStr: '0:45', durationSec: 45, bpm: 128, key: 'C maj', format: 'WAV 32f', color: '#10B981' },
  ];

  const categories = [
    { id: 'All Files', label: 'All Files', icon: Folder },
    { id: 'Audio', label: 'Audio', icon: Headphones },
    { id: 'Music', label: 'Music', icon: Music },
    { id: 'SFX', label: 'SFX', icon: Sliders },
    { id: 'Loops', label: 'Loops', icon: Repeat },
    { id: 'Voice', label: 'Voice / Vocal', icon: Mic },
    { id: 'Samples', label: 'Samples', icon: Piano },
    { id: 'Recordings', label: 'Recordings', icon: Mic },
    { id: 'MIDI', label: 'MIDI Tracks', icon: Sparkles },
    { id: 'Favorites', label: 'Favorites', icon: Heart },
  ];

  const filteredSamples = sampleItems.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeCategory === 'All Files') return true;
    if (activeCategory === 'Favorites') return !!s.isFavorite;
    return s.category === activeCategory;
  });

  const handleTogglePreview = (sampleId: string) => {
    if (previewingSampleId === sampleId) {
      setPreviewingSampleId(null);
      if (onStopPreview) onStopPreview();
    } else {
      setPreviewingSampleId(sampleId);
      if (onPreviewSample) onPreviewSample(sampleId);
    }
  };

  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && onAddSource) {
        const audioCtx = new AudioContext();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const newAsset: SourceAsset = {
          id: `src-${Date.now()}`,
          name: file.name,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          channels: audioBuffer.numberOfChannels,
          fileSize: file.size,
          bpm: 120,
        };
        onAddSource(newAsset, audioBuffer);
      }
    };
    input.click();
  };

  return (
    <aside className="w-64 lg:w-72 bg-[#12141C] border-r border-white/[0.08] flex flex-col h-full select-none shrink-0 overflow-hidden relative">
      {/* Top Tabs (Media, Effects, Instruments, Samples) */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-2 pt-2 shrink-0 bg-[#0F1017]">
        <div className="flex items-center space-x-1">
          {(['Media', 'Effects', 'Instruments', 'Samples'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 px-1 text-xs font-medium relative transition-colors ${
                activeTab === tab ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00B0FF]" />
              )}
            </button>
          ))}
        </div>

        {/* Discrete >< Minimize Button */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="pb-2 text-slate-500 hover:text-slate-200 px-1 py-0.5 text-xs font-mono font-bold transition-colors"
            title="Minimize Media Browser (><)"
          >
            <span>{'><'}</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="p-2.5 pb-2 shrink-0">
        <div className="flex items-center bg-[#181A24] border border-white/[0.06] rounded-md px-2.5 py-1 text-xs text-slate-300">
          <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search all 9 categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-slate-400 outline-none w-full"
          />
        </div>
      </div>

      {/* Category List */}
      <div className="px-2 pb-2 shrink-0 flex flex-wrap gap-1 border-b border-white/[0.06]">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                isSelected
                  ? 'bg-white/15 text-white font-bold'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              <Icon className="w-2.5 h-2.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sample Items List with Drag Support & Audio Previews */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-[#0D0E14]">
        {filteredSamples.map((item) => {
          const isPreviewing = previewingSampleId === item.id;
          const sourceAsset: SourceAsset = sources[item.id] || {
            id: item.id,
            name: item.name,
            duration: item.durationSec,
            sampleRate: 48000,
            channels: 2,
            fileSize: 1024 * 1024,
            bpm: item.bpm,
          };

          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => onDragStartSample(e, sourceAsset)}
              className="bg-[#151722] hover:bg-[#1C1F2E] border border-white/5 hover:border-white/20 rounded-lg p-2 flex flex-col gap-1 cursor-grab active:cursor-grabbing transition-all group shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <button
                    onClick={() => handleTogglePreview(item.id)}
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                      isPreviewing
                        ? 'bg-[#00E5FF] text-black shadow-md'
                        : 'bg-white/10 text-slate-300 hover:text-white group-hover:bg-white/20'
                    }`}
                  >
                    {isPreviewing ? (
                      <Pause className="w-3 h-3 fill-current" />
                    ) : (
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    )}
                  </button>

                  <div className="overflow-hidden">
                    <span className="text-xs font-semibold text-slate-200 truncate block">
                      {item.name}
                    </span>
                    <div className="flex items-center space-x-2 text-[9px] font-mono text-slate-400">
                      <span>{item.durationStr}</span>
                      <span>•</span>
                      <span>{item.bpm} BPM</span>
                      <span>•</span>
                      <span className="text-[#00E5FF]">{item.key}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onAddSampleToTimeline && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSampleToTimeline(sourceAsset);
                      }}
                      className="px-1.5 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 hover:text-white border border-blue-500/30 text-[10px] flex items-center gap-0.5 font-bold transition-colors opacity-0 group-hover:opacity-100"
                      title="Add to active track at playhead"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Add</span>
                    </button>
                  )}
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                </div>
              </div>

              {/* Glowing Mini Waveform Strip */}
              <div className="h-4 bg-[#0A0B10] rounded px-1 flex items-center justify-between overflow-hidden relative">
                {Array.from({ length: 28 }).map((_, i) => {
                  const h = Math.sin(i * 0.4) * 50 + 40;
                  return (
                    <div
                      key={i}
                      className="w-1 rounded-full transition-all"
                      style={{
                        height: `${h}%`,
                        backgroundColor: isPreviewing ? '#00E5FF' : `${item.color}80`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer / Import Audio Button */}
      <div className="p-2 border-t border-white/[0.08] bg-[#0E0F17] shrink-0">
        <button
          onClick={handleImportFile}
          className="w-full py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span>Import Local Audio / Loop</span>
        </button>
      </div>
    </aside>
  );
};
