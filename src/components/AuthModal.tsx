import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Lock, Key, ArrowRight, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onLoginSuccess?: () => void;
  onOpenOmegaControl?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onLoginSuccess,
  onOpenOmegaControl,
}) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Form states
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [invitationCode, setInvitationCode] = useState('');

  // Status feedback
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await login(usernameOrEmail, password);
    setIsSubmitting(false);

    if (res.success) {
      setPassword('');
      onClose();
      if (onLoginSuccess) onLoginSuccess();
    } else {
      setError(res.error || 'Authentication rejected.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await register(username, email, password, invitationCode);
    setIsSubmitting(false);

    if (res.success) {
      setPassword('');
      onClose();
      if (onLoginSuccess) onLoginSuccess();
    } else {
      setError(res.error || 'Registration failed.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#030308]/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md glass-panel-elevated rounded-3xl p-6 sm:p-8 text-white z-10 shadow-2xl overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 rounded-full" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              {mode === 'login' ? (
                <Lock className="w-4 h-4 text-cyan-400" />
              ) : (
                <Key className="w-4 h-4 text-purple-400" />
              )}
            </div>
            <div>
              <h2 id="auth-modal-title" className="font-orbitron font-bold text-base text-white tracking-wide">
                {mode === 'login' ? 'MEMBER AUTHENTICATION' : 'INVITATION REGISTRATION'}
              </h2>
              <div className="text-xs text-slate-400">
                {mode === 'login' ? 'Enter your secure credentials' : 'Invitation key is mandatory'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 bg-white/[0.04] rounded-xl border border-white/10 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Access Portal
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register with Invite
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div
            role="alert"
            className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="auth-login-identifier" className="block text-xs font-medium text-slate-300 mb-1.5">
                Username or Email
              </label>
              <input
                id="auth-login-identifier"
                type="text"
                required
                autoComplete="username"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="Enter username or email"
                className="w-full bg-white/[0.05] border border-white/15 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="auth-login-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                id="auth-login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-white/[0.05] border border-white/15 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>{isSubmitting ? 'Verifying Key...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Register Form */
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="auth-reg-invite" className="block text-xs font-medium text-slate-300 mb-1.5">
                Invitation Code <span className="text-purple-400">*required</span>
              </label>
              <input
                id="auth-reg-invite"
                type="text"
                required
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                placeholder="Enter issued invitation key"
                className="w-full font-mono uppercase bg-white/[0.05] border border-purple-500/30 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 rounded-xl px-3.5 py-2.5 text-sm text-purple-200 placeholder-slate-500 outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="auth-reg-username" className="block text-xs font-medium text-slate-300 mb-1.5">
                Chosen Username
              </label>
              <input
                id="auth-reg-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="astral_navigator"
                className="w-full bg-white/[0.05] border border-white/15 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="auth-reg-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Member Email
              </label>
              <input
                id="auth-reg-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="navigator@flux.space"
                className="w-full bg-white/[0.05] border border-white/15 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="auth-reg-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Password <span className="text-slate-500 text-[11px]">(min 6 characters)</span>
              </label>
              <input
                id="auth-reg-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-white/[0.05] border border-white/15 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-300 hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>{isSubmitting ? 'Registering...' : 'Complete Registration'}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Website Owner Access Shortcut */}
        {onOpenOmegaControl && (
          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">Website owner?</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenOmegaControl();
              }}
              className="px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-xs font-medium text-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-purple-300" />
              <span>Open Omega Control Center</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
