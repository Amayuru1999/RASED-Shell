import { Router, Request, Response } from 'express';
import { Issuer, generators, Client } from 'openid-client';

let oidcClient: Client;

// ─── Initialize OIDC Client (called on server startup) ────────────────────────
export async function initOidcClient(): Promise<void> {
  const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
  const realm = process.env.KEYCLOAK_REALM || 'mites-users';
  const issuerUrl = `${keycloakUrl}/realms/${realm}`;

  const issuer = await Issuer.discover(issuerUrl);
  oidcClient = new issuer.Client({
    client_id: process.env.KEYCLOAK_CLIENT_ID || 'ras-bff',
    client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
    redirect_uris: [`${process.env.BFF_BASE_URL || 'http://localhost:8081'}/api/auth/callback`],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_basic',
  });
}

// ─── Extract Roles from JWT Payload ───────────────────────────────────────────
function extractRoles(accessToken: string, clientId: string): string[] {
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')
    );
    const realmRoles: string[] = payload?.realm_access?.roles || [];
    const clientRoles: string[] = payload?.resource_access?.[clientId]?.roles || [];
    return Array.from(new Set([...realmRoles, ...clientRoles])).filter(
      (r) => !r.startsWith('default-roles') && !r.startsWith('uma_') && !r.startsWith('offline_')
    );
  } catch (err) {
    // Structured error — never swallow silently
    console.error(JSON.stringify({
      level: 'ERROR',
      msg: 'Failed to extract roles from JWT',
      error: err instanceof Error ? err.message : String(err),
    }));
    return [];
  }
}

