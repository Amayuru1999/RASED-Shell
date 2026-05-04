/**
 * httpClient — Production fetch wrapper for the RAS microfrontend platform.
 *
 * Features:
 *  - Automatic CSRF header injection (X-CSRF-Token)
 *  - 401 → silent token refresh → retry original request
 *  - Retry queue: requests that arrive during an in-flight refresh are queued
 *    and replayed after the refresh completes (or rejected if refresh fails)
 *  - Fallback to logout if refresh itself fails
 *  - Structured error logging (no silent swallowing)
 *  - Typed ApiError thrown on non-OK responses
 */

import type { ApiError } from '@ras/shared';

// ─── Types ────────────────────────────────────────────────────────────────────
interface HttpClientOptions {
  /** Base URL prepended to every request path */
  baseUrl: string;
  /** BFF base URL — used for refresh & logout calls */
  bffUrl?: string;
}

type RequestQueueItem = {
  resolve: (value: Response) => void;
  reject: (reason: unknown) => void;
  fn: () => Promise<Response>;
};

// ─── Module-level state ───────────────────────────────────────────────────────
/** True while a refresh request is in-flight — prevents parallel refresh storms */
let isRefreshing = false;

/** Queue of requests that arrived while a refresh was in-flight */
const refreshQueue: RequestQueueItem[] = [];

/**
 * Drains the retry queue after a refresh.
 * @param success - if true, all queued requests are retried; if false, all are rejected.
 * @param error   - error passed to rejected requests
 */
function drainQueue(success: boolean, error?: unknown): void {
  const queue = [...refreshQueue];
  refreshQueue.length = 0; // clear atomically

  for (const item of queue) {
    if (success) {
      item.fn().then(item.resolve).catch(item.reject);
    } else {
      item.reject(error);
    }
  }
}

// ─── CSRF Token Cache ─────────────────────────────────────────────────────────
let csrfToken: string | null = null;

async function fetchCsrfToken(bffUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${bffUrl}/api/auth/csrf-token`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken ?? null;
      return csrfToken;
    }
  } catch (err) {
    console.warn('[httpClient] Failed to fetch CSRF token', err);
  }
  return null;
}

// ─── Logger ───────────────────────────────────────────────────────────────────
const logger = {
  warn: (msg: string, ctx?: unknown) => console.warn(`[httpClient] ${msg}`, ctx ?? ''),
  error: (msg: string, ctx?: unknown) => console.error(`[httpClient] ${msg}`, ctx ?? ''),
};

// ─── Factory ──────────────────────────────────────────────────────────────────
/**
 * Creates a typed HTTP client bound to a specific base URL.
 *
 * @example
 * const api = createHttpClient({ baseUrl: 'http://localhost:8082' });
 * const users = await api.get<User[]>('/api/users');
 */
export function createHttpClient({ baseUrl, bffUrl = import.meta.env.VITE_BFF_URL as string }: HttpClientOptions) {
  // ─── Core fetch with interceptors ─────────────────────────────────────────
  async function coreFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${baseUrl}${path}`;

    // Build headers
    const headers = new Headers(init.headers);
    headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');

    // Inject CSRF token for state-mutating methods
    const method = (init.method ?? 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (!csrfToken) {
        await fetchCsrfToken(bffUrl);
      }
      if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken);
      }
    }

    const response = await fetch(url, {
      ...init,
      credentials: 'include',
      headers,
    });

    // ── 401 handling with refresh + retry ───────────────────────────────────
    if (response.status === 401) {
      if (isRefreshing) {
        // Queue this request until the in-flight refresh completes
        return new Promise<Response>((resolve, reject) => {
          refreshQueue.push({
            resolve,
            reject,
            fn: () => coreFetch(path, init),
          });
        });
      }

      logger.warn('Received 401 — attempting silent refresh', { url });
      isRefreshing = true;
      csrfToken = null; // invalidate CSRF token after session change

      try {
        const refreshRes = await fetch(`${bffUrl}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshRes.ok) {
          isRefreshing = false;
          drainQueue(true);
          // Retry the original request with a fresh session
          return coreFetch(path, init);
        } else {
          throw new Error(`Refresh failed with status ${refreshRes.status}`);
        }
      } catch (refreshError) {
        isRefreshing = false;
        drainQueue(false, refreshError);
        logger.error('Silent refresh failed — triggering logout', refreshError);
        // Trigger logout via global (avoids circular import)
        window.__RAS_AUTH__?.logout();
        throw refreshError;
      }
    }

    return response;
  }

  // ─── Response parser ────────────────────────────────────────────────────────
  async function parseResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorBody: Partial<ApiError> = { message: response.statusText, statusCode: response.status };
      try {
        errorBody = await response.json();
      } catch {
        // Body is not JSON — use default
      }
      const apiError: ApiError = {
        message: errorBody.message ?? response.statusText,
        statusCode: response.status,
        details: errorBody.details,
      };
      logger.error('API error response', apiError);
      throw apiError;
    }

    // 204 No Content
    if (response.status === 204) return undefined as unknown as T;

    return response.json() as Promise<T>;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────
  return {
    /** GET request, returns parsed JSON of type T */
    async get<T>(path: string, init?: RequestInit): Promise<T> {
      const res = await coreFetch(path, { ...init, method: 'GET' });
      return parseResponse<T>(res);
    },

    /** POST request, sends JSON body, returns parsed JSON of type T */
    async post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
      const res = await coreFetch(path, {
        ...init,
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return parseResponse<T>(res);
    },

    /** PUT request, sends JSON body, returns parsed JSON of type T */
    async put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
      const res = await coreFetch(path, {
        ...init,
        method: 'PUT',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return parseResponse<T>(res);
    },

    /** PATCH request, sends JSON body, returns parsed JSON of type T */
    async patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
      const res = await coreFetch(path, {
        ...init,
        method: 'PATCH',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return parseResponse<T>(res);
    },

    /** DELETE request, returns parsed JSON of type T */
    async delete<T>(path: string, init?: RequestInit): Promise<T> {
      const res = await coreFetch(path, { ...init, method: 'DELETE' });
      return parseResponse<T>(res);
    },
  };
}

// ─── Convenience singleton for the BFF shell ─────────────────────────────────
/**
 * Pre-configured client targeting the BFF shell.
 * Import this directly in shell-internal code.
 *
 * @example
 * import { shellApi } from '@/lib/httpClient';
 * const user = await shellApi.get<AuthUser>('/api/auth/me');
 */
export const shellApi = createHttpClient({
  baseUrl: import.meta.env.VITE_BFF_URL as string,
});
