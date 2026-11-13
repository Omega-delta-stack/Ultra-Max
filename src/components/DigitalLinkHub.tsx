import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ExternalLink,
  Copy,
  Check,
  Search,
  X,
  Globe,
  Compass,
  Lock,
  Shield,
} from 'lucide-react';
import { LinkItem } from '../types/flux';
import { useAuth } from '../context/AuthContext';
import {
  SocialPlatform,
  PLATFORM_META,
  PLATFORM_ORDER,
  HubSortOrder,
  detectPlatform,
  extractHostname,
  filterAndSortHubLinks,
} from '../utils/digitalHub';

interface DigitalLinkHubProps {
  links: LinkItem[];
  onRecordClick: (linkId: string) => void;
  onOpenControlCenter?: () => void;
}

export const PlatformIcon: React.FC<{ platform: SocialPlatform; className?: string }> = ({
  platform,
  className = 'w-4 h-4',
}) => {
  switch (platform) {
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      );
    case 'telegram':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
          <path d="m10 15 5-3-5-3v6Z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
        </svg>
      );
    default:
      return <Globe className={className} aria-hidden="true" />;
  }
};

export const DigitalLinkHub: React.FC<DigitalLinkHubProps> = ({
  links,
  onRecordClick,
  onOpenControlCenter,
}) => {
  const { isAdmin } = useAuth();

  // Filter / Organize State (Public Read-Only)
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<HubSortOrder>('newest');

  // Card Copy Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const platformCounts = useMemo(() => {
    const counts: Record<SocialPlatform, number> = {
      instagram: 0,
      telegram: 0,
      facebook: 0,
      youtube: 0,
      tiktok: 0,
      website: 0,
    };
    for (const link of links) {
      const p = detectPlatform(link.url);
      counts[p] += 1;
    }
    return counts;
  }, [links]);

  const totalVisits = useMemo(
    () => links.reduce((sum, l) => sum + (l.clickCount || 0), 0),
    [links]
  );

  const visibleLinks = useMemo(
    () =>
      filterAndSortHubLinks(links, {
        platform: platformFilter,
        search: searchQuery,
        sortBy,
      }),
    [links, platformFilter, searchQuery, sortBy]
  );

  const handleCopyUrl = async (link: LinkItem) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId((curr) => (curr === link.id ? null : curr)), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <section
      id="digital-link-hub"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8"
      >
        <div>
          <div className="text-xs font-mono tracking-widest text-cyan-400 uppercase mb-1.5">
            CATEGORY · PUBLIC READ-ONLY DIRECTORY
          </div>
          <h1 className="font-orbitron font-extrabold text-3xl sm:text-4xl tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-purple-200">
              DIGITAL LINK HUB
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-2 font-light max-w-2xl">
            Universal Social &amp; Web Link Repository. Browse, search, copy, and open curated links
            across Instagram, Telegram, Facebook, YouTube, TikTok, and external websites.
          </p>
        </div>

        {/* Summary metrics + Owner shortcut (Admin only) */}
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <div className="flex items-center gap-6 px-4 py-3 rounded-2xl glass-panel border border-white/10 shrink-0">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Published Links
              </div>
              <div className="font-mono tabular-nums text-xl font-bold text-white">
                {links.length}
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" aria-hidden="true" />
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Total Visits
              </div>
              <div className="font-mono tabular-nums text-xl font-bold text-cyan-300">
                {totalVisits}
              </div>
            </div>
          </div>

          {isAdmin && onOpenControlCenter && (
            <button
              type="button"
              onClick={onOpenControlCenter}
              className="px-4 py-3 rounded-2xl text-xs font-semibold text-purple-200 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/35 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Shield className="w-4 h-4 text-purple-300" />
              <span>Manage in Omega Control Center</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Public Read-Only Status Notice */}
      <div className="mb-8 px-4 py-3 rounded-2xl glass-panel border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            <strong className="text-white">Public Read-Only Repository:</strong> Visitors can view,
            copy, and open published social &amp; web links. Only the website owner can publish or
            modify links via <span className="text-purple-300 font-medium">OMEGA CONTROL CENTER</span>.
          </span>
        </div>
      </div>

      {/* Search, Sort & Platform Filter Controls */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              aria-label="Search Digital Link Hub"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search published links by title, platform, URL, or description..."
              className="w-full bg-[#0a0b18]/80 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="hub-sort-select" className="text-xs text-slate-400 whitespace-nowrap">
              Sort by
            </label>
            <select
              id="hub-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as HubSortOrder)}
              className="bg-[#0a0b18] border border-white/10 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="most-visited">Most Visited</option>
              <option value="alphabetical">Title A–Z</option>
            </select>
          </div>
        </div>

        {/* Platform Segmented Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setPlatformFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              platformFilter === 'all'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-400/40'
                : 'text-slate-400 hover:text-white bg-white/[0.03] border border-transparent'
            }`}
          >
            All Platforms ({links.length})
          </button>

          {PLATFORM_ORDER.map((platform) => {
            const meta = PLATFORM_META[platform];
            const isSelected = platformFilter === platform;
            return (
              <button
                key={platform}
                type="button"
                onClick={() => setPlatformFilter(platform)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-400/40'
                    : 'text-slate-400 hover:text-white bg-white/[0.03] border border-transparent'
                }`}
              >
                <PlatformIcon platform={platform} className="w-3.5 h-3.5" />
                <span>
                  {meta.label} ({platformCounts[platform]})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Published Links Grid (Public Read-Only) */}
      {visibleLinks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleLinks.map((link) => {
            const platform = detectPlatform(link.url);
            const meta = PLATFORM_META[platform];
            const hostname = extractHostname(link.url);
            const isCopied = copiedId === link.id;

            return (
              <motion.article
                key={link.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`group flex flex-col justify-between glass-panel rounded-2xl p-5 border border-white/10 ${meta.borderHoverClass} transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/5`}
              >
                <div>
                  {/* Card Top Row: Platform icon + Clean unboxed metadata */}
                  <div className="flex items-center gap-3 mb-3.5">
                    <div
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.badgeClass}`}
                    >
                      <PlatformIcon platform={platform} className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                        <span className={`font-medium ${meta.accentTextClass}`}>{meta.label}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate font-mono text-[11px]">{hostname}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {link.clickCount || 0} visits
                      </div>
                    </div>
                  </div>

                  {/* Clickable Custom Title (opens in new tab) */}
                  <h3 className="font-syne font-bold text-base text-white group-hover:text-cyan-200 transition-colors mb-2 leading-snug">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onRecordClick(link.id)}
                      className="hover:underline decoration-cyan-400/60 underline-offset-4 line-clamp-2"
                    >
                      {link.title}
                    </a>
                  </h3>

                  {/* Optional Description */}
                  {link.description && (
                    <p className="text-xs text-slate-300 line-clamp-3 mb-3 leading-relaxed font-light">
                      {link.description}
                    </p>
                  )}

                  {/* Clickable Destination URL preview */}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onRecordClick(link.id)}
                    className="block font-mono text-[11px] text-cyan-400/80 hover:text-cyan-300 truncate mb-4"
                    title={link.url}
                  >
                    {link.url}
                  </a>
                </div>

                {/* Card Action Bar (Read-Only: Copy & Open Link) */}
                <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(link)}
                    aria-label={`Copy URL for ${link.title}`}
                    title="Copy URL"
                    className="px-3 py-2 rounded-xl text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 text-[11px] font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[11px]">Copy URL</span>
                      </>
                    )}
                  </button>

                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onRecordClick(link.id)}
                    aria-label={`Open ${link.title} in new tab`}
                    className="px-3.5 py-2 rounded-xl font-medium text-xs text-slate-950 bg-gradient-to-r from-cyan-400 to-sky-300 hover:opacity-95 transition-opacity flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm shadow-cyan-500/20"
                  >
                    <span>Open Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </motion.article>
            );
          })}
        </div>
      ) : (
        /* Empty / No-Results State */
        <div className="glass-panel rounded-3xl p-10 sm:p-12 text-center border border-white/10 max-w-xl mx-auto my-6">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
            <Compass className="w-6 h-6 text-cyan-400" />
          </div>
          <h3 className="font-orbitron font-bold text-lg text-white mb-2">
            {links.length === 0 ? 'No Links Published Yet' : 'No Matching Links Found'}
          </h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            {links.length === 0
              ? 'Links published by the website owner in Omega Control Center will appear here.'
              : 'No published links matched your active platform filter or search query.'}
          </p>
          {(platformFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setPlatformFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </section>
  );
};
