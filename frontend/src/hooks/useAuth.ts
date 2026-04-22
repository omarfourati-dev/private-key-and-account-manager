import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, setAccessToken } from '../utils/api';
import {
  generateVaultKey,
  vaultKeyToString,
  wrapVaultKey,
  unwrapVaultKey,
  reEncryptData,
  generateAdminKeypair,
  encryptVaultKeyForAdmin,
  encryptAdminPrivateKey,
} from '../utils/crypto';
import type { User, Settings } from '../types';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  isSetupComplete: boolean | null;
  masterPassword: string | null;
  settings: Settings | null;
  login: (email: string, password: string) => Promise<void>;
  setup: (email: string, password: string, inviteToken?: string) => Promise<void>;
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
  const [storedEncryptedVaultKey, setStoredEncryptedVaultKey] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const migrationRunningRef = useRef(false);

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
      setStoredEncryptedVaultKey(null);
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
      // non-critical
    }
  }, [startLockTimer]);

  // Runs once per account when no encryptedVaultKey exists yet.
  // Generates a vault key, re-encrypts all entries, sets up admin RSA escrow.
  const runVaultMigration = useCallback(async (password: string, currentUser: User) => {
    if (migrationRunningRef.current) return;
    migrationRunningRef.current = true;

    try {
      const vaultKey = generateVaultKey();
      const vaultKeyStr = vaultKeyToString(vaultKey);

      const { data: entriesData } = await api.get<{ entries: Array<{ id: string; encryptedData: string }> }>('/entries');

      const reEncryptedEntries = await Promise.all(
        entriesData.entries.map(async (entry) => ({
          id: entry.id,
          encryptedData: await reEncryptData(entry.encryptedData, password, vaultKeyStr),
        }))
      );

      const encryptedVaultKey = await wrapVaultKey(vaultKey, password);

      let adminEncryptedVaultKey: string | undefined;
      let adminPublicKey: string | undefined;
      let adminPrivateKeyEncrypted: string | undefined;

      if (currentUser.isAdmin) {
        const { publicKeyJwk, privateKeyJwk } = await generateAdminKeypair();
        adminPublicKey = JSON.stringify(publicKeyJwk);
        adminPrivateKeyEncrypted = await encryptAdminPrivateKey(privateKeyJwk, vaultKey);
        adminEncryptedVaultKey = await encryptVaultKeyForAdmin(vaultKey, publicKeyJwk);
      } else {
        try {
          const { data: keyData } = await api.get<{ publicKey: string | null }>('/auth/admin-public-key');
          if (keyData.publicKey) {
            const adminPublicKeyJwk = JSON.parse(keyData.publicKey) as JsonWebKey;
            adminEncryptedVaultKey = await encryptVaultKeyForAdmin(vaultKey, adminPublicKeyJwk);
          }
        } catch {
          // Admin has no keypair yet — escrow skipped
        }
      }

      await api.post('/auth/migrate-vault', {
        encryptedVaultKey,
        adminEncryptedVaultKey,
        adminPublicKey,
        adminPrivateKeyEncrypted,
        reEncryptedEntries,
      });

      setMasterPassword(vaultKeyStr);
      setStoredEncryptedVaultKey(encryptedVaultKey);
    } catch (err) {
      console.error('Vault migration failed:', err);
    } finally {
      migrationRunningRef.current = false;
    }
  }, []);

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

  useEffect(() => {
    const tryRefresh = async () => {
      try {
        const { data } = await api.post<{ accessToken: string }>('/auth/refresh');
        setAccessToken(data.accessToken);
        const payload = JSON.parse(atob(data.accessToken.split('.')[1])) as { userId: string; email: string };
        const meRes = await api.get<{ user: User }>('/auth/me').catch(() => null);
        setUser({ id: payload.userId, email: payload.email, isAdmin: meRes?.data.user.isAdmin });
        setIsLocked(true);
        await refreshSettings();
      } catch {
        // No valid refresh token
      }
    };
    if (isSetupComplete) {
      tryRefresh();
    }
  }, [isSetupComplete, refreshSettings]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{
      accessToken: string;
      user: User;
      encryptedVaultKey: string | null;
    }>('/auth/login', { email, password });

    setAccessToken(data.accessToken);
    setUser(data.user);
    setIsLocked(false);

    if (data.encryptedVaultKey) {
      const vaultKey = await unwrapVaultKey(data.encryptedVaultKey, password);
      const vaultKeyStr = vaultKeyToString(vaultKey);
      setMasterPassword(vaultKeyStr);
      setStoredEncryptedVaultKey(data.encryptedVaultKey);
    } else {
      // Legacy account: use raw password temporarily, migrate in background
      setMasterPassword(password);
      setTimeout(() => runVaultMigration(password, data.user), 200);
    }

    await refreshSettings();
  }, [refreshSettings, runVaultMigration]);

  const loginWithOAuthToken = useCallback(async (token: string) => {
    setAccessToken(token);
    const payload = JSON.parse(atob(token.split('.')[1])) as { userId: string; email: string };
    const meRes = await api.get<{ user: User & { encryptedVaultKey: string | null } }>('/auth/me').catch(() => null);
    const meUser = meRes?.data.user;
    setUser({ id: payload.userId, email: payload.email, isAdmin: meUser?.isAdmin, hasPassword: meUser?.hasPassword });
    setIsSetupComplete(true);
    if (meUser?.encryptedVaultKey) {
      setStoredEncryptedVaultKey(meUser.encryptedVaultKey);
    }
    setIsLocked(true);
    await refreshSettings();
  }, [refreshSettings]);

  const setup = useCallback(async (email: string, password: string, inviteToken?: string) => {
    const vaultKey = generateVaultKey();
    const vaultKeyStr = vaultKeyToString(vaultKey);
    const encryptedVaultKey = await wrapVaultKey(vaultKey, password);

    let adminEncryptedVaultKey: string | undefined;
    let adminPublicKey: string | undefined;
    let adminPrivateKeyEncrypted: string | undefined;

    if (!inviteToken) {
      // First user = admin: generate RSA keypair
      const { publicKeyJwk, privateKeyJwk } = await generateAdminKeypair();
      adminPublicKey = JSON.stringify(publicKeyJwk);
      adminPrivateKeyEncrypted = await encryptAdminPrivateKey(privateKeyJwk, vaultKey);
      adminEncryptedVaultKey = await encryptVaultKeyForAdmin(vaultKey, publicKeyJwk);
    } else {
      try {
        const { data: keyData } = await api.get<{ publicKey: string | null }>('/auth/admin-public-key');
        if (keyData.publicKey) {
          const adminPublicKeyJwk = JSON.parse(keyData.publicKey) as JsonWebKey;
          adminEncryptedVaultKey = await encryptVaultKeyForAdmin(vaultKey, adminPublicKeyJwk);
        }
      } catch {
        // skip
      }
    }

    const url = inviteToken ? `/auth/setup?invite=${inviteToken}` : '/auth/setup';
    const { data } = await api.post<{ accessToken: string; user: User }>(url, {
      email,
      password,
      encryptedVaultKey,
      adminEncryptedVaultKey,
      adminPublicKey,
      adminPrivateKeyEncrypted,
    });

    setAccessToken(data.accessToken);
    setUser(data.user);
    setMasterPassword(vaultKeyStr);
    setStoredEncryptedVaultKey(encryptedVaultKey);
    setIsLocked(false);
    setIsSetupComplete(true);
    await refreshSettings();
  }, [refreshSettings]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      setAccessToken(null);
      setUser(null);
      setMasterPassword(null);
      setStoredEncryptedVaultKey(null);
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
      if (storedEncryptedVaultKey) {
        const vaultKey = await unwrapVaultKey(storedEncryptedVaultKey, password);
        setMasterPassword(vaultKeyToString(vaultKey));
      } else {
        setMasterPassword(password);
      }
      setIsLocked(false);
      if (settings?.autoLockMins && settings.autoLockMins > 0) {
        startLockTimer(settings.autoLockMins);
      }
    } catch {
      throw new Error('Failed to unlock. Please check your password.');
    }
  }, [storedEncryptedVaultKey, settings, startLockTimer]);

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
