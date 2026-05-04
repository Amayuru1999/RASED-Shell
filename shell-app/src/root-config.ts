import { registerApplication, start } from 'single-spa';

// ─── MFE URLs (dev: local ports, prod: CDN URLs) ──────────────────────────────
const MFE_URLS: Record<string, string> = {
  '@ras/mfe-user-management':       'http://localhost:4001/src/main.tsx',
  '@ras/mfe-license-management':    'http://localhost:4002/src/main.tsx',
  '@ras/mfe-production-management': 'http://localhost:4003/src/main.tsx',
  '@ras/mfe-reporting-management':  'http://localhost:4004/src/main.tsx',
};

// ─── Role-to-MFE Access Map ────────────────────────────────────────────────────
// Defines which roles are allowed to load each MFE.
// Empty array = accessible to all authenticated users.
const MFE_ROLE_GUARDS: Record<string, string[]> = {
  '@ras/mfe-user-management':       ['SUPER_ADMIN'],
  '@ras/mfe-license-management':    ['SUPER_ADMIN', 'EXCISE_OFFICER'],
  '@ras/mfe-production-management': ['SUPER_ADMIN', 'EXCISE_OFFICER', 'DATA_ENTRY_OPERATOR'],
  '@ras/mfe-reporting-management':  ['SUPER_ADMIN', 'EXCISE_OFFICER', 'AUDITOR'],
};

// ─── DOM Element Getter — returns the MFE's mount div ─────────────────────────
function domElementGetter(props: { name: string }) {
  const id = `single-spa-application:${props.name}`;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = 'w-full h-full';
    const container = document.getElementById('mfe-container');
    if (container) {
      container.appendChild(el);
    } else {
      document.body.appendChild(el);
    }
  }
  return el;
}

let appsRegistered = false;

// ─── Register all MFEs (called once after auth resolves) ──────────────────────
export function registerMFEs(): void {
  if (appsRegistered) return;
  appsRegistered = true;

  registerApplication({
    name: '@ras/mfe-user-management',
    app: () => import(/* @vite-ignore */ MFE_URLS['@ras/mfe-user-management']),
    activeWhen: (location) => location.pathname.startsWith('/users'),
    customProps: {
      domElementGetter,
      // Pass auth state reference so MFE can read it without an extra request
      getAuthState: () => window.__RAS_AUTH__,
    },
  });

  registerApplication({
    name: '@ras/mfe-license-management',
    app: () => import(/* @vite-ignore */ MFE_URLS['@ras/mfe-license-management']),
    activeWhen: (location) => location.pathname.startsWith('/licenses'),
    customProps: { domElementGetter, getAuthState: () => window.__RAS_AUTH__ },
  });

  registerApplication({
    name: '@ras/mfe-production-management',
    app: () => import(/* @vite-ignore */ MFE_URLS['@ras/mfe-production-management']),
    activeWhen: (location) => location.pathname.startsWith('/production'),
    customProps: { domElementGetter, getAuthState: () => window.__RAS_AUTH__ },
  });

  registerApplication({
    name: '@ras/mfe-reporting-management',
    app: () => import(/* @vite-ignore */ MFE_URLS['@ras/mfe-reporting-management']),
    activeWhen: (location) => location.pathname.startsWith('/reporting'),
    customProps: { domElementGetter, getAuthState: () => window.__RAS_AUTH__ },
  });
}

// ─── Check if user is authorized to mount a given MFE ────────────────────────
export function isAuthorizedForMfe(mfeName: string): boolean {
  const auth = window.__RAS_AUTH__;
  if (!auth?.isAuthenticated) return false;

  const requiredRoles = MFE_ROLE_GUARDS[mfeName];
  if (!requiredRoles || requiredRoles.length === 0) return true;

  return auth.hasAnyRole(requiredRoles);
}

let spaStarted = false;

// ─── Start Single-SPA (must be called after auth resolves) ────────────────────
/**
 * Waits for the auth state to resolve before starting Single-SPA.
 * Call this from main.tsx via the AuthProvider's onReady callback.
 */
export function startSingleSpa(): void {
  if (spaStarted) return;
  spaStarted = true;
  start({ urlRerouteOnly: true });
}
