import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ArrowRight, ShieldCheck, Globe, Database, Key } from 'lucide-react';
import { PortalStats } from '../types/flux';

interface HeroSectionProps {
  stats: PortalStats | null;
  onExploreClick: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenGuide: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  stats,
  onExploreClick,
  onOpenAuth,
  onOpenGuide,
}) => {
  const { user } = useAuth();

  return (
    <section className="relative pt-16 pb-12 sm:pt-24 sm:pb-20 text-center overflow-hidden">
      {/* Subtle radial lighting backdrop */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-500/20 via-purple-600/20 to-transparent blur-[100px] pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Subtle aura kicker */}
        <div className="inline-flex items-center px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md mb-6">
          <span className="text-xs font-mono tracking-wider text-slate-300">
            ENCRYPTED FLUX REPOSITORY · RESTRICTED NETWORK
          </span>
        </div>

        {/* Central Master Title */}
        <h1 className="font-orbitron font-extrabold tracking-tight text-4xl sm:text-6xl lg:text-7xl mb-4">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-purple-200">
            ULTRA MEGA FLUX
          </span>
        </h1>

        {/* Tagline */}
        <p className="font-syne font-bold text-sm sm:text-base lg:text-xl tracking-[0.25em] sm:tracking-[0.35em] text-cyan-400 uppercase mb-6 glow-text-cyan">
          BEYOND THE BOUNDARIES OF REALITY.
        </p>

        {/* Descriptive overview */}
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed font-light mb-10">
          The sovereign gateway to classified cosmic datasets, neural computing architectures, and
          interstellar research conduits. Governed by cryptographic invitation protocols.
        </p>

        {/* Hero Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <button
            onClick={onExploreClick}
            className="px-6 py-3 rounded-xl font-medium text-sm text-slate-950 bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-300 hover:shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center gap-2 group cursor-pointer"
          >
            <span>Explore Nexus Links</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          {!user ? (
            <button
              onClick={() => onOpenAuth('register')}
              className="px-6 py-3 rounded-xl font-medium text-sm text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 backdrop-blur-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Key className="w-4 h-4 text-purple-400" />
              <span>Claim Invitation Key</span>
            </button>
          ) : (
            <button
              onClick={onOpenGuide}
              className="px-6 py-3 rounded-xl font-medium text-sm text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 backdrop-blur-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Member Status Active</span>
            </button>
          )}
        </div>

        {/* 4-Column Metric Strip (Conforming to frontend-design: full-width row below hero) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
          <div className="glass-panel rounded-2xl p-4 sm:p-5 text-left border border-white/10 hover:border-cyan-500/30 transition-colors">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Verified Portals</span>
            </div>
            <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
              {stats ? stats.totalLinks : 7}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Curated cosmic destinations</div>
          </div>

          <div className="glass-panel rounded-2xl p-4 sm:p-5 text-left border border-white/10 hover:border-purple-500/30 transition-colors">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span>Active Sectors</span>
            </div>
            <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
              {stats ? stats.totalCategories : 5}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Specialized domains</div>
          </div>

          <div className="glass-panel rounded-2xl p-4 sm:p-5 text-left border border-white/10 hover:border-sky-500/30 transition-colors">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Flux Dispatches</span>
            </div>
            <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
              {stats ? stats.totalClicks : 674}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Telemetric link dispatches</div>
          </div>

          <div className="glass-panel rounded-2xl p-4 sm:p-5 text-left border border-white/10 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Access Level</span>
            </div>
            <div className="font-mono text-xl sm:text-2xl font-bold text-white">
              {user ? (user.role === 'admin' ? 'ROOT' : 'MEMBER') : 'INVITE'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {user ? 'Authenticated clearance' : 'Invitation key required'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
