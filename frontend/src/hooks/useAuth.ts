import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, setAccessToken } from '../utils/api';
import type { User, Settings } from '../types';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  isSetupComplete: boolean | null;
  masterPassword: string | null;
  settings: Settings | null;
  login: (email: string, password: string) => Promise<void>;
  setup: (email: string, password: string) => Promise<void>;
  loginWithOAuthToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  lock: () => void;
  unlock: (password: string) => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthState(): AuthContextValue {
  const [user, setUser] = useState<User | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearLockTimer = useCallback(() => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  }, []);

  const startLockTimer = useCallback((autoLockMins: number) => {
    clearLockTimer();
    if (autoLockMins === 0) return;

    lockTimerRef.current = setTimeout(() => {
      setIsLocked(true);
      setMasterPassword(null);
    }, autoLockMins * 60 * 1000);
  }, [clearLockTimer]);

  const resetActivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (settings?.autoLockMins && settings.autoLockMins > 0) {
      startLockTimer(settings.autoLockMins);
    }
  }, [settings, startLockTimer]);

  useEffect(() => {
    const handleActivity = () => resetActivityTimer();
    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('click', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [resetActivityTimer]);

  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      setMasterPassword(null);
      setIsLocked(false);
      clearLockTimer();
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [clearLockTimer]);

  const refreshSettings = useCallback(async () => {
    try {
      const { data } = await api.get<{ settings: Settings }>('/settings');
      setSettings(data.settings);
      if (data.settings.autoLockMins > 0) {
        startLockTimer(data.settings.autoLockMins);
      }
    } catch {
      // Settings fetch failed - non-critical
    }
  }, [startLockTimer]);

  // Check setup status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data } = await api.get<{ isSetupComplete: boolean }>('/auth/status');
        setIsSetupComplete(data.isSetupComplete);
      } catch {
        setIsSetupComplete(false);
      }
    };
    checkStatus();
  }, []);

  // Try to refresh token on mount
  useEffect(() => {
    const tryRefresh = async () => {
      try {
        const { data } = await api.post<{ accessToken: string }>('/auth/refresh');
        setAccessToken(data.accessToken);
        const payload = JSON.parse(atob(data.accessToken.split('.')[1])) as { userId: string; email: string };
        setUser({ id: payload.userId, email: payload.email });
        setIsLocked(true);
        await refreshSettings();
      } catch {
        // No valid refresh token - user must login
      }
    };

    if (isSetupComplete) {
      tryRefresh();
    }
  }, [isSetupComplete, refreshSettings]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ accessToken: string; user: User }>('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    setMasterPassword(password);
    setIsLocked(false);
    await refreshSettings();
  }, [refreshSettings]);

  const loginWithOAuthToken = useCallback(async (token: string) => {
    setAccessToken(token);
    const payload = JSON.parse(atob(token.split('.')[1])) as { userId: string; email: string };
    setUser({ id: payload.userId, email: payload.email });
    setIsSetupComplete(true);
    setIsLocked(true); // Vault locked until user enters vault password
    await refreshSettings();
  }, [refreshSettings]);

  const setup = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ accessToken: string; user: User }>('/auth/setup', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    setMasterPassword(password);
    setIsLocked(false);
    setIsSetupComplete(true);
    await refreshSettings();
  }, [refreshSettings]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      setAccessToken(null);
      setUser(null);
      setMasterPassword(null);
      setIsLocked(false);
      setSettings(null);
      clearLockTimer();
    }
  }, [clearLockTimer]);

  const lock = useCallback(() => {
    setIsLocked(true);
    setMasterPassword(null);
    clearLockTimer();
  }, [clearLockTimer]);

  const unlock = useCallback(async (password: string) => {
    try {
      await api.post('/auth/refresh');
      setMasterPassword(password);
      setIsLocked(false);
      if (settings?.autoLockMins && settings.autoLockMins > 0) {
        startLockTimer(settings.autoLockMins);
      }
    } catch {
      throw new Error('Failed to unlock. Please check your password.');
    }
  }, [settings, startLockTimer]);

  const updateSettings = useCallback(async (newSettings: Partial<Settings>) => {
    const { data } = await api.put<{ settings: Settings }>('/settings', newSettings);
    setSettings(data.settings);
    if (data.settings.autoLockMins > 0) {
      startLockTimer(data.settings.autoLockMins);
    } else {
      clearLockTimer();
    }
  }, [startLockTimer, clearLockTimer]);

  return {
    user,
    isAuthenticated: !!user && !isLocked,
    isLocked,
    isSetupComplete,
    masterPassword,
    settings,
    login,
    setup,
    loginWithOAuthToken,
    logout,
    lock,
    unlock,
    updateSettings,
    refreshSettings,
  };
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
