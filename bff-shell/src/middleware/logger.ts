/**
 * Structured logger middleware for BFF Shell.
 *
 * - Every incoming request gets a unique requestId (X-Request-Id header or generated)
 * - Logs method, path, status, duration on response finish
 * - Provides a contextual logger that includes requestId + userId in every log line
 * - No sensitive data (tokens, secrets) logged
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RequestLogger {
  info: (msg: string, ctx?: Record<string, unknown>) => void;
  warn: (msg: string, ctx?: Record<string, unknown>) => void;
  error: (msg: string, error?: unknown, ctx?: Record<string, unknown>) => void;
}

// Augment Express Request with typed logger
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      log: RequestLogger;
    }
  }
}

// ─── Log formatter ────────────────────────────────────────────────────────────
function formatLog(
  level: 'INFO' | 'WARN' | 'ERROR',
  requestId: string,
  userId: string | undefined,
  msg: string,
  ctx?: Record<string, unknown>
): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    requestId,
    userId: userId ?? 'anonymous',
    msg,
    ...ctx,
  };
  return JSON.stringify(entry);
}

// ─── Request Logger Factory ───────────────────────────────────────────────────
function createRequestLogger(requestId: string, userId?: string): RequestLogger {
  return {
    info: (msg, ctx) => console.info(formatLog('INFO', requestId, userId, msg, ctx)),
    warn: (msg, ctx) => console.warn(formatLog('WARN', requestId, userId, msg, ctx)),
    error: (msg, error, ctx) => {
      const errCtx =
        error instanceof Error
          ? { errorMessage: error.message, stack: error.stack, ...ctx }
          : { error: String(error), ...ctx };
      console.error(formatLog('ERROR', requestId, userId, msg, errCtx));
    },
  };
}

// ─── Request Logging Middleware ───────────────────────────────────────────────
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId =
    (req.headers['x-request-id'] as string) || crypto.randomUUID();
  const userId = req.session?.user?.id;
  const startedAt = Date.now();

  req.requestId = requestId;
  req.log = createRequestLogger(requestId, userId);

  // Set the requestId on the response for tracing
  res.setHeader('X-Request-Id', requestId);

  req.log.info('Request received', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    const logger = createRequestLogger(requestId, req.session?.user?.id);

    const log = level === 'ERROR'
      ? logger.error.bind(logger)
      : level === 'WARN'
        ? logger.warn.bind(logger)
        : logger.info.bind(logger);

    if (level === 'ERROR') {
      logger.error('Request completed', undefined, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
      });
    } else {
      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
      });
    }
  });

  next();
}

// ─── Standalone logger for use outside request context ────────────────────────
export const appLogger = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    console.info(formatLog('INFO', 'system', undefined, msg, ctx)),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    console.warn(formatLog('WARN', 'system', undefined, msg, ctx)),
  error: (msg: string, error?: unknown, ctx?: Record<string, unknown>) => {
    const errCtx =
      error instanceof Error
        ? { errorMessage: error.message, stack: error.stack, ...ctx }
        : { error: String(error), ...ctx };
    console.error(formatLog('ERROR', 'system', undefined, msg, errCtx));
  },
};
