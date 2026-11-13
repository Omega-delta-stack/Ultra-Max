import { LinkItem } from '../types/flux';

export const DIGITAL_HUB_CATEGORY_ID = 'cat_digital_hub';

export type SocialPlatform =
  | 'instagram'
  | 'telegram'
  | 'facebook'
  | 'youtube'
  | 'tiktok'
  | 'website';

export interface PlatformMeta {
  id: SocialPlatform;
  label: string;
  placeholder: string;
  badgeClass: string;
  accentTextClass: string;
  borderHoverClass: string;
}

export const PLATFORM_META: Record<SocialPlatform, PlatformMeta> = {
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/username',
    badgeClass: 'bg-pink-500/15 border-pink-500/30 text-pink-300',
    accentTextClass: 'text-pink-300',
    borderHoverClass: 'hover:border-pink-500/40',
  },
  telegram: {
    id: 'telegram',
    label: 'Telegram',
    placeholder: 'https://t.me/channel_name',
    badgeClass: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
    accentTextClass: 'text-sky-300',
    borderHoverClass: 'hover:border-sky-500/40',
  },
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    placeholder: 'https://facebook.com/page_name',
    badgeClass: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
    accentTextClass: 'text-blue-300',
    borderHoverClass: 'hover:border-blue-500/40',
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@channel',
    badgeClass: 'bg-red-500/15 border-red-500/30 text-red-300',
    accentTextClass: 'text-red-300',
    borderHoverClass: 'hover:border-red-500/40',
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@creator',
    badgeClass: 'bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-300',
    accentTextClass: 'text-fuchsia-300',
    borderHoverClass: 'hover:border-fuchsia-500/40',
  },
  website: {
    id: 'website',
    label: 'Website',
    placeholder: 'https://example.com',
    badgeClass: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
    accentTextClass: 'text-cyan-300',
    borderHoverClass: 'hover:border-cyan-500/40',
  },
};

export const PLATFORM_ORDER: SocialPlatform[] = [
  'instagram',
  'telegram',
  'facebook',
  'youtube',
  'tiktok',
  'website',
];

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
}

/**
 * Normalizes a user-supplied URL (auto-prepending https:// if protocol is omitted)
 * and verifies it is a safe http/https URL with a valid hostname.
 */
export function normalizeHubUrl(rawInput: string): UrlValidationResult {
  const trimmed = typeof rawInput === 'string' ? rawInput.trim() : '';
  if (!trimmed) {
    return { valid: false, error: 'Please enter a valid URL.' };
  }

  // Reject dangerous or non-web schemes explicitly before prepending https://
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return {
        valid: false,
        error: 'Only http:// and https:// website or social links are supported.',
      };
    }
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Only http:// and https:// URLs are permitted.',
      };
    }
    const host = parsed.hostname.toLowerCase();
    if (!host || (!host.includes('.') && host !== 'localhost')) {
      return {
        valid: false,
        error: 'Please enter a complete URL with a valid domain (e.g. https://instagram.com/nasa).',
      };
    }
    return { valid: true, normalizedUrl: parsed.toString() };
  } catch {
    return {
      valid: false,
      error: 'Invalid URL format. Example: https://youtube.com/@channel or https://example.com',
    };
  }
}

function matchesDomain(hostname: string, domains: string[]): boolean {
  const clean = hostname.toLowerCase();
  return domains.some((d) => clean === d || clean.endsWith(`.${d}`));
}

/**
 * Detects whether a URL belongs to Instagram, Telegram, Facebook, YouTube, TikTok, or a general Website.
 */
export function detectPlatform(rawUrl: string): SocialPlatform {
  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!trimmed) return 'website';

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const { hostname } = new URL(candidate);
    const host = hostname.toLowerCase().replace(/^www\./, '');

    if (matchesDomain(host, ['instagram.com', 'instagr.am'])) return 'instagram';
    if (matchesDomain(host, ['t.me', 'telegram.me', 'telegram.org'])) return 'telegram';
    if (matchesDomain(host, ['facebook.com', 'fb.com', 'fb.watch'])) return 'facebook';
    if (matchesDomain(host, ['youtube.com', 'youtu.be'])) return 'youtube';
    if (matchesDomain(host, ['tiktok.com'])) return 'tiktok';
    return 'website';
  } catch {
    return 'website';
  }
}

/**
 * Extracts a clean display domain (without www.) from a URL.
 */
export function extractHostname(rawUrl: string): string {
  try {
    const parsed = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return rawUrl;
  }
}

export type HubSortOrder = 'newest' | 'most-visited' | 'alphabetical';

export interface HubFilterOptions {
  platform: SocialPlatform | 'all';
  search: string;
  sortBy: HubSortOrder;
}

/**
 * Filters and sorts Digital Link Hub items without mutating the source array.
 */
export function filterAndSortHubLinks(
  links: LinkItem[],
  options: HubFilterOptions
): LinkItem[] {
  const query = options.search.trim().toLowerCase();

  const filtered = links.filter((link) => {
    const platform = detectPlatform(link.url);
    if (options.platform !== 'all' && platform !== options.platform) {
      return false;
    }
    if (query) {
      const platformLabel = PLATFORM_META[platform].label.toLowerCase();
      const matchesTitle = link.title.toLowerCase().includes(query);
      const matchesDesc = (link.description || '').toLowerCase().includes(query);
      const matchesUrl = link.url.toLowerCase().includes(query);
      const matchesPlatform = platformLabel.includes(query);
      const matchesTag = (link.tags || []).some((t) => t.toLowerCase().includes(query));
      if (!matchesTitle && !matchesDesc && !matchesUrl && !matchesPlatform && !matchesTag) {
        return false;
      }
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (options.sortBy === 'most-visited') {
      return (b.clickCount || 0) - (a.clickCount || 0);
    }
    if (options.sortBy === 'alphabetical') {
      return a.title.localeCompare(b.title);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
