import React from 'react';
import { X, Shield, Key, Lock, UserCheck, Globe, ArrowRight } from 'lucide-react';

interface AccessGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRole: (role: 'member' | 'invite') => void;
  onOpenOmegaControl?: () => void;
}

export const AccessGuideModal: React.FC<AccessGuideModalProps> = ({
  isOpen,
  onClose,
  onSelectRole,
  onOpenOmegaControl,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-guide-title"
    >
      <div className="fixed inset-0 bg-[#030308]/85 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl glass-panel-elevated rounded-3xl p-6 sm:p-8 text-white z-10 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Key className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 id="access-guide-title" className="font-orbitron font-bold text-base text-white tracking-wide">
                ACCESS PROTOCOLS &amp; SECURITY ARCHITECTURE
              </h2>
              <div className="text-xs text-slate-400">
                ULTRA MEGA FLUX Multi-Tier Clearance Matrix
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Architecture Summary */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 leading-relaxed">
            <p className="mb-3">
              <strong className="text-cyan-300">ULTRA MEGA FLUX</strong> enforces strict server-side
              role separation and cryptographic credential protection across every directory and endpoint:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
                <div className="font-semibold text-sky-300 flex items-center gap-1.5 mb-1.5">
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>Public Visitors</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Read-only access to Nexus Directory and DIGITAL LINK HUB. Visitors can search, filter, copy URLs, and open links in new tabs.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <div className="font-semibold text-cyan-300 flex items-center gap-1.5 mb-1.5">
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Private Members</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Registered via owner-issued invitation codes. View, copy, open, and bookmark links. Modification endpoints remain blocked.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="font-semibold text-purple-300 flex items-center gap-1.5 mb-1.5">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span>Omega Owner</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Protected by the owner&apos;s private admin password inside OMEGA CONTROL CENTER. Sole authority to add, edit, or delete links.
                </p>
              </div>
            </div>
          </div>

          {/* Cryptographic Guarantees */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-cyan-400" />
              Zero-Leakage Credential Policy
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-light">
              No administrator passwords or secret keys are exposed in client code. Passwords are hashed
              server-side with salted PBKDF2-SHA512, sessions are stored as SHA-256 digests in persistent
              SQLite storage, and HttpOnly cookies protect active sessions.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectRole('invite');
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-cyan-200 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 transition-colors cursor-pointer"
            >
              Register with Invitation Key
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectRole('member');
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 transition-colors cursor-pointer"
            >
              Member Sign In
            </button>

            {onOpenOmegaControl && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenOmegaControl();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-purple-400 to-cyan-300 hover:opacity-95 transition-opacity flex items-center gap-1.5 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Omega Control Center</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
