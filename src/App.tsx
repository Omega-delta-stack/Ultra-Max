import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CosmicBackground } from './components/CosmicBackground';
import { TopNav } from './components/TopNav';
import { HeroSection } from './components/HeroSection';
import { LinksDirectory } from './components/LinksDirectory';
import { SectorsView } from './components/SectorsView';
import { AdminDashboard } from './components/AdminDashboard';
import { DigitalLinkHub } from './components/DigitalLinkHub';
import { AuthModal } from './components/AuthModal';
import { AccessGuideModal } from './components/AccessGuideModal';
import { Footer } from './components/Footer';
import { LinkItem, Category, PortalStats } from './types/flux';
import { DIGITAL_HUB_CATEGORY_ID } from './utils/digitalHub';

function MainApp() {
  const { user, token, isAdmin } = useAuth();

  const [activeView, setActiveView] = useState<'directory' | 'sectors' | 'digital-hub' | 'admin'>('directory');
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [initialEditLink, setInitialEditLink] = useState<LinkItem | null>(null);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  // Load public and authenticated data
  const loadData = useCallback(async () => {
    try {
      const statsRes = await fetch('/api/public/portal-meta', { credentials: 'include' });
      if (statsRes.ok) {
        const meta = await statsRes.json();
        setStats({
          totalLinks: meta.totalLinks ?? 0,
          totalCategories: meta.totalCategories ?? 0,
          totalMembers: meta.totalMembers ?? 0,
          activeInviteCodes: meta.activeInviteCodes ?? 0,
          totalClicks: meta.totalClicks ?? 0,
          featuredLinksCount: meta.featuredLinksCount ?? 0,
        });
      }

      const authHeaders: Record<string, string> = {};
      if (token) {
        authHeaders['Authorization'] = `Bearer ${token}`;
      }

      const [linksRes, catRes] = await Promise.all([
        fetch('/api/links', { headers: authHeaders, credentials: 'include' }),
        fetch('/api/categories', { headers: authHeaders, credentials: 'include' }),
      ]);

      if (linksRes.ok) {
        setLinks(await linksRes.json());
      }
      if (catRes.ok) {
        setCategories(await catRes.json());
      }

      if (user) {
        const bmRes = await fetch('/api/bookmarks', {
          headers: authHeaders,
          credentials: 'include',
        });
        if (bmRes.ok) {
          setBookmarks(await bmRes.json());
        }
      } else {
        setBookmarks([]);
      }
    } catch (err) {
      console.error('Failed to load flux portal telemetry:', err);
    }
  }, [token, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Click counter
  const handleRecordClick = async (linkId: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/links/${linkId}/click`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setLinks((prev) =>
          prev.map((l) => (l.id === linkId ? { ...l, clickCount: data.clickCount } : l))
        );
      }
    } catch (err) {
      console.error('Error logging link visit:', err);
    }
  };

  // Toggle Bookmark
  const handleToggleBookmark = async (linkId: string) => {
    if (!user) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      return;
    }

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/bookmarks/${linkId}`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks);
      }
    } catch (err) {
      console.error('Error toggling bookmark:', err);
    }
  };

  // Delete Link (Owner only)
  const handleDeleteLink = async (linkId: string) => {
    if (!isAdmin) return;

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/admin/links/${linkId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Failed to delete link:', err);
    }
  };

  // Open Auth modal
  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  // Select category from sectors view
  const handleSelectCategoryFromSectors = (catId: string) => {
    if (catId === DIGITAL_HUB_CATEGORY_ID) {
      setActiveView('digital-hub');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSelectedCategory(catId);
    setActiveView('directory');
    setTimeout(() => {
      document.getElementById('nexus-directory')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-[#030308] text-slate-100 flex flex-col relative selection:bg-cyan-500 selection:text-black">
      {/* High-Performance Cosmic Animated Canvas */}
      <CosmicBackground />

      {/* Top Bar Navigation */}
      <TopNav
        onOpenAuth={handleOpenAuth}
        onOpenGuide={() => setGuideModalOpen(true)}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Main View Area */}
      <main className="flex-1 relative z-10">
        {activeView === 'admin' ? (
          <AdminDashboard
            categories={categories}
            links={links}
            onRefreshData={loadData}
            onClose={() => setActiveView('directory')}
            initialEditLink={initialEditLink}
            onClearInitialEdit={() => setInitialEditLink(null)}
          />
        ) : activeView === 'digital-hub' ? (
          <DigitalLinkHub
            links={links.filter((l) => l.categoryId === DIGITAL_HUB_CATEGORY_ID)}
            onRecordClick={handleRecordClick}
            onOpenControlCenter={() => setActiveView('admin')}
          />
        ) : activeView === 'sectors' ? (
          <div>
            <HeroSection
              stats={stats}
              onExploreClick={() => {
                setActiveView('directory');
                setTimeout(() => {
                  document.getElementById('nexus-directory')?.scrollIntoView({ behavior: 'smooth' });
                }, 50);
              }}
              onOpenAuth={handleOpenAuth}
              onOpenGuide={() => setGuideModalOpen(true)}
            />
            <SectorsView
              categories={categories}
              links={links}
              onSelectCategory={handleSelectCategoryFromSectors}
            />
          </div>
        ) : (
          <div>
            <HeroSection
              stats={stats}
              onExploreClick={() => {
                document.getElementById('nexus-directory')?.scrollIntoView({ behavior: 'smooth' });
              }}
              onOpenAuth={handleOpenAuth}
              onOpenGuide={() => setGuideModalOpen(true)}
            />
            <LinksDirectory
              links={links}
              categories={categories}
              bookmarks={bookmarks}
              onToggleBookmark={handleToggleBookmark}
              onRecordClick={handleRecordClick}
              onOpenAuth={handleOpenAuth}
              onEditLink={(link) => {
                setInitialEditLink(link);
                setActiveView('admin');
              }}
              onDeleteLink={handleDeleteLink}
              onOpenDigitalHub={() => setActiveView('digital-hub')}
              onOpenControlCenter={() => setActiveView('admin')}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer
        onOpenGuide={() => setGuideModalOpen(true)}
        onOpenAuth={handleOpenAuth}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onLoginSuccess={() => loadData()}
        onOpenOmegaControl={() => {
          setAuthModalOpen(false);
          setActiveView('admin');
        }}
      />

      {/* Access Guide & Protocols Modal */}
      <AccessGuideModal
        isOpen={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        onSelectRole={(role) => {
          if (role === 'invite') {
            setAuthModalMode('register');
          } else {
            setAuthModalMode('login');
          }
          setAuthModalOpen(true);
        }}
        onOpenOmegaControl={() => {
          setGuideModalOpen(false);
          setActiveView('admin');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
