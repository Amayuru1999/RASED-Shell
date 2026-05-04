import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const isProduction = process.env.NODE_ENV === 'production';

// Initialize Redis Client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.connect().catch((err) => {
  console.error('❌ Redis Connection Error:', err);
});

export const sessionMiddleware = session({
  store: new RedisStore({ client: redisClient }),
  name: 'ras.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,          // HTTPS only in production
    sameSite: 'lax',               // Allows OAuth redirects
    maxAge: 8 * 60 * 60 * 1000,   // 8 hours
  },
});

// Augment express-session types
declare module 'express-session' {
  interface SessionData {
    tokens?: {
      access_token: string;
      id_token?: string;
      refresh_token?: string;
      expires_at?: number;
    };
    user?: {
      id: string;
      name: string;
      email: string;
      username: string;
      roles: string[];
      primaryRole: string;
      permissions?: string[];
    };
    nonce?: string;
    state?: string;
    postLoginRedirect?: string;
    csrfToken?: string;
  }
}

