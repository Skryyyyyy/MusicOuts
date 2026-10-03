import React, { useState } from 'react';
import {
  FolderOpen,
  Plus,
  Music,
  Sliders,
  Sparkles,
  ArrowRight,
  FolderGit2,
  FolderPlus,
  Trash2,
  LogOut,
  ChevronRight,
  Disc,
  Mic,
  Activity
} from 'lucide-react';
import { UserSession } from './LoginPage';

export interface RecentProjectItem {
  id: string;
  name: string;
  folderPath: string;
  bpm: number;
  key: string;
  trackCount: number;
  duration: string;
  lastOpened: string;
  templateType: string;
}

export interface NewProjectConfig {
  name: string;
  folderPath: string;
  bpm: number;
  key: string;
  timeSignature: [number, number];
  sampleRate: number;
  template: 'empty' | 'pro-nle' | 'demucs-stems' | 'vocal-master' | 'synth-midi';
}

interface ProjectHubModalProps {
  user: UserSession;
  isOpen: boolean;
  onOpenExistingProject: (projectItem: RecentProjectItem) => void;
  onOpenFolderDirectly: (folderPath: string) => void;
  onCreateNewProject: (config: NewProjectConfig) => void;
  onSignOut: () => void;
  onClose?: () => void;
  canCloseWithoutSelection?: boolean;
}

