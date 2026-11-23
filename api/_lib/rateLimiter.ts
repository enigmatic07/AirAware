import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

interface RateLimitRecord {
  timestamps: number[];
}

const windowMs = 60 * 1000; // 60-second sliding window
export const DEFAULT_LIMIT = 25; // 25 requests per minute for anonymous users
export const AUTH_LIMIT = 60; // 60 requests per minute for authenticated users

const inMemoryStore = new Map<string, RateLimitRecord>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
  limit: number;
  provider: 'upstash' | 'in_memory_fallback';
  statusCode?: number;
  error?: string;
}

// Client cache for Upstash limiters
let cachedUrl: string | undefined;
let cachedToken: string | undefined;
let redisClient: Redis | null = null;
let upstashAnonLimiter: Ratelimit | null = null;
let upstashAuthLimiter: Ratelimit | null = null;

/**
 * Returns or instantiates the Upstash Redis rate limiters.
 * Recreates instances if environment variables change.
 */
export function getUpstashLimiters(): {
  redisClient: Redis;
  anonLimiter: Ratelimit;
  authLimiter: Ratelimit;
} | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    redisClient = null;
    upstashAnonLimiter = null;
    upstashAuthLimiter = null;
    cachedUrl = undefined;
    cachedToken = undefined;
    return null;
  }

  if (
    url === cachedUrl &&
    token === cachedToken &&
    redisClient &&
    upstashAnonLimiter &&
    upstashAuthLimiter
  ) {
    return { redisClient, anonLimiter: upstashAnonLimiter, authLimiter: upstashAuthLimiter };
  }

  try {
    cachedUrl = url;
    cachedToken = token;
    redisClient = new Redis({
      url,
      token,
    });

    upstashAnonLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(DEFAULT_LIMIT, '60 s'),
      prefix: 'airaware:anon',
    });

    upstashAuthLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(AUTH_LIMIT, '60 s'),
      prefix: 'airaware:auth',
    });

    return { redisClient, anonLimiter: upstashAnonLimiter, authLimiter: upstashAuthLimiter };
  } catch (err: any) {
    console.error('[RateLimiter] Error initializing Upstash Redis client:', err.message);
    return null;
  }
}

let lastCleanup = Date.now();
function cleanupInMemory() {
  const now = Date.now();
  if (now - lastCleanup < windowMs) return;
  lastCleanup = now;

  for (const [key, record] of inMemoryStore.entries()) {
    const active = record.timestamps.filter(t => now - t < windowMs);
    if (active.length === 0) {
      inMemoryStore.delete(key);
    } else {
      record.timestamps = active;
    }
  }
}

/**
 * In-memory sliding window fallback limiter.
 * Strictly permitted ONLY in development / test environments.
 */
function checkInMemoryRateLimit(
  key: string,
  isAuthenticated: boolean
): RateLimitResult {
  cleanupInMemory();
  const maxRequests = isAuthenticated ? AUTH_LIMIT : DEFAULT_LIMIT;
  const now = Date.now();
  const record = inMemoryStore.get(key) || { timestamps: [] };

  record.timestamps = record.timestamps.filter(t => now - t < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetSeconds,
      limit: maxRequests,
      provider: 'in_memory_fallback',
      statusCode: 429,
      error: `Rate limit exceeded. Please wait ${resetSeconds} seconds before trying again.`,
    };
  }

  record.timestamps.push(now);
  inMemoryStore.set(key, record);

  return {
    allowed: true,
    remaining: maxRequests - record.timestamps.length,
    resetSeconds: Math.ceil(windowMs / 1000),
    limit: maxRequests,
    provider: 'in_memory_fallback',
    statusCode: 200,
  };
}

/**
 * Resets in-memory storage (used for isolated unit testing).
 */
export function resetInMemoryStore() {
  inMemoryStore.clear();
}

/**
 * Central rate limiting function.
 *
 * PRODUCTION BEHAVIOR (Fail-Closed):
 * - NODE_ENV === 'production' requires valid Upstash Redis configuration.
 * - If Redis credentials are missing or the Redis call fails, rejects request with HTTP 503.
 * - NEVER silently downgrades to in-memory rate limiting in production.
 *
 * DEVELOPMENT BEHAVIOR:
 * - Uses Upstash if configured, otherwise safely falls back to local in-memory sliding window.
 */
export async function checkRateLimit(
  key: string,
  isAuthenticated: boolean = false
): Promise<RateLimitResult> {
  const maxRequests = isAuthenticated ? AUTH_LIMIT : DEFAULT_LIMIT;
  const isProduction = process.env.NODE_ENV === 'production';

  const limiters = getUpstashLimiters();

  // 1. Production Mode: Strict Fail-Closed Distributed Rate Limiting
  if (isProduction) {
    if (!limiters) {
      console.error(
        '[RateLimiter] [FAIL-CLOSED] Production requires valid Upstash Redis credentials (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN). Rejecting with HTTP 503.'
      );
      return {
        allowed: false,
        remaining: 0,
        resetSeconds: 60,
        limit: maxRequests,
        provider: 'upstash',
        statusCode: 503,
        error: 'Rate limit service unavailable in production. Distributed storage credentials not configured.',
      };
    }

    try {
      const limiter = isAuthenticated ? limiters.authLimiter : limiters.anonLimiter;
      const result = await limiter.limit(key);
      const resetSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));

      return {
        allowed: result.success,
        remaining: result.remaining,
        resetSeconds,
        limit: maxRequests,
        provider: 'upstash',
        statusCode: result.success ? 200 : 429,
        error: result.success
          ? undefined
          : `Rate limit exceeded. Please wait ${resetSeconds} seconds before trying again.`,
      };
    } catch (err: any) {
      console.error(
        `[RateLimiter] [FAIL-CLOSED] Upstash Redis service call failed in production (${err.message}). Rejecting with HTTP 503.`
      );
      return {
        allowed: false,
        remaining: 0,
        resetSeconds: 60,
        limit: maxRequests,
        provider: 'upstash',
        statusCode: 503,
        error: 'Rate limit service temporarily unavailable in production.',
      };
    }
  }

  // 2. Non-Production Mode (development / tests)
  if (limiters) {
    try {
      const limiter = isAuthenticated ? limiters.authLimiter : limiters.anonLimiter;
      const result = await limiter.limit(key);
      const resetSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));

      return {
        allowed: result.success,
        remaining: result.remaining,
        resetSeconds,
        limit: maxRequests,
        provider: 'upstash',
        statusCode: result.success ? 200 : 429,
        error: result.success
          ? undefined
          : `Rate limit exceeded. Please wait ${resetSeconds} seconds before trying again.`,
      };
    } catch (err: any) {
      console.warn(
        `[RateLimiter] Non-production Upstash Redis call failed (${err.message}). Falling back to in-memory rate limiter.`
      );
    }
  }

  // Fallback to in-memory sliding window (permitted only when NODE_ENV !== 'production')
  return checkInMemoryRateLimit(key, isAuthenticated);
}

export function getClientIp(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}
