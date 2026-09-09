import React, { useState } from 'react';
import {
  Sliders,
  Eye,
  Activity,
  Upload,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { StemType, StemState, TrackMetadata, GestureState, ProcessStatus } from '../types';
import { AudioGraphEngine } from '../engine/audioGraph';
import { GestureTracker } from '../engine/gestureTracker';

import { MixerDeck } from './MixerDeck';
import { GestureHUD } from './GestureHUD';
import { VideoPlayer } from './VideoPlayer';
import { UrlUploader } from './UrlUploader';

export type InspectorTab = 'mixer' | 'vision' | 'visualizer' | 'ingestion';

export interface DawInspectorProps {
  audioGraph: AudioGraphEngine | null;
  gestureTracker: GestureTracker | null;
  trackMetadata: TrackMetadata | null;
  currentTime: number;
  isPlaying: boolean;
  stemStates: Record<StemType, StemState>;
  masterVolume: number;
  djFilterCutoff: number;
  djFilterType: 'lowpass' | 'highpass';
  djFilterQ: number;
  isGestureEnabled: boolean;
  gestureState: GestureState;
  onTrackLoaded: (track: TrackMetadata) => void;
  onStatusChange: (status: ProcessStatus) => void;
  onStemVolumeChange: (stem: StemType, val: number) => void;
  onStemMuteToggle: (stem: StemType) => void;
  onStemSoloToggle: (stem: StemType) => void;
  onStemPanChange: (stem: StemType, pan: number) => void;
  onMasterVolumeChange: (vol: number) => void;
  onDjFilterChange: (cutoff: number, type: 'lowpass' | 'highpass', q?: number) => void;
  onGestureStateChange: (state: GestureState) => void;
  onToggleGestureEnabled: (enabled: boolean) => void;
  className?: string;
}

export const DawInspector: React.FC<DawInspectorProps> = ({
  audioGraph,
  gestureTracker,
  trackMetadata,
  currentTime,
  isPlaying,
  stemStates,
  masterVolume,
  djFilterCutoff,
  djFilterType,
  djFilterQ,
  isGestureEnabled,
  gestureState,
  onTrackLoaded,
  onStatusChange,
  onStemVolumeChange,
  onStemMuteToggle,
  onStemSoloToggle,
  onStemPanChange,
  onMasterVolumeChange,
  onDjFilterChange,
  onGestureStateChange,
  onToggleGestureEnabled,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('mixer');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  return (
    <div
      className={`bg-[#141518] border border-[#262830] rounded-lg shadow-2xl flex flex-col transition-all duration-200 overflow-hidden ${
        isCollapsed ? 'h-9' : isMaximized ? 'h-[560px]' : 'h-[380px]'
      } ${className}`}
    >
      {/* Cubase Lower Zone Header & Navigation Tabs */}
      <div className="h-9 px-3 bg-[#1a1b20] border-b border-[#262830] flex items-center justify-between z-30 select-none">
        {/* Left: Cubase Zone Tab Buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => {
              setActiveTab('mixer');
              setIsCollapsed(false);
            }}
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'mixer' && !isCollapsed
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#252830]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Console Mixer</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('vision');
              setIsCollapsed(false);
            }}
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'vision' && !isCollapsed
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#252830]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Vision HUD</span>
            {isGestureEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping ml-1" />
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('visualizer');
              setIsCollapsed(false);
            }}
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'visualizer' && !isCollapsed
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#252830]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Reactive Stage</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('ingestion');
              setIsCollapsed(false);
            }}
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'ingestion' && !isCollapsed
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#252830]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Neural Ingestion</span>
          </button>
        </div>

        {/* Right: Cubase Lower Zone Actions (Collapse, Maximize) */}
        <div className="flex items-center space-x-1 text-zinc-400">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 rounded hover:bg-[#252830] hover:text-white transition-colors"
            title={isMaximized ? 'Restore Lower Zone' : 'Maximize Lower Zone'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-[#252830] hover:text-white transition-colors"
            title={isCollapsed ? 'Expand Lower Zone' : 'Collapse Lower Zone'}
          >
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Drawer Content Views */}
      {!isCollapsed && (
        <div className="flex-1 p-3 overflow-y-auto bg-[#0d0e11]">
          {activeTab === 'mixer' && (
            <MixerDeck
              audioGraph={audioGraph}
              stemStates={stemStates}
              masterVolume={masterVolume}
              djFilterCutoff={djFilterCutoff}
              djFilterType={djFilterType}
              djFilterQ={djFilterQ}
              onStemVolumeChange={onStemVolumeChange}
              onStemMuteToggle={onStemMuteToggle}
              onStemSoloToggle={onStemSoloToggle}
              onStemPanChange={onStemPanChange}
              onMasterVolumeChange={onMasterVolumeChange}
              onDjFilterChange={onDjFilterChange}
            />
          )}

          {activeTab === 'vision' && (
            <GestureHUD
              gestureTracker={gestureTracker}
              gestureState={gestureState}
              onGestureStateChange={onGestureStateChange}
              isEnabled={isGestureEnabled}
              onToggleEnabled={onToggleGestureEnabled}
            />
          )}

          {activeTab === 'visualizer' && (
            <VideoPlayer
              audioGraph={audioGraph}
              trackMetadata={trackMetadata}
              currentTime={currentTime}
              isPlaying={isPlaying}
            />
          )}

          {activeTab === 'ingestion' && (
            <UrlUploader
              onTrackLoaded={onTrackLoaded}
              onStatusChange={onStatusChange}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default DawInspector;
