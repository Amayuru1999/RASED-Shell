/**
 * CSRF Protection Middleware — Double-Submit Cookie Pattern
 *
 * How it works:
 *  1. On GET /api/auth/csrf-token, the BFF generates a cryptographically
 *     random token, stores it in the server-side session, and returns it
 *     as JSON.
 *  2. The frontend (httpClient.ts) reads this token and includes it as
 *     X-CSRF-Token header on all state-mutating requests (POST/PUT/PATCH/DELETE).
 *  3. The `csrfProtection` middleware validates that header against the token
 *     stored in the session.
 *
 * Why not csurf? The `csurf` npm package is deprecated. This implementation
 * achieves the same result with zero additional dependencies.
 *
 * Note: CSRF only matters for cookie-based sessions. Endpoints that use
 * Bearer token auth do not need this protection.
 */
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ─── Token Generation ─────────────────────────────────────────────────────────
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Session type augmentation ────────────────────────────────────────────────
declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
  }
}

// ─── CSRF Token Route ─────────────────────────────────────────────────────────
/**
 * GET /api/auth/csrf-token
 * Returns a CSRF token tied to the current session.
 * Call this once on app init and store the token in httpClient.
 */
export function createCsrfRouter(): Router {
  const router = Router();

  router.get('/csrf-token', (req: Request, res: Response) => {
    // Reuse the existing token for this session (stable per-session)
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateCsrfToken();
    }
    res.json({ csrfToken: req.session.csrfToken });
  });

  return router;
}

// ─── CSRF Validation Middleware ────────────────────────────────────────────────
/**
 * Validates the X-CSRF-Token header against the session-stored token.
 * Apply to any route that mutates state (POST, PUT, PATCH, DELETE).
 *
 * @example
 * router.post('/api/some-route', csrfProtection, handler);
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Only protect state-mutating methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  const sessionToken = req.session?.csrfToken;
  const headerToken = req.headers['x-csrf-token'] as string | undefined;

  if (!sessionToken || !headerToken) {
    req.log?.warn('CSRF token missing', { method: req.method, path: req.path });
    res.status(403).json({ error: 'CSRF token required' });
    return;
  }

  // Use timingSafeEqual to prevent timing attacks
  const sessionBuf = Buffer.from(sessionToken, 'hex');
  const headerBuf = Buffer.from(headerToken, 'hex');

  if (
    sessionBuf.length !== headerBuf.length ||
    !crypto.timingSafeEqual(sessionBuf, headerBuf)
  ) {
    req.log?.warn('CSRF token mismatch', { method: req.method, path: req.path });
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }

  next();
}
