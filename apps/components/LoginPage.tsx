import React, { useState } from 'react';
import {
  Sparkles,
  Music,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck
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
  const [email, setEmail] = useState('producer@musicouts.studio');
  const [password, setPassword] = useState('••••••••••••');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleGuestLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      const guestSession: UserSession = {
        username: 'Pro Producer',
        email: 'producer@musicouts.studio',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        tier: 'PRO STUDIO',
        isLoggedIn: true,
      };
      if (rememberMe) {
        localStorage.setItem('musicouts_user_session', JSON.stringify(guestSession));
      }
      setIsLoading(false);
      onLoginSuccess(guestSession);
    }, 250);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      const session: UserSession = {
        username: email.split('@')[0] || 'Studio Master',
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
    }, 300);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0A0B0E] text-white flex items-center justify-center font-sans select-none">
      {/* Ambient background glows */}
      <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none animate-float-slow" />

      {/* Clean Centered Pro Login Card */}
      <div className="relative z-10 w-full max-w-md p-8 glass-panel rounded-3xl border border-white/10 shadow-2xl backdrop-blur-2xl animate-fade-in-scale select-text">
        
        {/* Brand Icon & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/25 border border-white/20 mb-3">
            <Music className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>MusicOuts Studio</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              PRO
            </span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">Sign in to access your digital audio workstation</p>
        </div>

        {/* 1-Click Fast Guest Launch */}
        <div className="mb-5">
          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 border border-white/20 hover:scale-[1.01] active:scale-[0.99] transition-all duration-150"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Launch Studio (1-Click Guest Pass)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="relative flex py-2 items-center mb-5">
          <div className="flex-grow border-t border-white/10"></div>
          <span className="flex-shrink mx-3 text-[10px] text-neutral-500 uppercase tracking-widest font-semibold">
            Or Studio Sign-In
          </span>
          <div className="flex-grow border-t border-white/10"></div>
        </div>

        {/* Simple Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="producer@musicouts.studio"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-blue-500 focus:outline-none text-sm text-white placeholder-neutral-500 select-text font-sans"
                required
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-blue-500 focus:outline-none text-sm text-white placeholder-neutral-500 select-text font-sans"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-black/50 border-white/20 text-blue-600 focus:ring-blue-500"
              />
              <span>Remember me</span>
            </label>
            <span className="text-neutral-500 text-[11px]">Auto-saves locally</span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold text-sm flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 transition-all duration-150"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <span>Sign In to Studio</span>
            )}
          </button>
        </form>

        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Local Engine & Web Audio DSP Sandbox</span>
        </div>

      </div>
    </div>
  );
};