function determinePrimaryRole(roles: string[]): string {
  if (roles.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (roles.includes('EXCISE_OFFICER')) return 'EXCISE_OFFICER';
  if (roles.includes('DATA_ENTRY_OPERATOR')) return 'DATA_ENTRY_OPERATOR';
  if (roles.includes('AUDITOR')) return 'AUDITOR';
  return 'AUDITOR';
}

// ─── Auth Router ──────────────────────────────────────────────────────────────
export function createAuthRouter(): Router {
  const router = Router();

  /**
   * GET /api/auth/login
   * Initiates OIDC Authorization Code Flow → redirects to Keycloak
   */
  router.get('/login', (req: Request, res: Response) => {
    const nonce = generators.nonce();
    const state = generators.state();

    req.session.nonce = nonce;
    req.session.state = state;
    req.session.postLoginRedirect =
      (req.query.redirect as string) || process.env.SHELL_URL || 'http://localhost:9000';

    const authUrl = oidcClient.authorizationUrl({
      scope: 'openid profile email roles offline_access',
      state,
      nonce,
    });

    req.log?.info('Initiating OIDC login flow');
    res.redirect(authUrl);
  });

  /**
   * GET /api/auth/callback
   * Keycloak redirects here after successful login.
   * Exchanges code for tokens, stores in session, issues cookie.
   */
  router.get('/callback', async (req: Request, res: Response) => {
    try {
      const bffUrl = process.env.BFF_BASE_URL || 'http://localhost:8081';
      const callbackUrl = `${bffUrl}/api/auth/callback`;

      const params = oidcClient.callbackParams(req);
      const tokenSet = await oidcClient.callback(callbackUrl, params, {
        nonce: req.session.nonce,
        state: req.session.state,
      });

      // ── Store tokens ONLY in server-side session (never exposed to browser) ─
      req.session.tokens = {
        access_token: tokenSet.access_token!,
        id_token: tokenSet.id_token,
        refresh_token: tokenSet.refresh_token,
        expires_at: tokenSet.expires_at,
      };

      const clientId = process.env.KEYCLOAK_CLIENT_ID || 'ras-bff';
      const roles = extractRoles(tokenSet.access_token!, clientId);
      const claims = tokenSet.claims();

      req.session.user = {
        id: claims.sub,
        name: (claims.name as string) || (claims.preferred_username as string) || 'Unknown',
        email: (claims.email as string) || '',
        username: (claims.preferred_username as string) || '',
        roles,
        primaryRole: determinePrimaryRole(roles),
      };

      // Clean up OIDC transient state from session
      delete req.session.nonce;
      delete req.session.state;

      const redirectTo =
        req.session.postLoginRedirect || process.env.SHELL_URL || 'http://localhost:9000';
      delete req.session.postLoginRedirect;

      req.log?.info('Authentication callback successful', {
        userId: claims.sub,
        roles,
      });

      res.redirect(redirectTo);
    } catch (error) {
      req.log?.error('Auth callback failed', error);
      const shellUrl = process.env.SHELL_URL || 'http://localhost:9000';
      res.redirect(`${shellUrl}?error=auth_failed`);
    }
  });

  /**
   * GET /api/auth/me
   * Returns sanitized user profile — NO tokens exposed.
   * Includes expiresAt so the frontend can schedule silent refresh.
   */
  router.get('/me', (req: Request, res: Response) => {
    if (!req.session.user || !req.session.tokens) {
      return res.status(401).json({ authenticated: false });
    }

    // Check token expiry (with a small buffer to give client time to refresh)
    const expiresAt = req.session.tokens.expires_at;
    if (expiresAt && Date.now() / 1000 > expiresAt - 10) {
      req.log?.warn('/me: token expired or near-expiry, returning 401', { expiresAt });
      return res.status(401).json({
        authenticated: false,
        reason: 'token_expired',
      });
    }

    return res.json({
      authenticated: true,
      user: req.session.user,
      /** Exposed so frontend can schedule silent refresh (no token value exposed) */
      expiresAt,
    });
  });

  /**
   * POST /api/auth/refresh
   * Silently refreshes access token using the stored refresh_token.
   * Changed from GET → POST because this mutates server state (session).
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    if (!req.session.tokens?.refresh_token) {
      req.log?.warn('Refresh requested but no refresh token in session');
      return res.status(401).json({ error: 'No refresh token — please re-authenticate' });
    }

    try {
      const tokenSet = await oidcClient.refresh(req.session.tokens.refresh_token);

      req.session.tokens = {
        access_token: tokenSet.access_token!,
        id_token: tokenSet.id_token ?? req.session.tokens.id_token,
        refresh_token: tokenSet.refresh_token ?? req.session.tokens.refresh_token,
        expires_at: tokenSet.expires_at,
      };

      // Re-extract roles in case they changed during the session
      const clientId = process.env.KEYCLOAK_CLIENT_ID || 'ras-bff';
      const roles = extractRoles(tokenSet.access_token!, clientId);
      if (req.session.user) {
        req.session.user.roles = roles;
        req.session.user.primaryRole = determinePrimaryRole(roles);
      }

      req.log?.info('Token refresh successful', {
        userId: req.session.user?.id,
        expiresAt: tokenSet.expires_at,
      });

      return res.json({ success: true, expiresAt: tokenSet.expires_at });
    } catch (error) {
      req.log?.error('Token refresh failed — destroying session', error);
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          req.log?.error('Failed to destroy session after refresh failure', destroyErr);
        }
      });
      return res.status(401).json({ error: 'Refresh failed — please re-authenticate' });
    }
  });

  /**
   * GET /api/auth/logout
   * 1. Destroys local session + clears cookie
   * 2. Redirects to Keycloak end-session endpoint
   */
  router.get('/logout', (req: Request, res: Response) => {
    const idToken = req.session.tokens?.id_token;
    const shellUrl = process.env.SHELL_URL || 'http://localhost:9000';
    const userId = req.session.user?.id;

    req.session.destroy((err) => {
      if (err) {
        req.log?.error('Session destroy error during logout', err, { userId });
      } else {
        req.log?.info('User logged out — session destroyed', { userId });
      }

      // Clear the session cookie immediately
      res.clearCookie('ras.sid', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      // Redirect to Keycloak end-session if we have the id_token_hint
      if (idToken && oidcClient.issuer.metadata.end_session_endpoint) {
        const logoutUrl = oidcClient.endSessionUrl({
          id_token_hint: idToken,
          post_logout_redirect_uri: shellUrl,
        });
        return res.redirect(logoutUrl);
      }

      return res.redirect(shellUrl);
    });
  });

  return router;
}
