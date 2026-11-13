import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types/flux';

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  ownerConfigured: boolean | null;
  login: (usernameOrEmail: string, password: string) => Promise<AuthResult>;
  register: (
    username: string,
    email: string,
    password: string,
    invitationCode: string
  ) => Promise<AuthResult>;
  logout: () => Promise<void>;
  setupOwnerPassword: (password: string, username?: string) => Promise<AuthResult>;
  loginOwner: (password: string) => Promise<AuthResult>;
  changeOwnerPassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  refreshOwnerStatus: () => Promise<void>;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [ownerConfigured, setOwnerConfigured] = useState<boolean | null>(null);

  const refreshOwnerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOwnerConfigured(Boolean(data.ownerConfigured));
      }
    } catch (err) {
      console.error('Failed to check owner status:', err);
    }
  }, []);

  const fetchCurrentUser = useCallback(async (authToken?: string | null) => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch('/api/auth/session', {
        headers,
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setToken(null);
          setUser(null);
        }
      } else {
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to authenticate session:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOwnerStatus();
    fetchCurrentUser();
  }, [refreshOwnerStatus, fetchCurrentUser]);

  const login = async (usernameOrEmail: string, password: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ usernameOrEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      setToken(data.token || null);
      setUser(data.user);
      return { success: true };
    } catch {
      return { success: false, error: 'Network anomaly during authentication attempt.' };
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    invitationCode: string
  ): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, password, invitationCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      setToken(data.token || null);
      setUser(data.user);
      return { success: true };
    } catch {
      return { success: false, error: 'Network error during registration transmission.' };
    }
  };

  const setupOwnerPassword = async (password: string, username?: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/owner/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password, username }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Owner initialization failed.' };
      }

      setToken(data.token || null);
      setUser(data.user);
      setOwnerConfigured(true);
      return { success: true };
    } catch {
      return { success: false, error: 'Network error during Omega Control initialization.' };
    }
  };

  const loginOwner = async (password: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/owner/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Invalid private admin password.' };
      }

      setToken(data.token || null);
      setUser(data.user);
      return { success: true };
    } catch {
      return { success: false, error: 'Network error unlocking Omega Control Center.' };
    }
  };

  const changeOwnerPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<AuthResult> => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/owner/change-password', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update admin password.' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error updating admin password.' };
    }
  };

  const logout = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers,
        credentials: 'include',
      });
    } catch (e) {
      console.error('Logout error:', e);
    }
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchCurrentUser(token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        ownerConfigured,
        login,
        register,
        logout,
        setupOwnerPassword,
        loginOwner,
        changeOwnerPassword,
        refreshOwnerStatus,
        isAdmin: user?.role === 'admin',
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
