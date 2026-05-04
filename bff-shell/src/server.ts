import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { sessionMiddleware } from './middleware/session';
import { corsMiddleware } from './middleware/cors';
import { requestLoggerMiddleware, appLogger } from './middleware/logger';
import { createAuthRouter, initOidcClient } from './auth/authRoutes';
import { createCsrfRouter } from './middleware/csrf';

const app = express();
const PORT = parseInt(process.env.PORT || '8081', 10);

// ─── Security ──────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Handled by shell-app
  })
);

// ─── Core Middleware ───────────────────────────────────────────────────────────
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

// ─── Structured Request Logging ───────────────────────────────────────────────
// Must be after session middleware so req.session.user is available for logging
app.use(requestLoggerMiddleware);

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bff-shell', timestamp: new Date().toISOString() });
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    await initOidcClient();
    appLogger.info('OIDC Client initialized successfully');

    // Register CSRF token route (before auth routes)
    app.use('/api/auth', createCsrfRouter());

    // Register auth routes after OIDC client is ready
    app.use('/api/auth', createAuthRouter());

    app.listen(PORT, () => {
      appLogger.info('BFF Shell started', {
        port: PORT,
        keycloak: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`,
        health: `http://localhost:${PORT}/health`,
      });
    });
  } catch (error) {
    appLogger.error('Failed to initialize OIDC client — shutting down', error, {
      hint: 'Ensure Keycloak is running and ras-bff client is configured',
    });
    process.exit(1);
  }
}

bootstrap();
