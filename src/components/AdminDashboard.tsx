import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { LinkItem, Category, InvitationCode, User, PortalStats } from '../types/flux';
import {
  DIGITAL_HUB_CATEGORY_ID,
  PLATFORM_META,
  detectPlatform,
  normalizeHubUrl,
} from '../utils/digitalHub';
import { PlatformIcon } from './DigitalLinkHub';
import {
  Shield,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Key,
  Users,
  Layers,
  Link as LinkIcon,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Lock,
  KeyRound,
  Globe,
  LogOut,
  AlertCircle,
} from 'lucide-react';

interface AdminDashboardProps {
  categories: Category[];
  links: LinkItem[];
  onRefreshData: () => Promise<void>;
  onClose: () => void;
  initialEditLink?: LinkItem | null;
  onClearInitialEdit?: () => void;
}

function validateOwnerPwdClient(password: string): string | null {
  if (password.length < 8) {
    return 'Private admin password must be at least 8 characters long.';
  }
  if (password.length > 128) {
    return 'Private admin password must be 128 characters or fewer.';
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return 'Admin password must include both letters and at least one number or symbol.';
  }
  return null;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  categories,
  links,
  onRefreshData,
  onClose,
  initialEditLink,
  onClearInitialEdit,
}) => {
  const {
    user,
    token,
    isAdmin,
    ownerConfigured,
    setupOwnerPassword,
    loginOwner,
    changeOwnerPassword,
    logout,
  } = useAuth();

  // Owner Auth Gate Form State
  const [setupUsername, setSetupUsername] = useState('omega_owner');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [gateError, setGateError] = useState<string | null>(null);
  const [isGateSubmitting, setIsGateSubmitting] = useState(false);

  // Dashboard Tabs & Filter State
  const [activeTab, setActiveTab] = useState<
    'links' | 'categories' | 'invitations' | 'members' | 'security'
  >('links');
  const [linkSectorFilter, setLinkSectorFilter] = useState<string>('all');

  // Stats, invitations, members
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [invitations, setInvitations] = useState<InvitationCode[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Link Form Modal state
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkCategoryId, setLinkCategoryId] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkTags, setLinkTags] = useState('');
  const [linkIsFeatured, setLinkIsFeatured] = useState(false);
  const [linkFormError, setLinkFormError] = useState<string | null>(null);

  // Category Form Modal state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('Cpu');
  const [categoryOrder, setCategoryOrder] = useState<number>(1);

  // Invitation Form Modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [newInviteCode, setNewInviteCode] = useState('');
  const [newInviteMaxUses, setNewInviteMaxUses] = useState(25);
  const [newInviteNote, setNewInviteNote] = useState('');

  // Owner Password Rotation Form State
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmNewPwd, setConfirmNewPwd] = useState('');
  const [isRotatingPwd, setIsRotatingPwd] = useState(false);

  // Custom Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const getAuthHeaders = useCallback(
    (withJson = false): Record<string, string> => {
      const headers: Record<string, string> = {};
      if (withJson) headers['Content-Type'] = 'application/json';
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return headers;
    },
    [token]
  );

  const fetchAdminData = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const headers = getAuthHeaders();
      const [statsRes, invRes, memRes] = await Promise.all([
        fetch('/api/admin/stats', { headers, credentials: 'include' }),
        fetch('/api/admin/invitations', { headers, credentials: 'include' }),
        fetch('/api/admin/members', { headers, credentials: 'include' }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (invRes.ok) setInvitations(await invRes.json());
      if (memRes.ok) setMembers(await memRes.json());
    } catch (err) {
      console.error('Failed to load Omega Control telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, getAuthHeaders]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Open edit modal automatically if triggered from Directory card
  useEffect(() => {
    if (isAdmin && initialEditLink) {
      setActiveTab('links');
      setEditingLink(initialEditLink);
      setLinkTitle(initialEditLink.title);
      setLinkUrl(initialEditLink.url);
      setLinkCategoryId(initialEditLink.categoryId);
      setLinkDescription(initialEditLink.description || '');
      setLinkTags(initialEditLink.tags ? initialEditLink.tags.join(', ') : '');
      setLinkIsFeatured(initialEditLink.isFeatured);
      setLinkFormError(null);
      setLinkModalOpen(true);
      if (onClearInitialEdit) onClearInitialEdit();
    }
  }, [isAdmin, initialEditLink, onClearInitialEdit]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => {
      setActionMessage((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  };

  const filteredLinks = useMemo(() => {
    if (linkSectorFilter === 'all') return links;
    return links.filter((l) => l.categoryId === linkSectorFilter);
  }, [links, linkSectorFilter]);

  const detectedHubPlatform = useMemo(
    () => (linkUrl.trim() ? detectPlatform(linkUrl) : 'website'),
    [linkUrl]
  );

  // --- OWNER AUTH GATE HANDLERS ---
  const handleSetupOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);

    const validationErr = validateOwnerPwdClient(setupPassword);
    if (validationErr) {
      setGateError(validationErr);
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setGateError('Passwords do not match.');
      return;
    }

    setIsGateSubmitting(true);
    const res = await setupOwnerPassword(setupPassword, setupUsername.trim() || undefined);
    setIsGateSubmitting(false);

    if (res.success) {
      setSetupPassword('');
      setSetupConfirmPassword('');
      showFeedback('success', 'Omega Control Center initialized and unlocked.');
      await onRefreshData();
    } else {
      setGateError(res.error || 'Failed to initialize Omega Control Center.');
    }
  };

  const handleUnlockOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);
    if (!unlockPassword) {
      setGateError('Enter your private admin password.');
      return;
    }

    setIsGateSubmitting(true);
    const res = await loginOwner(unlockPassword);
    setIsGateSubmitting(false);

    if (res.success) {
      setUnlockPassword('');
      await onRefreshData();
    } else {
      setGateError(res.error || 'Invalid private admin password.');
    }
  };

  // --- LINK CRUD ---
  const handleOpenAddLink = (presetCategoryId?: string) => {
    setEditingLink(null);
    setLinkTitle('');
    setLinkUrl('');
    setLinkCategoryId(presetCategoryId || categories[0]?.id || DIGITAL_HUB_CATEGORY_ID);
    setLinkDescription('');
    setLinkTags('');
    setLinkIsFeatured(false);
    setLinkFormError(null);
    setLinkModalOpen(true);
  };

  const handleOpenEditLink = (link: LinkItem) => {
    setEditingLink(link);
    setLinkTitle(link.title);
    setLinkUrl(link.url);
    setLinkCategoryId(link.categoryId);
    setLinkDescription(link.description || '');
    setLinkTags(link.tags ? link.tags.join(', ') : '');
    setLinkIsFeatured(link.isFeatured);
    setLinkFormError(null);
    setLinkModalOpen(true);
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkFormError(null);

    let normalizedUrl = linkUrl.trim();
    if (linkCategoryId === DIGITAL_HUB_CATEGORY_ID) {
      const check = normalizeHubUrl(normalizedUrl);
      if (!check.valid || !check.normalizedUrl) {
        setLinkFormError(check.error || 'Please enter a valid URL.');
        return;
      }
      normalizedUrl = check.normalizedUrl;
    }

    try {
      const url = editingLink ? `/api/admin/links/${editingLink.id}` : '/api/admin/links';
      const method = editingLink ? 'PUT' : 'POST';

      const parsedTags = linkTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({
          title: linkTitle,
          url: normalizedUrl,
          categoryId: linkCategoryId,
          description: linkDescription,
          tags:
            parsedTags.length > 0
              ? parsedTags
              : linkCategoryId === DIGITAL_HUB_CATEGORY_ID
                ? [PLATFORM_META[detectPlatform(normalizedUrl)].label]
                : [],
          isFeatured: linkIsFeatured,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLinkFormError(data.error || 'Operation failed');
        return;
      }

      showFeedback('success', editingLink ? 'Link updated successfully.' : 'New link published.');
      setLinkModalOpen(false);
      await onRefreshData();
      await fetchAdminData();
    } catch {
      setLinkFormError('Network error modifying link.');
    }
  };

  const handleDeleteLink = (id: string, title: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Published Link',
      message: `Are you sure you want to permanently remove "${title}" from ULTRA MEGA FLUX?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch(`/api/admin/links/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include',
          });
          if (res.ok) {
            showFeedback('success', 'Link removed from repository.');
            await onRefreshData();
            await fetchAdminData();
          } else {
            const data = await res.json();
            showFeedback('error', data.error || 'Failed to delete link');
          }
        } catch {
          showFeedback('error', 'Network error during link deletion.');
        }
      },
    });
  };

  // --- CATEGORY CRUD ---
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDescription('');
    setCategoryIcon('Cpu');
    setCategoryOrder((categories[categories.length - 1]?.order || categories.length) + 1);
    setCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryDescription(cat.description);
    setCategoryIcon(cat.icon || 'Cpu');
    setCategoryOrder(cat.order || 1);
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingCategory
        ? `/api/admin/categories/${editingCategory.id}`
        : '/api/admin/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({
          name: categoryName,
          description: categoryDescription,
          icon: categoryIcon,
          order: categoryOrder,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showFeedback('error', data.error || 'Failed to save category');
        return;
      }

      showFeedback('success', editingCategory ? 'Sector updated.' : 'New sector created.');
      setCategoryModalOpen(false);
      await onRefreshData();
      await fetchAdminData();
    } catch {
      showFeedback('error', 'Network error saving category.');
    }
  };

  const handleDeleteCategory = (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Flux Sector',
      message: `Delete sector "${name}"? Only custom sectors with 0 assigned links can be deleted.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch(`/api/admin/categories/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include',
          });
          const data = await res.json();
          if (res.ok) {
            showFeedback('success', 'Sector deleted.');
            await onRefreshData();
            await fetchAdminData();
          } else {
            showFeedback('error', data.error || 'Cannot delete category');
          }
        } catch {
          showFeedback('error', 'Network error deleting category.');
        }
      },
    });
  };

  // --- INVITATION CODES ---
  const handleGenerateCosmicCode = () => {
    const prefixes = ['FLUX', 'QUANTUM', 'COSMIC', 'NEBULA', 'NEXUS', 'OMEGA'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const rand = Math.floor(1000 + Math.random() * 9000);
    setNewInviteCode(`${prefix}-${rand}-PASS`);
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: getAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({
          code: newInviteCode,
          maxUses: newInviteMaxUses,
          note: newInviteNote,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showFeedback('error', data.error || 'Failed to create invitation code');
        return;
      }

      showFeedback('success', `Invitation code ${data.code} generated.`);
      setInviteModalOpen(false);
      setNewInviteCode('');
      setNewInviteNote('');
      await fetchAdminData();
    } catch {
      showFeedback('error', 'Network error generating code.');
    }
  };

  const handleToggleInvitation = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/invitations/${id}/toggle`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        showFeedback('success', 'Invitation status updated.');
        await fetchAdminData();
      }
    } catch {
      showFeedback('error', 'Failed to toggle invitation code.');
    }
  };

  const handleDeleteInvitation = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Revoke Invitation Key',
      message: 'Permanently remove this invitation code from the registry?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch(`/api/admin/invitations/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include',
          });
          if (res.ok) {
            showFeedback('success', 'Invitation code removed.');
            await fetchAdminData();
          }
        } catch {
          showFeedback('error', 'Failed to delete invitation.');
        }
      },
    });
  };

  // --- MEMBERS ---
  const handleToggleMember = async (userId: string, username: string) => {
    try {
      const res = await fetch(`/api/admin/members/${userId}/toggle`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        showFeedback('success', `Member "${username}" status updated.`);
        await fetchAdminData();
      } else {
        showFeedback('error', data.error || 'Cannot alter member status');
      }
    } catch {
      showFeedback('error', 'Failed to toggle member.');
    }
  };

  // --- OWNER PASSWORD ROTATION ---
  const handleRotatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateOwnerPwdClient(newPwd);
    if (err) {
      showFeedback('error', err);
      return;
    }
    if (newPwd !== confirmNewPwd) {
      showFeedback('error', 'New passwords do not match.');
      return;
    }

    setIsRotatingPwd(true);
    const res = await changeOwnerPassword(currentPwd, newPwd);
    setIsRotatingPwd(false);

    if (res.success) {
      setCurrentPwd('');
      setNewPwd('');
      setConfirmNewPwd('');
      showFeedback('success', 'Private admin password rotated successfully.');
    } else {
      showFeedback('error', res.error || 'Failed to update admin password.');
    }
  };

  // --- RENDER OWNER PASSWORD GATE IF NOT UNLOCKED AS ADMIN ---
  if (!isAdmin) {
    return (
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400" />

          <div className="flex items-start justify-between gap-4 pb-5 border-b border-white/10 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                {ownerConfigured === false ? (
                  <KeyRound className="w-5 h-5 text-cyan-300" />
                ) : (
                  <Lock className="w-5 h-5 text-purple-300" />
                )}
              </div>
              <div>
                <div className="text-[11px] font-mono tracking-widest text-purple-300 uppercase">
                  OMEGA CONTROL CENTER
                </div>
                <h1 className="font-orbitron font-bold text-xl sm:text-2xl text-white">
                  {ownerConfigured === false
                    ? 'Create Private Admin Password'
                    : 'Private Owner Authentication'}
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 cursor-pointer shrink-0"
            >
              Back
            </button>
          </div>

          {user && user.role === 'member' && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Signed in as member <strong>{user.username}</strong> (read-only). Only the website
                owner&apos;s private admin password unlocks Omega Control Center.
              </span>
            </div>
          )}

          {gateError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{gateError}</span>
            </div>
          )}

          {ownerConfigured === null ? (
            <div className="py-10 text-center text-xs font-mono text-slate-400">
              Verifying Omega Control Center vault status...
            </div>
          ) : ownerConfigured === false ? (
            <form onSubmit={handleSetupOwner} className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                Initialize your private owner vault. Choose your own private admin password — it is
                hashed server-side with PBKDF2-SHA512 and is required to add, edit, or delete links
                across <strong className="text-cyan-300">DIGITAL LINK HUB</strong> and all Cosmic Sectors.
              </p>

              <div>
                <label htmlFor="omega-setup-username" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Owner Handle <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  id="omega-setup-username"
                  type="text"
                  minLength={3}
                  maxLength={40}
                  value={setupUsername}
                  onChange={(e) => setSetupUsername(e.target.value)}
                  placeholder="omega_owner"
                  className="w-full bg-white/[0.05] border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label htmlFor="omega-setup-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Private Admin Password <span className="text-cyan-400">*</span>
                </label>
                <input
                  id="omega-setup-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  placeholder="Min 8 chars, letters + number/symbol"
                  className="w-full bg-white/[0.05] border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label htmlFor="omega-setup-confirm" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Confirm Private Admin Password <span className="text-cyan-400">*</span>
                </label>
                <input
                  id="omega-setup-confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={setupConfirmPassword}
                  onChange={(e) => setSetupConfirmPassword(e.target.value)}
                  placeholder="Re-enter your private admin password"
                  className="w-full bg-white/[0.05] border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isGateSubmitting}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-300 hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {isGateSubmitting
                    ? 'Securing Owner Vault...'
                    : 'Initialize & Unlock Omega Control Center'}
                </span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleUnlockOwner} className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                Enter your private admin password to unlock <strong className="text-purple-300">OMEGA CONTROL CENTER</strong> and manage DIGITAL LINK HUB, Cosmic Sectors, invitations, and members.
              </p>

              <div>
                <label htmlFor="omega-unlock-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Private Admin Password
                </label>
                <input
                  id="omega-unlock-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="Enter your private admin password"
                  className="w-full bg-white/[0.05] border border-white/15 focus:border-purple-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isGateSubmitting}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-300 hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Lock className="w-4 h-4" />
                <span>{isGateSubmitting ? 'Verifying Password...' : 'Unlock Omega Control Center'}</span>
              </button>
            </form>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Omega Control Center Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-purple-300 tracking-wider uppercase mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>PRIVATE OWNER DASHBOARD · AUTHENTICATED</span>
          </div>
          <h1 className="font-orbitron font-bold text-2xl sm:text-3xl text-white tracking-wide">
            OMEGA CONTROL CENTER
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              fetchAdminData();
              onRefreshData();
            }}
            className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh System Telemetry"
            aria-label="Refresh System Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={logout}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-300 hover:text-red-200 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock Vault</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-colors cursor-pointer"
          >
            Return to Nexus
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div
          role={actionMessage.type === 'error' ? 'alert' : 'status'}
          className={`mb-6 p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Telemetry Overview Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="glass-panel rounded-2xl p-4 border border-white/10">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>Published Links</span>
          </div>
          <div className="text-2xl font-mono font-bold text-white tabular-nums">
            {stats ? stats.totalLinks : links.length}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-white/10">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Flux Sectors</span>
          </div>
          <div className="text-2xl font-mono font-bold text-white tabular-nums">
            {stats ? stats.totalCategories : categories.length}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-white/10">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>Registered Members</span>
          </div>
          <div className="text-2xl font-mono font-bold text-white tabular-nums">
            {stats ? stats.totalMembers : members.length}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-white/10">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Active Invite Keys</span>
          </div>
          <div className="text-2xl font-mono font-bold text-white tabular-nums">
            {stats ? stats.activeInviteCodes : invitations.filter((i) => i.isActive).length}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-white/10 mb-6 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('links')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
            activeTab === 'links'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          <span>Links &amp; Digital Hub ({links.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
            activeTab === 'categories'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Sectors &amp; Categories ({categories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invitations')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
            activeTab === 'invitations'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Invitation Codes ({invitations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
            activeTab === 'members'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Member Registry ({members.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
            activeTab === 'security'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Owner Security</span>
        </button>
      </div>

      {/* --- TAB 1: LINKS & DIGITAL LINK HUB MANAGEMENT --- */}
      {activeTab === 'links' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <label htmlFor="omega-sector-filter" className="text-xs text-slate-400">
                Filter Sector:
              </label>
              <select
                id="omega-sector-filter"
                value={linkSectorFilter}
                onChange={(e) => setLinkSectorFilter(e.target.value)}
                className="bg-[#0a0b18] border border-white/15 focus:border-cyan-400 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
              >
                <option value="all">All Sectors ({links.length})</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({links.filter((l) => l.categoryId === cat.id).length})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenAddLink(DIGITAL_HUB_CATEGORY_ID)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-cyan-200 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Add Digital Hub Link</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddLink()}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-sky-300 hover:opacity-95 transition-opacity flex items-center gap-1.5 shadow-sm shadow-cyan-500/20 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Publish New Link</span>
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-slate-400 border-b border-white/10 font-mono uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Title &amp; Destination</th>
                    <th className="py-3 px-4">Sector</th>
                    <th className="py-3 px-4 text-right">Visits</th>
                    <th className="py-3 px-4">Featured</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLinks.map((link) => {
                    const cat = categories.find((c) => c.id === link.categoryId);
                    const isHub = link.categoryId === DIGITAL_HUB_CATEGORY_ID;
                    const platform = isHub ? detectPlatform(link.url) : null;
                    return (
                      <tr key={link.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white max-w-sm sm:max-w-md truncate">
                            {link.title}
                          </div>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-cyan-400/80 hover:text-cyan-300 flex items-center gap-1 truncate max-w-xs mt-0.5"
                          >
                            <span>{link.url}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                          <div className="flex items-center gap-2">
                            <span>{cat?.name || 'Unassigned'}</span>
                            {platform && (
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${PLATFORM_META[platform].badgeClass}`}
                              >
                                <PlatformIcon platform={platform} className="w-2.5 h-2.5" />
                                <span>{PLATFORM_META[platform].label}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          {link.clickCount || 0}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {link.isFeatured ? (
                            <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              YES
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono text-[10px]">NO</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditLink(link)}
                              aria-label={`Edit ${link.title}`}
                              className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLink(link.id, link.title)}
                              aria-label={`Delete ${link.title}`}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: SECTORS & CATEGORIES --- */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              Manage knowledge domains and directory categories. Categories with active links or core
              system repositories cannot be deleted.
            </p>
            <button
              type="button"
              onClick={handleOpenAddCategory}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-purple-400 to-indigo-300 hover:opacity-95 transition-opacity flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Sector</span>
            </button>
          </div>

          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-slate-400 border-b border-white/10 font-mono uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Order</th>
                    <th className="py-3 px-4">Sector Name</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Links Count</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {categories.map((cat) => {
                    const count = links.filter((l) => l.categoryId === cat.id).length;
                    const isProtected = count > 0 || cat.id === DIGITAL_HUB_CATEGORY_ID;
                    return (
                      <tr key={cat.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono text-purple-400">{cat.order}</td>
                        <td className="py-3 px-4 font-semibold text-white">{cat.name}</td>
                        <td className="py-3 px-4 text-slate-300 max-w-md truncate">{cat.description}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">{count}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCategory(cat)}
                              aria-label={`Edit sector ${cat.name}`}
                              className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              disabled={isProtected}
                              title={
                                cat.id === DIGITAL_HUB_CATEGORY_ID
                                  ? 'Core system repository cannot be deleted'
                                  : count > 0
                                    ? 'Cannot delete sector with links assigned'
                                    : 'Delete sector'
                              }
                              aria-label={`Delete sector ${cat.name}`}
                              className="p-1.5 text-slate-400 hover:text-red-400 disabled:opacity-30 disabled:hover:text-slate-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: INVITATION CODES --- */}
      {activeTab === 'invitations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              Generate and govern cryptographic registration keys. Member registration is closed without a verified key.
            </p>
            <button
              type="button"
              onClick={() => {
                handleGenerateCosmicCode();
                setNewInviteMaxUses(20);
                setNewInviteNote('Cosmic Sector Cohort Pass');
                setInviteModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-orange-300 hover:opacity-95 transition-opacity flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate Invitation Key</span>
            </button>
          </div>

          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-slate-400 border-b border-white/10 font-mono uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Invitation Code</th>
                    <th className="py-3 px-4">Usage Progress</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Note / Directive</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-amber-300 tracking-wider">
                        {inv.code}
                      </td>

                      <td className="py-3 px-4 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                        {inv.timesUsed} / {inv.maxUses === 0 ? '∞' : inv.maxUses}
                        <span className="text-[11px] text-slate-500 ml-1.5">
                          ({inv.maxUses > 0 ? Math.round((inv.timesUsed / inv.maxUses) * 100) : 0}%)
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {inv.isActive ? (
                          <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-red-400 font-mono text-[10px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            REVOKED
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-400">{inv.note || 'General invite'}</td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleInvitation(inv.id)}
                            title={inv.isActive ? 'Deactivate code' : 'Activate code'}
                            aria-label={`Toggle active status for code ${inv.code}`}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                          >
                            {inv.isActive ? (
                              <ToggleRight className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-slate-500" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInvitation(inv.id)}
                            title="Delete code"
                            aria-label={`Delete code ${inv.code}`}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 4: MEMBER REGISTRY --- */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Registered members hold read-only clearance. The owner can suspend or reinstate member access at any time.
          </p>

          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-slate-400 border-b border-white/10 font-mono uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Invitation Used</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Access Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {members.map((mem) => (
                    <tr key={mem.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">{mem.username}</td>
                      <td className="py-3 px-4 text-slate-300 font-mono">{mem.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded ${
                            mem.role === 'admin'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {mem.role === 'admin' ? 'OWNER' : 'MEMBER'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-amber-300/80">
                        {mem.invitationCodeUsed || 'Owner Vault'}
                      </td>
                      <td className="py-3 px-4">
                        {mem.isActive ? (
                          <span className="text-emerald-400 font-mono text-[10px]">ACTIVE</span>
                        ) : (
                          <span className="text-red-400 font-mono text-[10px]">SUSPENDED</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {mem.id !== 'usr_admin_master' && (
                          <button
                            type="button"
                            onClick={() => handleToggleMember(mem.id, mem.username)}
                            className="px-2.5 py-1 text-[11px] rounded-lg border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          >
                            {mem.isActive ? 'Suspend' : 'Reinstate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 5: OWNER SECURITY / PASSWORD ROTATION --- */}
      {activeTab === 'security' && (
        <div className="max-w-lg glass-panel rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-orbitron font-bold text-sm text-white">
                Rotate Private Admin Password
              </h2>
              <p className="text-xs text-slate-400">
                Updates your Omega Control Center password and revokes other active owner sessions.
              </p>
            </div>
          </div>

          <form onSubmit={handleRotatePassword} className="space-y-4">
            <div>
              <label htmlFor="omega-curr-pwd" className="block text-xs font-medium text-slate-300 mb-1">
                Current Admin Password
              </label>
              <input
                id="omega-curr-pwd"
                type="password"
                required
                autoComplete="current-password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/15 focus:border-purple-400 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
              />
            </div>

            <div>
              <label htmlFor="omega-new-pwd" className="block text-xs font-medium text-slate-300 mb-1">
                New Private Admin Password
              </label>
              <input
                id="omega-new-pwd"
                type="password"
                required
                autoComplete="new-password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Min 8 chars, letters + number/symbol"
                className="w-full bg-white/[0.05] border border-white/15 focus:border-purple-400 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
              />
            </div>

            <div>
              <label htmlFor="omega-confirm-new-pwd" className="block text-xs font-medium text-slate-300 mb-1">
                Confirm New Password
              </label>
              <input
                id="omega-confirm-new-pwd"
                type="password"
                required
                autoComplete="new-password"
                value={confirmNewPwd}
                onChange={(e) => setConfirmNewPwd(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/15 focus:border-purple-400 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isRotatingPwd}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-purple-400 to-cyan-300 hover:opacity-95 disabled:opacity-50 cursor-pointer"
            >
              {isRotatingPwd ? 'Updating Password...' : 'Update Private Admin Password'}
            </button>
          </form>
        </div>
      )}

      {/* --- MODAL: ADD / EDIT LINK --- */}
      {linkModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="omega-link-modal-title"
        >
          <div className="fixed inset-0 bg-[#030308]/85 backdrop-blur-md" onClick={() => setLinkModalOpen(false)} />
          <div className="relative w-full max-w-lg glass-panel-elevated rounded-3xl p-6 sm:p-8 text-white z-10 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <h3 id="omega-link-modal-title" className="font-orbitron font-bold text-base text-white">
                {editingLink ? 'EDIT PUBLISHED LINK' : 'PUBLISH NEW LINK'}
              </h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setLinkModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {linkFormError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{linkFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveLink} className="space-y-4">
              <div>
                <label htmlFor="omega-link-category" className="block text-xs font-medium text-slate-300 mb-1">
                  Sector / Category
                </label>
                <select
                  id="omega-link-category"
                  value={linkCategoryId}
                  onChange={(e) => setLinkCategoryId(e.target.value)}
                  className="w-full bg-[#0a0b18] border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="omega-link-url" className="block text-xs font-medium text-slate-300">
                    Destination URL
                  </label>
                  {linkCategoryId === DIGITAL_HUB_CATEGORY_ID && (
                    <span
                      className={`text-[11px] font-mono flex items-center gap-1 ${PLATFORM_META[detectedHubPlatform].accentTextClass}`}
                    >
                      <PlatformIcon platform={detectedHubPlatform} className="w-3 h-3" />
                      <span>{PLATFORM_META[detectedHubPlatform].label}</span>
                    </span>
                  )}
                </div>
                <input
                  id="omega-link-url"
                  type="text"
                  inputMode="url"
                  required
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder={
                    linkCategoryId === DIGITAL_HUB_CATEGORY_ID
                      ? 'https://instagram.com/..., https://t.me/..., https://youtube.com/...'
                      : 'https://...'
                  }
                  className="w-full bg-white/[0.05] border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-sm text-white font-mono outline-none"
                />
              </div>

              <div>
                <label htmlFor="omega-link-title" className="block text-xs font-medium text-slate-300 mb-1">
                  Custom Title
                </label>
                <input
                  id="omega-link-title"
                  type="text"
                  required
                  maxLength={200}
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="e.g. Official Channel or Research Portal"
                  className="w-full bg-white/[0.05] border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label htmlFor="omega-link-desc" className="block text-xs font-medium text-slate-300 mb-1">
                  Description <span className="text-slate-500">(Optional)</span>
                </label>
                <textarea
                  id="omega-link-desc"
                  rows={3}
                  maxLength={1000}
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                  placeholder="Summary of destination or social channel..."
                  className="w-full bg-white/[0.05] border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label htmlFor="omega-link-tags" className="block text-xs font-medium text-slate-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  id="omega-link-tags"
                  type="text"
                  value={linkTags}
                  onChange={(e) => setLinkTags(e.target.value)}
                  placeholder={
                    linkCategoryId === DIGITAL_HUB_CATEGORY_ID
                      ? 'Auto-detected if blank (e.g. YouTube, Social)'
                      : 'Astrophysics, NASA, Qubits'
                  }
                  className="w-full bg-white/[0.05] border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="featuredCheckbox"
                  checked={linkIsFeatured}
                  onChange={(e) => setLinkIsFeatured(e.target.checked)}
                  className="rounded bg-white/10 border-white/20 text-cyan-400 focus:ring-0"
                />
                <label htmlFor="featuredCheckbox" className="text-xs text-slate-300 cursor-pointer">
                  Feature in prominent portal highlight list
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-sky-300 hover:opacity-95 cursor-pointer"
                >
                  {editingLink ? 'Save Changes' : 'Publish Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD / EDIT CATEGORY --- */}
      {categoryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-[#030308]/85 backdrop-blur-md"
            onClick={() => setCategoryModalOpen(false)}
          />
          <div className="relative w-full max-w-md glass-panel-elevated rounded-3xl p-6 sm:p-8 text-white z-10 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <h3 className="font-orbitron font-bold text-base text-white">
                {editingCategory ? 'EDIT FLUX SECTOR' : 'CREATE FLUX SECTOR'}
              </h3>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Sector Name</label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Synthetic Biology"
                  className="w-full bg-white/[0.05] border border-white/15 focus:border-purple-400 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Icon</label>
                  <select
                    value={categoryIcon}
                    onChange={(e) => setCategoryIcon(e.target.value)}
                    className="w-full bg-[#0a0b18] border border-white/15 focus:border-purple-400 rounded-xl px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="Cpu">Cpu</option>
                    <option value="Telescope">Telescope</option>
                    <option value="Dna">Dna</option>
                    <option value="Shield">Shield</option>
                    <option value="Atom">Atom</option>
                    <option value="Globe">Globe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Order</label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={categoryOrder}
                    onChange={(e) => setCategoryOrder(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-white/[0.05] border border-white/15 focus:border-purple-400 rounded-xl px-3 py-2 text-sm text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  placeholder="Sector purpose and taxonomy scope..."
                  className="w-full bg-white/[0.05] border border-white/15 focus:border-purple-400 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-purple-400 to-indigo-300 hover:opacity-95 cursor-pointer"
                >
                  {editingCategory ? 'Save Sector' : 'Create Sector'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: GENERATE INVITATION CODE --- */}
      {inviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-[#030308]/85 backdrop-blur-md"
            onClick={() => setInviteModalOpen(false)}
          />
          <div className="relative w-full max-w-md glass-panel-elevated rounded-3xl p-6 sm:p-8 text-white z-10 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <h3 className="font-orbitron font-bold text-base text-white">GENERATE INVITATION KEY</h3>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvitation} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">Invitation Key</label>
                  <button
                    type="button"
                    onClick={handleGenerateCosmicCode}
                    className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                  >
                    Randomize Key
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newInviteCode}
                  onChange={(e) => setNewInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. FLUX-VIP-2026"
                  className="w-full font-mono uppercase bg-white/[0.05] border border-amber-500/30 focus:border-amber-400 rounded-xl px-3.5 py-2 text-sm text-amber-300 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Max Allowable Uses <span className="text-slate-500">(0 = unlimited)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  required
                  value={newInviteMaxUses}
                  onChange={(e) => setNewInviteMaxUses(parseInt(e.target.value, 10) || 0)}
                  className="w-full font-mono bg-white/[0.05] border border-white/15 focus:border-amber-400 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Admin Directive Note</label>
                <input
                  type="text"
                  value={newInviteNote}
                  onChange={(e) => setNewInviteNote(e.target.value)}
                  placeholder="e.g. Research Partner Cohort Alpha"
                  className="w-full bg-white/[0.05] border border-white/15 focus:border-amber-400 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-orange-300 hover:opacity-95 cursor-pointer"
                >
                  Issue Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CONFIRMATION MODAL --- */}
      {confirmDialog && confirmDialog.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-[#030308]/85 backdrop-blur-md"
            onClick={() => setConfirmDialog(null)}
          />
          <div className="relative w-full max-w-sm glass-panel-elevated rounded-3xl p-6 text-white z-10 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-orbitron font-bold text-sm text-white">
                {confirmDialog.title}
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6 font-light">
              {confirmDialog.message}
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-sm cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
