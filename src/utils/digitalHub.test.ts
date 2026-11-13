import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHubUrl,
  detectPlatform,
  extractHostname,
  filterAndSortHubLinks,
  DIGITAL_HUB_CATEGORY_ID,
} from './digitalHub';
import { LinkItem } from '../types/flux';

test('normalizeHubUrl accepts https/http URLs and prepends https:// when omitted', () => {
  const withScheme = normalizeHubUrl('https://instagram.com/nasa');
  assert.equal(withScheme.valid, true);
  assert.equal(withScheme.normalizedUrl, 'https://instagram.com/nasa');

  const withoutScheme = normalizeHubUrl('  youtube.com/@veritasium  ');
  assert.equal(withoutScheme.valid, true);
  assert.equal(withoutScheme.normalizedUrl, 'https://youtube.com/@veritasium');
});

test('normalizeHubUrl rejects empty strings, invalid domains, and non-web schemes', () => {
  assert.equal(normalizeHubUrl('').valid, false);
  assert.equal(normalizeHubUrl('   ').valid, false);
  assert.equal(normalizeHubUrl('not-a-domain').valid, false);
  assert.equal(normalizeHubUrl('javascript:alert(1)').valid, false);
  assert.equal(normalizeHubUrl('data:text/html,hello').valid, false);
});

test('detectPlatform identifies Instagram, Telegram, Facebook, YouTube, TikTok, and general websites', () => {
  assert.equal(detectPlatform('https://www.instagram.com/nasa/'), 'instagram');
  assert.equal(detectPlatform('https://instagr.am/p/abc'), 'instagram');
  assert.equal(detectPlatform('https://t.me/telegram'), 'telegram');
  assert.equal(detectPlatform('https://telegram.org/blog'), 'telegram');
  assert.equal(detectPlatform('https://m.facebook.com/meta'), 'facebook');
  assert.equal(detectPlatform('https://fb.watch/xyz'), 'facebook');
  assert.equal(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectPlatform('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectPlatform('https://www.tiktok.com/@nasa'), 'tiktok');
  assert.equal(detectPlatform('https://vm.tiktok.com/ZM8xyz/'), 'tiktok');
  assert.equal(detectPlatform('https://webbtelescope.org'), 'website');
});

test('extractHostname returns clean domain without www prefix', () => {
  assert.equal(extractHostname('https://www.instagram.com/nasa'), 'instagram.com');
  assert.equal(extractHostname('https://t.me/flux_channel'), 't.me');
});

test('filterAndSortHubLinks filters by platform and search and sorts accurately', () => {
  const sampleLinks: LinkItem[] = [
    {
      id: '1',
      title: 'Beta YouTube',
      url: 'https://youtube.com/@beta',
      categoryId: DIGITAL_HUB_CATEGORY_ID,
      description: 'Video archive',
      tags: ['YouTube'],
      isFeatured: false,
      clickCount: 12,
      createdAt: '2026-11-10T10:00:00.000Z',
      updatedAt: '2026-11-10T10:00:00.000Z',
      createdByUserId: 'usr_1',
    },
    {
      id: '2',
      title: 'Alpha Instagram',
      url: 'https://instagram.com/alpha',
      categoryId: DIGITAL_HUB_CATEGORY_ID,
      description: 'Visual feed',
      tags: ['Instagram'],
      isFeatured: false,
      clickCount: 45,
      createdAt: '2026-11-12T10:00:00.000Z',
      updatedAt: '2026-11-12T10:00:00.000Z',
      createdByUserId: 'usr_1',
    },
    {
      id: '3',
      title: 'Cosmic Telegram',
      url: 'https://t.me/cosmic',
      categoryId: DIGITAL_HUB_CATEGORY_ID,
      description: '',
      tags: ['Telegram'],
      isFeatured: false,
      clickCount: 5,
      createdAt: '2026-11-11T10:00:00.000Z',
      updatedAt: '2026-11-11T10:00:00.000Z',
      createdByUserId: 'usr_1',
    },
  ];

  const byPlatform = filterAndSortHubLinks(sampleLinks, {
    platform: 'telegram',
    search: '',
    sortBy: 'newest',
  });
  assert.equal(byPlatform.length, 1);
  assert.equal(byPlatform[0].id, '3');

  const bySearch = filterAndSortHubLinks(sampleLinks, {
    platform: 'all',
    search: 'instagram',
    sortBy: 'newest',
  });
  assert.equal(bySearch.length, 1);
  assert.equal(bySearch[0].id, '2');

  const byVisits = filterAndSortHubLinks(sampleLinks, {
    platform: 'all',
    search: '',
    sortBy: 'most-visited',
  });
  assert.deepEqual(byVisits.map((l) => l.id), ['2', '1', '3']);

  const byAlpha = filterAndSortHubLinks(sampleLinks, {
    platform: 'all',
    search: '',
    sortBy: 'alphabetical',
  });
  assert.deepEqual(byAlpha.map((l) => l.id), ['2', '1', '3']);
});