export const ProjectHubModal: React.FC<ProjectHubModalProps> = ({
  user,
  isOpen,
  onOpenExistingProject,
  onOpenFolderDirectly,
  onCreateNewProject,
  onSignOut,
  onClose,
  canCloseWithoutSelection = false,
}) => {
  const [activeTab, setActiveTab] = useState<'open' | 'new'>('new');

  // New Project Form State
  const [projectName, setProjectName] = useState('My Studio Session');
  const [targetFolder, setTargetFolder] = useState('C:/MusicProjects/MyStudioSession');
  const [bpm, setBpm] = useState(120);
  const [keySignature, setKeySignature] = useState('C Major');
  const [timeSignature, setTimeSignature] = useState<[number, number]>([4, 4]);
  const [sampleRate, setSampleRate] = useState<number>(48000);
  const [selectedTemplate, setSelectedTemplate] = useState<
    'empty' | 'pro-nle' | 'demucs-stems' | 'vocal-master' | 'synth-midi'
  >('pro-nle');

  // Recent Projects List
  const [recentProjects, setRecentProjects] = useState<RecentProjectItem[]>([
    {
      id: 'proj-demo-1',
      name: 'Cyberpunk Synthwave Master',
      folderPath: 'C:/MusicProjects/CyberpunkSynthwave',
      bpm: 128,
      key: 'A Minor',
      trackCount: 6,
      duration: '03:42',
      lastOpened: 'Just now',
      templateType: 'pro-nle',
    },
    {
      id: 'proj-demo-2',
      name: 'Demucs Vocal & Drum Stem Split',
      folderPath: 'C:/MusicProjects/DemucsRemixLab',
      bpm: 120,
      key: 'C Major',
      trackCount: 4,
      duration: '02:18',
      lastOpened: '2 hours ago',
      templateType: 'demucs-stems',
    },
    {
      id: 'proj-demo-3',
      name: 'Acoustic Guitar & Vocal Take',
      folderPath: 'C:/MusicProjects/AcousticLiveSession',
      bpm: 95,
      key: 'G Major',
      trackCount: 5,
      duration: '04:05',
      lastOpened: 'Yesterday',
      templateType: 'vocal-master',
    },
  ]);

  if (!isOpen) return null;

  // Browser directory picker with fallback
  const handleBrowseDirectory = async (forNewProject: boolean) => {
    try {
      if ('showDirectoryPicker' in window) {
        // @ts-ignore
        const dirHandle = await window.showDirectoryPicker();
        const folderName = dirHandle.name;
        const resolvedPath = `C:/MusicProjects/${folderName}`;
        if (forNewProject) {
          setTargetFolder(resolvedPath);
        } else {
          onOpenFolderDirectly(resolvedPath);
        }
      } else {
        // Fallback for non-supported browsers
        const fallbackName = prompt('Enter or confirm your project folder directory path:', targetFolder);
        if (fallbackName) {
          if (forNewProject) {
            setTargetFolder(fallbackName);
          } else {
            onOpenFolderDirectly(fallbackName);
          }
        }
      }
    } catch (err) {
      // User cancelled picker or permission dismissed
      console.log('Directory selection closed', err);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateNewProject({
      name: projectName.trim() || 'Untitled Session',
      folderPath: targetFolder.trim() || 'C:/MusicProjects/UntitledSession',
      bpm,
      key: keySignature,
      timeSignature,
      sampleRate,
      template: selectedTemplate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in-scale">
      {/* Outer Modal Container */}
      <div className="relative w-full max-w-4xl bg-[#12141A] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Top Header with User Badge & Close Option */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center border border-white/20 shadow-md">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">MusicOuts Project Hub</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {user.tier}
                </span>
              </div>
              <p className="text-xs text-neutral-400">Select an existing folder or launch a new audio session</p>
            </div>
          </div>

          {/* User Profile Capsule & Sign Out */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10">
              <img
                src={user.avatar}
                alt={user.username}
                className="w-6 h-6 rounded-full object-cover border border-white/20"
              />
              <span className="text-xs font-semibold text-neutral-200">{user.username}</span>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              title="Sign Out"
              className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-150"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {canCloseWithoutSelection && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/10 transition-all duration-150"
              >
                Resume
              </button>
            )}
          </div>
        </div>

        {/* Tab Selection Bar */}
        <div className="flex items-center gap-2 px-6 pt-4 pb-2 border-b border-white/5 bg-black/20">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
              activeTab === 'new'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Start New Project</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('open')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
              activeTab === 'open'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Open Existing Folder / Project</span>
          </button>
        </div>

        {/* Modal Body Area */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* TAB 1: START NEW PROJECT */}
          {activeTab === 'new' && (
            <form onSubmit={handleCreateSubmit} className="space-y-6 animate-fade-in-scale">
              
              {/* Row 1: Name & Destination Folder */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Project Session Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value);
                      const slug = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                      setTargetFolder(`C:/MusicProjects/${slug || 'Session'}`);
                    }}
                    placeholder="e.g. Synthwave Anthem 2026"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-blue-500 focus:outline-none text-sm text-white placeholder-neutral-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Target Working Folder
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={targetFolder}
                      onChange={(e) => setTargetFolder(e.target.value)}
                      placeholder="C:/MusicProjects/MyProject"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-blue-500 focus:outline-none text-sm text-white placeholder-neutral-500 font-mono text-xs"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleBrowseDirectory(true)}
                      className="px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-white/10 hover:border-white/20 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 shrink-0 transition-colors"
                      title="Select Directory"
                    >
                      <FolderGit2 className="w-4 h-4 text-blue-400" />
                      <span>Browse</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Template Selection */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-2">
                  Choose Project Template
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  
                  {/* Template: Pro NLE */}
                  <div
                    onClick={() => setSelectedTemplate('pro-nle')}
                    className={`cursor-pointer p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                      selectedTemplate === 'pro-nle'
                        ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/20 text-white'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-neutral-300'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-2">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold">Pro NLE Studio</div>
                    <div className="text-[10px] text-neutral-400 mt-1">4 Synchronized tracks with EQ & Reverb</div>
                  </div>

                  {/* Template: Demucs AI Stems */}
                  <div
                    onClick={() => setSelectedTemplate('demucs-stems')}
                    className={`cursor-pointer p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                      selectedTemplate === 'demucs-stems'
                        ? 'bg-purple-600/15 border-purple-500 shadow-md shadow-purple-500/20 text-white'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-neutral-300'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-2">
                      <Disc className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold">Demucs 4-Stem</div>
                    <div className="text-[10px] text-neutral-400 mt-1">Vocals, Drums, Bass, Other routing</div>
                  </div>

                  {/* Template: Vocal Master */}
                  <div
                    onClick={() => setSelectedTemplate('vocal-master')}
                    className={`cursor-pointer p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                      selectedTemplate === 'vocal-master'
                        ? 'bg-emerald-600/15 border-emerald-500 shadow-md shadow-emerald-500/20 text-white'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-neutral-300'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold">Vocal & Podcast</div>
                    <div className="text-[10px] text-neutral-400 mt-1">Lead & Backing takes with Comping</div>
                  </div>

                  {/* Template: Synth & MIDI */}
                  <div
                    onClick={() => setSelectedTemplate('synth-midi')}
                    className={`cursor-pointer p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                      selectedTemplate === 'synth-midi'
                        ? 'bg-amber-600/15 border-amber-500 shadow-md shadow-amber-500/20 text-white'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-neutral-300'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold">Synth & MIDI</div>
                    <div className="text-[10px] text-neutral-400 mt-1">Electronic arrangement grid</div>
                  </div>

                  {/* Template: Empty */}
                  <div
                    onClick={() => setSelectedTemplate('empty')}
                    className={`cursor-pointer p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                      selectedTemplate === 'empty'
                        ? 'bg-neutral-600/25 border-neutral-400 text-white'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-neutral-300'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-neutral-700/50 text-neutral-300 flex items-center justify-center mb-2">
                      <FolderPlus className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold">Blank Slate</div>
                    <div className="text-[10px] text-neutral-400 mt-1">Single clean empty track</div>
                  </div>

                </div>
              </div>

              {/* Row 3: Audio Settings (BPM, Key, Time Sig, Sample Rate) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-black/40 border border-white/5">
                {/* BPM */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-300 mb-1.5">
                    <span>Tempo (BPM)</span>
                    <span className="font-mono text-blue-400 font-bold">{bpm} BPM</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={220}
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                {/* Key Signature */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Musical Key
                  </label>
                  <select
                    value={keySignature}
                    onChange={(e) => setKeySignature(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="C Major">C Major</option>
                    <option value="A Minor">A Minor</option>
                    <option value="G Major">G Major</option>
                    <option value="E Minor">E Minor</option>
                    <option value="D Major">D Major</option>
                    <option value="B Minor">B Minor</option>
                    <option value="F Major">F Major</option>
                    <option value="D Minor">D Minor</option>
                    <option value="F# Minor">F# Minor</option>
                  </select>
                </div>

                {/* Time Signature */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Time Signature
                  </label>
                  <select
                    value={`${timeSignature[0]}/${timeSignature[1]}`}
                    onChange={(e) => {
                      const [num, den] = e.target.value.split('/').map(Number);
                      setTimeSignature([num, den]);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="4/4">4/4 (Standard)</option>
                    <option value="3/4">3/4 (Waltz)</option>
                    <option value="6/8">6/8 (Compound)</option>
                    <option value="7/8">7/8 (Odd meter)</option>
                  </select>
                </div>

                {/* Sample Rate */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    DSP Sample Rate
                  </label>
                  <select
                    value={sampleRate}
                    onChange={(e) => setSampleRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value={44100}>44.1 kHz (CD Audio)</option>
                    <option value={48000}>48.0 kHz (Pro Film / NLE)</option>
                    <option value={96000}>96.0 kHz (Master Studio)</option>
                  </select>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-xl shadow-blue-600/30 border border-white/20 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Create Session & Launch Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </form>
          )}

          {/* TAB 2: OPEN EXISTING PROJECT OR FOLDER */}
          {activeTab === 'open' && (
            <div className="space-y-6 animate-fade-in-scale">
              
              {/* Directory Picker Action Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-purple-900/20 border border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Open Local Session Folder</h3>
                    <p className="text-xs text-neutral-400">
                      Select a folder from your disk containing audio stems or project files.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleBrowseDirectory(false)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 shrink-0 transition-all duration-150"
                >
                  <FolderGit2 className="w-4 h-4" />
                  <span>Choose Folder</span>
                </button>
              </div>

              {/* Recent Sessions List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Recent Studio Sessions
                  </h4>
                  <span className="text-[11px] text-neutral-500">{recentProjects.length} Projects found</span>
                </div>

                <div className="space-y-2.5">
                  {recentProjects.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onOpenExistingProject(item)}
                      className="group cursor-pointer p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 hover:border-blue-500/40 transition-all duration-200 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform duration-200">
                          <Music className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono mt-0.5">
                            <span className="text-[11px] text-neutral-500">{item.folderPath}</span>
                            <span>•</span>
                            <span className="text-blue-400">{item.bpm} BPM</span>
                            <span>•</span>
                            <span>{item.key}</span>
                            <span>•</span>
                            <span>{item.trackCount} Tracks</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <div className="text-xs font-semibold text-neutral-300">{item.duration}</div>
                          <div className="text-[10px] text-neutral-500">{item.lastOpened}</div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRecentProjects((prev) => prev.filter((p) => p.id !== item.id));
                          }}
                          className="p-2 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all duration-150"
                          title="Remove from recents"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-blue-600 group-hover:text-white text-neutral-400 flex items-center justify-center transition-all duration-200">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
