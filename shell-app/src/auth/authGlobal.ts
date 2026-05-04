import type { AuthState } from '@ras/shared';

/**
 * Augments the global Window interface with the typed __RAS_AUTH__ global.
 * This file must be imported once at the shell entry point (main.tsx).
 *
 * MFEs access auth state via:
 *   window.__RAS_AUTH__                  → live AuthState object
 *   window.addEventListener('ras-auth-change', handler) → change events
 */
declare global {
  interface Window {
    /**
     * Centralized auth state set by the shell's AuthProvider.
     * MFEs must NOT set this directly — read-only from MFE perspective.
     */
    __RAS_AUTH__: AuthState;
  }
}

export {};
