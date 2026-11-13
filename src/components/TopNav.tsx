import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, ShieldCheck, Lock, Sparkles, LogOut, Menu, X, KeyRound, ExternalLink } from 'lucide-react';

interface TopNavProps {
  onOpenAuth: (initialMode?: 'login' | 'register') => void;
  onOpenGuide: () => void;
  activeView: 'directory' | 'admin' | 'sectors' | 'digital-hub';
  setActiveView: (view: 'directory' | 'admin' | 'sectors' | 'digital-hub') => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  onOpenAuth,
  onOpenGuide,
  activeView,
  setActiveView,
}) => {
  const { user, logout, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#030308]/80 border-b border-white/10 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
        {/* Zone 1: Wordmark */}
        <button
          type="button"
          onClick={() => {
            setActiveView('directory');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="text-left flex items-center gap-2 group whitespace-nowrap shrink-0 focus:outline-none cursor-pointer"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-600 p-[1px] shadow-sm shadow-cyan-500/20 shrink-0">
            <div className="w-full h-full bg-[#030308] rounded-[7px] flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300 group-hover:rotate-12 transition-transform duration-300" />
            </div>
          </div>
          <span className="font-orbitron font-bold text-sm sm:text-lg tracking-wider text-white group-hover:text-cyan-300 transition-colors">
            ULTRA MEGA FLUX
          </span>
        </button>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-7 text-sm font-medium text-slate-300" aria-label="Primary">
          <button
            type="button"
            onClick={() => setActiveView('directory')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              activeView === 'directory'
                ? 'text-cyan-300 border-b-2 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Nexus Directory
          </button>

          <button
            type="button"
            onClick={() => setActiveView('sectors')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              activeView === 'sectors'
                ? 'text-cyan-300 border-b-2 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Flux Sectors
          </button>

          <button
            type="button"
            onClick={() => setActiveView('digital-hub')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              activeView === 'digital-hub'
                ? 'text-cyan-300 border-b-2 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Digital Link Hub
          </button>

          <button
            type="button"
            onClick={() => setActiveView('admin')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 flex items-center gap-1.5 cursor-pointer ${
              activeView === 'admin'
                ? 'text-purple-300 border-b-2 border-purple-400 font-semibold'
                : isAdmin
                  ? 'text-purple-300 hover:text-purple-200'
                  : 'text-slate-400 hover:text-purple-200'
            }`}
          >
            {isAdmin ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span>Omega Control</span>
          </button>
        </nav>

        {/* Zone 3: Auth & Session Action */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex flex-col items-end text-xs">
                <span className="font-medium text-white flex items-center gap-1.5">
                  {user.username}
                  {user.role === 'admin' && (
                    <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      OWNER
                    </span>
                  )}
                  {user.role === 'member' && (
                    <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      MEMBER
                    </span>
                  )}
                </span>
                <span className="text-slate-400 text-[11px] font-mono">
                  {user.role === 'admin' ? 'Omega Vault Unlocked' : 'Read-Only Clearance'}
                </span>
              </div>

              <button
                type="button"
                onClick={logout}
                aria-label="Disconnect Session"
                title="Disconnect Session"
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="hidden sm:inline-block px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-300 hover:opacity-95 rounded-lg shadow-sm shadow-cyan-500/30 transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                Access Portal
              </button>
            </div>
          )}

          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 sm:p-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg focus:outline-none cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/10 bg-[#070814]/95 backdrop-blur-2xl px-4 pt-3 pb-5 space-y-2">
          <button
            type="button"
            onClick={() => {
              setActiveView('directory');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-sm rounded-lg ${
              activeView === 'directory' ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-300'
            }`}
          >
            Nexus Directory
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveView('sectors');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-sm rounded-lg ${
              activeView === 'sectors' ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-300'
            }`}
          >
            Flux Sectors
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveView('digital-hub');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-sm rounded-lg ${
              activeView === 'digital-hub' ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-300'
            }`}
          >
            Digital Link Hub
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveView('admin');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-2 ${
              activeView === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'text-purple-300'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Omega Control Center</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenGuide();
              setMobileMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm text-slate-300 rounded-lg flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-400" />
              <span>Access Protocols</span>
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
          </button>
        </div>
      )}
    </header>
  );
};
