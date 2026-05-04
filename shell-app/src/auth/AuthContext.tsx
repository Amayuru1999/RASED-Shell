import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import type { AuthUser, AuthState, Permission } from '@ras/shared';
import { derivePermissions, hasRole, hasPermission, hasAnyRole, hasAllPermissions } from '@ras/shared';
import './authGlobal';

// ─── Config ──────────────────────────────────────────────────────────────────
const BFF_URL = import.meta.env.VITE_BFF_URL as string;
/** Minimum seconds before token expiry to trigger a silent refresh */
const REFRESH_BUFFER_SECONDS = 60;
/** How long a /me response stays fresh before we re-fetch (ms) */
const CACHE_TTL_MS = 30_000;

// ─── Logger (structured, non-silent) ─────────────────────────────────────────
const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    console.info(`[AuthProvider] ${msg}`, ctx ?? ''),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    console.warn(`[AuthProvider] ${msg}`, ctx ?? ''),
  error: (msg: string, error?: unknown, ctx?: Record<string, unknown>) =>
    console.error(`[AuthProvider] ${msg}`, error, ctx ?? ''),
};
//
// ─── BroadcastChannel for multi-tab sync ─────────────────────────────────────
const AUTH_CHANNEL_NAME = 'ras-auth';

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthState | null>(null);

// ─── AuthProvider ─────────────────────────────────────────────────────────────
export function AuthProvider({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cache refs
  const lastFetchedAt = useRef<number>(0);
  const isFetchingRef = useRef(false);

  // Silent refresh scheduling
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // BroadcastChannel for multi-tab sync
  const channelRef = useRef<BroadcastChannel | null>(null);

  // ─── Broadcast auth event to other tabs ────────────────────────────────────
  const broadcast = useCallback((type: 'AUTH_CHANGE' | 'LOGOUT') => {
    channelRef.current?.postMessage({ type });
  }, []);

  // ─── Expose to window for MFEs ─────────────────────────────────────────────
  const publishGlobal = useCallback((state: AuthState) => {
    window.__RAS_AUTH__ = state;
    window.dispatchEvent(new CustomEvent('ras-auth-change'));
  }, []);

  // ─── Schedule silent refresh before token expiry ───────────────────────────
  const scheduleRefresh = useCallback((expiresAt?: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (!expiresAt) return;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const delay = (expiresAt - nowSeconds - REFRESH_BUFFER_SECONDS) * 1000;

    if (delay <= 0) {
      logger.warn('Token already near-expiry, refreshing immediately');
      triggerSilentRefresh();
      return;
    }

    logger.info(`Silent refresh scheduled in ${Math.round(delay / 1000)}s`);
    refreshTimerRef.current = setTimeout(() => {
      triggerSilentRefresh();
    }, delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Fetch /me with cache ──────────────────────────────────────────────────
  const fetchUser = useCallback(
    async (force = false): Promise<void> => {
      const now = Date.now();
      if (!force && now - lastFetchedAt.current < CACHE_TTL_MS) {
        logger.info('Auth cache fresh — skipping /me fetch');
        return;
      }
      if (isFetchingRef.current) {
        logger.info('Fetch already in progress — skipping');
        return;
      }

      isFetchingRef.current = true;
      try {
        const res = await fetch(`${BFF_URL}/api/auth/me`, {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            const enrichedUser: AuthUser = {
              ...data.user,
              permissions: derivePermissions(data.user.roles),
              expiresAt: data.expiresAt,
            };
            setUser(enrichedUser);
            lastFetchedAt.current = Date.now();
            scheduleRefresh(data.expiresAt);
            logger.info('User authenticated', {
              id: enrichedUser.id,
              roles: enrichedUser.roles,
            });
          } else {
            setUser(null);
          }
        } else if (res.status === 401) {
          // Try a silent refresh before giving up
          logger.warn('/me returned 401 — attempting silent refresh');
          await triggerSilentRefresh();
        } else {
          logger.error('/me returned unexpected status', null, { status: res.status });
          setUser(null);
        }
      } catch (error) {
        logger.error('Failed to fetch /me', error);
        setUser(null);
      } finally {
        isFetchingRef.current = false;
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduleRefresh]
  );

  // ─── Silent token refresh (POST /refresh) ─────────────────────────────────
  // Declared with function keyword so scheduleRefresh can reference it before
  // fetchUser is defined in the closure.
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  async function triggerSilentRefresh(): Promise<void> {
    try {
      const res = await fetch(`${BFF_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        logger.info('Silent refresh succeeded');
        // Force re-fetch to get new expiresAt and reschedule
        await fetchUser(true);
      } else {
        logger.warn('Silent refresh failed — logging out', { status: res.status });
        performLogout(false); // no redirect loop, just clear state
      }
    } catch (error) {
      logger.error('Silent refresh request failed', error);
      performLogout(false);
    }
  }

  // ─── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(() => {
    const redirect = encodeURIComponent(window.location.href);
    window.location.href = `${BFF_URL}/api/auth/login?redirect=${redirect}`;
  }, []);

  // ─── Logout ────────────────────────────────────────────────────────────────
  const performLogout = useCallback((redirect = true) => {
    // 1. Clear local state immediately (prevent flash of authenticated UI)
    setUser(null);
    lastFetchedAt.current = 0;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    // 2. Notify other tabs
    broadcast('LOGOUT');

    // 3. Redirect to BFF logout (which ends Keycloak session)
    if (redirect) {
      window.location.href = `${BFF_URL}/api/auth/logout`;
    }
  }, [broadcast]);

  const logout = useCallback(() => performLogout(true), [performLogout]);

  // ─── Public refresh (called by HTTP client after 401) ─────────────────────
  const refresh = useCallback(async () => {
    await triggerSilentRefresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUser]);

  // ─── RBAC helpers (bound to current user) ─────────────────────────────────
  const hasRoleFn = useCallback((role: string) => hasRole(user, role), [user]);
  const hasPermissionFn = useCallback(
    (permission: Permission) => hasPermission(user, permission),
    [user]
  );
  const hasAnyRoleFn = useCallback((roles: string[]) => hasAnyRole(user, roles), [user]);
  const hasAllPermissionsFn = useCallback(
    (permissions: Permission[]) => hasAllPermissions(user, permissions),
    [user]
  );

  // ─── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchUser(true);
  }, [fetchUser]);

  // ─── Multi-tab sync via BroadcastChannel ──────────────────────────────────
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type } = event.data ?? {};
      if (type === 'LOGOUT') {
        logger.info('Received LOGOUT from another tab');
        setUser(null);
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        setIsLoading(false);
      } else if (type === 'AUTH_CHANGE') {
        logger.info('Received AUTH_CHANGE from another tab — re-fetching');
        fetchUser(true);
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [fetchUser]);

  // ─── Build the AuthState object & publish to global ───────────────────────
  const authState: AuthState = {
    user,
    isAuthenticated: !!user,
    isLoading,
    hasRole: hasRoleFn,
    hasPermission: hasPermissionFn,
    hasAnyRole: hasAnyRoleFn,
    hasAllPermissions: hasAllPermissionsFn,
    login,
    logout,
    refresh,
  };

  // Publish to window every render so MFEs always see current state
  useEffect(() => {
    publishGlobal(authState);
    if (!isLoading) {
      broadcast('AUTH_CHANGE');
      onReady?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);

  return <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>;
}

// ─── useAuth hook (for shell-internal components) ─────────────────────────────
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
