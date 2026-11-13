import React, { useState, useMemo } from 'react';
import { LinkItem, Category } from '../types/flux';
import { useAuth } from '../context/AuthContext';
import { DIGITAL_HUB_CATEGORY_ID } from '../utils/digitalHub';
import {
  Search,
  ExternalLink,
  Copy,
  Check,
  Bookmark,
  Sparkles,
  Lock,
  Edit2,
  Trash2,
  X,
  Compass,
  Shield,
  AlertTriangle,
} from 'lucide-react';

interface LinksDirectoryProps {
  links: LinkItem[];
  categories: Category[];
  bookmarks: string[];
  onToggleBookmark: (linkId: string) => void;
  onRecordClick: (linkId: string) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onEditLink?: (link: LinkItem) => void;
  onDeleteLink?: (linkId: string) => Promise<void> | void;
  onOpenDigitalHub?: () => void;
  onOpenControlCenter?: () => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
}

export const LinksDirectory: React.FC<LinksDirectoryProps> = ({
  links,
  categories,
  bookmarks,
  onToggleBookmark,
  onRecordClick,
  onEditLink,
  onDeleteLink,
  onOpenDigitalHub,
  onOpenControlCenter,
  selectedCategory,
  setSelectedCategory,
}) => {
  const { user, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [onlyBookmarks, setOnlyBookmarks] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LinkItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter links
  const filteredLinks = useMemo(() => {
    return links.filter((link) => {
      if (selectedCategory !== 'all' && link.categoryId !== selectedCategory) {
        return false;
      }
      if (onlyBookmarks && !bookmarks.includes(link.id)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = link.title.toLowerCase().includes(q);
        const matchesDesc = link.description.toLowerCase().includes(q);
        const matchesUrl = link.url.toLowerCase().includes(q);
        const matchesTag = link.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesUrl && !matchesTag) {
          return false;
        }
      }
      return true;
    });
  }, [links, selectedCategory, onlyBookmarks, bookmarks, searchQuery]);

  const handleCopyLink = async (link: LinkItem) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handlePortalClick = (link: LinkItem) => {
    onRecordClick(link.id);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || !onDeleteLink) return;
    setIsDeleting(true);
    try {
      await onDeleteLink(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  return (
    <section id="nexus-directory" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-xs font-mono tracking-widest text-cyan-400 uppercase mb-1">
            CURATED COSMIC ARCHIVE
          </div>
          <h2 className="font-orbitron font-bold text-2xl sm:text-3xl text-white tracking-wide">
            Nexus Directory
          </h2>
        </div>

        {/* Clearance Notice */}
        <div className="text-xs text-slate-400 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 self-start md:self-auto">
          {user ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>
                {isAdmin
                  ? 'Owner Authority Active: Full Link Modification Rights'
                  : 'Member Protocol: Read-Only View, Copy & Open Clearance'}
              </span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              <span>Public Read-Only View · Sign in for bookmarks &amp; member access</span>
            </>
          )}
        </div>
      </div>

      {/* Search & Category Filter Controls */}
      <div className="space-y-4 mb-8">
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search classified links by title, description, or tag (e.g. quantum, Webb, collider)..."
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

          {user && (
            <button
              type="button"
              onClick={() => setOnlyBookmarks(!onlyBookmarks)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer ${
                onlyBookmarks
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-white/[0.04] text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${onlyBookmarks ? 'fill-current' : ''}`} />
              <span>Saved ({bookmarks.length})</span>
            </button>
          )}
        </div>

        {/* Category Segmented Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-400/40 shadow-sm shadow-cyan-500/10'
                : 'text-slate-400 hover:text-white bg-white/[0.03] border border-transparent'
            }`}
          >
            All Sectors ({links.length})
          </button>

          {categories.map((cat) => {
            const count = links.filter((l) => l.categoryId === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-400/40 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-white bg-white/[0.03] border border-transparent'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Count & Active Filter Indicator */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-6 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong className="text-white font-mono tabular-nums">{filteredLinks.length}</strong> links
          </span>
          {selectedCategory !== 'all' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-cyan-300">Filtered by {categoryMap.get(selectedCategory)}</span>
            </>
          )}
          {onlyBookmarks && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-purple-300">Bookmarked only</span>
            </>
          )}
        </div>

        {isAdmin && (
          <div className="text-[11px] text-purple-300 font-mono">
            Owner Mode Active · Quick Card Management Available
          </div>
        )}
      </div>

      {selectedCategory === DIGITAL_HUB_CATEGORY_ID && onOpenDigitalHub && (
        <div className="mb-6 glass-panel-elevated rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-orbitron font-bold text-sm text-white">
              DIGITAL LINK HUB · Universal Social &amp; Web Link Repository
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Browse Instagram, Telegram, Facebook, YouTube, TikTok, and website links with dedicated platform filters.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenDigitalHub}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-purple-300 hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Digital Link Hub
            </button>
            {isAdmin && onOpenControlCenter && (
              <button
                type="button"
                onClick={onOpenControlCenter}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-200 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Manage Links</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Link Cards Grid */}
      {filteredLinks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLinks.map((link) => {
            const isBookmarked = bookmarks.includes(link.id);
            const isCopied = copiedId === link.id;
            const categoryName = categoryMap.get(link.categoryId) || 'Uncategorized';

            return (
              <div
                key={link.id}
                className="group relative flex flex-col justify-between glass-panel rounded-2xl p-5 border border-white/10 hover:border-cyan-500/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/5"
              >
                {link.isFeatured && (
                  <div className="absolute top-3 right-3 text-[10px] font-mono tracking-wider text-cyan-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>FEATURED</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-2.5 pr-20">
                    <span className="text-cyan-400 font-medium">{categoryName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{link.clickCount || 0} visits</span>
                  </div>

                  <h3 className="font-syne font-bold text-base text-white group-hover:text-cyan-200 transition-colors mb-2 line-clamp-2 leading-snug">
                    {link.title}
                  </h3>

                  <p className="text-xs text-slate-300 line-clamp-3 mb-4 leading-relaxed font-light">
                    {link.description || 'No specialized description logged for this portal conduit.'}
                  </p>

                  {link.tags && link.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mb-5">
                      {link.tags.map((tag, idx) => (
                        <React.Fragment key={tag}>
                          {idx > 0 && <span aria-hidden="true" className="text-slate-600">·</span>}
                          <span>#{tag}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(link)}
                      title="Copy destination URL"
                      aria-label={`Copy link for ${link.title}`}
                      className="p-2 rounded-xl text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-medium text-[11px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline text-[11px]">Copy</span>
                        </>
                      )}
                    </button>

                    {user && (
                      <button
                        type="button"
                        onClick={() => onToggleBookmark(link.id)}
                        title={isBookmarked ? 'Remove bookmark' : 'Bookmark link'}
                        aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark link'}
                        className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                          isBookmarked
                            ? 'text-purple-300 bg-purple-500/20 border-purple-500/30'
                            : 'text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border-white/10'
                        }`}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                      </button>
                    )}

                    {/* Owner-only Edit/Delete shortcuts */}
                    {isAdmin && onEditLink && onDeleteLink && (
                      <div className="flex items-center gap-1 border-l border-white/10 pl-1.5 ml-0.5">
                        <button
                          type="button"
                          onClick={() => onEditLink(link)}
                          title="Edit in Omega Control Center"
                          aria-label={`Edit ${link.title}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(link)}
                          title="Delete Link"
                          aria-label={`Delete ${link.title}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handlePortalClick(link)}
                    className="px-3.5 py-2 rounded-xl font-medium text-xs text-slate-950 bg-gradient-to-r from-cyan-400 to-sky-300 hover:opacity-95 transition-opacity flex items-center gap-1.5 shrink-0 shadow-sm shadow-cyan-500/20 cursor-pointer"
                  >
                    <span>Launch Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="glass-panel rounded-3xl p-12 text-center border border-white/10 max-w-xl mx-auto my-8">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
            <Compass className="w-6 h-6 text-cyan-400" />
          </div>
          <h3 className="font-orbitron font-bold text-lg text-white mb-2">No Flux Conduits Located</h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            No published links matched your active sector filter or search parameters. Reset your query or
            explore other cosmic sectors.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setOnlyBookmarks(false);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Owner Delete Confirmation Dialog */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dir-delete-title"
        >
          <div
            className="fixed inset-0 bg-[#030308]/85 backdrop-blur-md"
            onClick={() => !isDeleting && setPendingDelete(null)}
          />
          <div className="relative w-full max-w-sm glass-panel-elevated rounded-3xl p-6 text-white z-10 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 id="dir-delete-title" className="font-orbitron font-bold text-sm text-white">
                Delete Published Link
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-6 font-light">
              Permanently remove <strong className="text-white">{pendingDelete.title}</strong> from the
              ULTRA MEGA FLUX repository?
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPendingDelete(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl bg-white/[0.04] hover:bg-white/[0.08] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
