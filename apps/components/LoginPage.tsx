import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Music,
  Lock,
  Mail,
  User,
  ArrowRight,
  ShieldCheck,
  Disc,
  Sliders,
  Cpu,
  Radio,
  CheckCircle2,
  FolderGit2
} from 'lucide-react';

export interface UserSession {
  username: string;
  email: string;
  avatar: string;
  tier: 'PRO STUDIO' | 'ENTERPRISE';
  isLoggedIn: boolean;
}

interface LoginPageProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('producer@musicouts.studio');
  const [password, setPassword] = useState('••••••••••••');
  const [name, setName] = useState('Skryyy Master');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animated background audio spectrum simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const barCount = 72;
    const bars: { height: number; speed: number; phase: number }[] = Array.from({ length: barCount }, (_, i) => ({
      height: Math.random() * 80 + 20,
      speed: 0.02 + Math.random() * 0.03,
      phase: i * 0.15,
    }));

    let frame = 0;
    const render = () => {
      frame += 1;
      ctx.clearRect(0, 0, width, height);

      // Radial ambient lighting
      const gradient1 = ctx.createRadialGradient(
        width * 0.3,
        height * 0.4,
        50,
        width * 0.3,
        height * 0.4,
        Math.max(width, height) * 0.6
      );
      gradient1.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
      gradient1.addColorStop(0.5, 'rgba(124, 58, 237, 0.08)');
      gradient1.addColorStop(1, 'rgba(10, 11, 15, 0)');
      ctx.fillStyle = gradient1;
      ctx.fillRect(0, 0, width, height);

      const gradient2 = ctx.createRadialGradient(
        width * 0.75,
        height * 0.7,
        80,
        width * 0.75,
        height * 0.7,
        Math.max(width, height) * 0.5
      );
      gradient2.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
      gradient2.addColorStop(1, 'rgba(10, 11, 15, 0)');
      ctx.fillStyle = gradient2;
      ctx.fillRect(0, 0, width, height);

      // Bottom dynamic audio frequency wave
      const barWidth = width / barCount;
      for (let i = 0; i < barCount; i++) {
        const bar = bars[i];
        const h = Math.sin(frame * bar.speed + bar.phase) * 60 + bar.height;
        const x = i * barWidth;
        const y = height - h;

        const barGradient = ctx.createLinearGradient(x, y, x, height);
        barGradient.addColorStop(0, 'rgba(96, 165, 250, 0.4)');
        barGradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.25)');
        barGradient.addColorStop(1, 'rgba(30, 41, 59, 0.05)');

        ctx.fillStyle = barGradient;
        ctx.fillRect(x + 2, y, barWidth - 4, h);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  const handleGuestLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      const guestSession: UserSession = {
        username: 'Pro Guest Producer',
        email: 'guest@musicouts.studio',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        tier: 'PRO STUDIO',
        isLoggedIn: true,
      };
      if (rememberMe) {
        localStorage.setItem('musicouts_user_session', JSON.stringify(guestSession));
      }
      setIsLoading(false);
      onLoginSuccess(guestSession);
    }, 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter a valid email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    setTimeout(() => {
      const session: UserSession = {
        username: name || email.split('@')[0],
        email: email,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        tier: 'PRO STUDIO',
        isLoggedIn: true,
      };
      if (rememberMe) {
        localStorage.setItem('musicouts_user_session', JSON.stringify(session));
      }
      setIsLoading(false);
      onLoginSuccess(session);
    }, 500);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0A0B0E] text-white flex items-center justify-center font-sans">
      {/* Background Animated Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Subtle Background Radial Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none animate-float-slow" />

      {/* Main Glassmorphic Container */}
      <div className="relative z-10 w-full max-w-5xl px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fade-in-scale">
        
        {/* Left Col: Brand Presentation & AI Feature Highlights */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/25 border border-white/20">
              <Music className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight text-white">MusicOuts</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  PRO DAW v1.0
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-medium">Non-Linear Audio Workstation & Neural AI Stem Lab</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-100">
              Next-Gen Audio Production, <br />
              <span className="shimmer-text">Powered by Local Neural Models.</span>
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Experience sample-accurate 32-bit Float NLE razor slicing, Adobe Premiere-style keyframe automation, and local Meta Demucs v4 stem isolation directly in your studio.
            </p>
          </div>

          {/* AI / DAW Feature Pills */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-blue-500/30 transition-all duration-300">
              <Disc className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-neutral-200">Demucs v4 Neural Stems</div>
                <div className="text-[11px] text-neutral-400">2/4/6/8-Stem HTDemucs Isolation</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-purple-500/30 transition-all duration-300">
              <Sliders className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-neutral-200">Bézier Keyframing</div>
                <div className="text-[11px] text-neutral-400">Premiere-style curve automation</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/30 transition-all duration-300">
              <Radio className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-neutral-200">Universal Audio Streamer</div>
                <div className="text-[11px] text-neutral-400">YouTube, Spotify, Apple Ingestion</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-amber-500/30 transition-all duration-300">
              <Cpu className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-neutral-200">26-Feature ML Hub</div>
                <div className="text-[11px] text-neutral-400">Whisper STT & Basic Pitch MIDI</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-neutral-400 pt-1">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Local GPU Audio Processing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FolderGit2 className="w-4 h-4 text-blue-400" />
              <span>Native File System Working Directories</span>
            </div>
          </div>
        </div>

        {/* Right Col: Sleek Login & Fast-Pass Card */}
        <div className="lg:col-span-6">
          <div className="glass-panel p-7 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
            
            {/* Top Auth Tabs */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    authMode === 'signin'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    authMode === 'signup'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Create Studio Account
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Engine Ready</span>
              </div>
            </div>

            {/* Instant Fast Pass Guest Button */}
            <div className="mb-6">
              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-lg shadow-blue-600/25 border border-white/20 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>Instant Pro Studio Launch (1-Click Guest Pass)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-[11px] text-center text-neutral-400 mt-2">
                No sign-up required. Instant access to full multi-track NLE & Demucs stem separator.
              </p>
            </div>

            <div className="relative flex py-2 items-center mb-6">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-4 text-[11px] text-neutral-400 uppercase tracking-widest font-semibold">
                Or Continue With Credentials
              </span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            {/* Credential Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {errorMessage}
                </div>
              )}

              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Producer Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Skryyy Beats"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-blue-500 focus:outline-none text-sm text-white placeholder-neutral-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Studio Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="producer@musicouts.studio"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-blue-500 focus:outline-none text-sm text-white placeholder-neutral-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-blue-500 focus:outline-none text-sm text-white placeholder-neutral-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-black/50 border-white/20 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Remember session on this device</span>
                </label>
                <a href="#" className="text-blue-400 hover:text-blue-300 hover:underline">
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold text-sm flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 transition-all duration-200 mt-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{authMode === 'signin' ? 'Sign In to Workspace' : 'Create & Open Studio'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-neutral-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              <span>AES-256 Cloud Session & Local Storage Sandbox</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
