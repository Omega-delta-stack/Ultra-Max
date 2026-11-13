export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
  isActive: boolean;
  invitationCodeUsed?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  order: number;
}

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  categoryId: string;
  description: string;
  tags: string[];
  isFeatured: boolean;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
}

export interface InvitationCode {
  id: string;
  code: string;
  createdByUserId: string;
  maxUses: number;
  timesUsed: number;
  isActive: boolean;
  createdAt: string;
  note?: string;
}

export interface PortalStats {
  totalLinks: number;
  totalCategories: number;
  totalMembers: number;
  activeInviteCodes: number;
  totalClicks: number;
  featuredLinksCount: number;
}
