import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { authApi, getConfig } from '../api.ts';
import type { User, SiteConfig } from '../types.ts';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  config: SiteConfig;
  login: (username: string, password: string) => Promise<{ requiresTwoFactor?: boolean; methods?: string[] }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_CONFIG: SiteConfig = { siteName: 'KRNL Drive', allowRegistration: false, siteIconUrl: '' };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG);

  const refresh = useCallback(async () => {
    try {
      const [meRes, cfgRes] = await Promise.all([
        authApi.me(),
        getConfig(),
      ]);
      if (meRes.user) {
        setUser(meRes.user);
      } else {
        // Try guest auto-login when no active session
        const guestRes = await authApi.guestLogin().catch(() => ({ user: null }));
        setUser(guestRes.user);
      }
      setConfig(cfgRes);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    if (res.user) setUser(res.user);
    return { requiresTwoFactor: res.requiresTwoFactor, methods: res.methods };
  };

  const logout = async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, config, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
