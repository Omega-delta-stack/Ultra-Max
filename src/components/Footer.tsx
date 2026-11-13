import React from 'react';
import { Sparkles, Shield, Key } from 'lucide-react';

interface FooterProps {
  onOpenGuide: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenGuide, onOpenAuth }) => {
  return (
    <footer className="mt-20 border-t border-white/10 bg-[#020206] py-12 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center p-[1px]">
              <div className="w-full h-full bg-[#020206] rounded-[5px] flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-cyan-300" />
              </div>
            </div>
            <div>
              <span className="font-orbitron font-bold text-sm text-white tracking-wider">
                ULTRA MEGA FLUX
              </span>
              <span className="hidden sm:inline text-slate-500 ml-2">·</span>
              <span className="hidden sm:inline text-slate-500 ml-2 font-light">
                BEYOND THE BOUNDARIES OF REALITY.
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs">
            <button
              onClick={onOpenGuide}
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5 text-purple-400" />
              <span>Security Protocols</span>
            </button>

            <button
              onClick={() => onOpenAuth('login')}
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Authentication Gateway</span>
            </button>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} ULTRA MEGA FLUX. All cosmic telemetry and repository assets protected.
          </div>
          <div className="font-mono">
            Cryptographic SHA-512 · FIPS / PBKDF2 Clearance Engine
          </div>
        </div>
      </div>
    </footer>
  );
};
