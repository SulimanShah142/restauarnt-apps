// 🚨 RATE LIMITER - Prevent Excessive API Requests
// Protects against infinite loops and billing surprises
// FREE tier: 50,000 requests/day = ~35 requests/minute

// Type declarations for web globals
declare const window: any;

const RATE_LIMIT_CONFIG = {
  // Maximum requests per window
  maxRequests: 10,  // Conservative limit
  // Time window in milliseconds
  windowMs: 60000,  // 1 minute window
  // Cooldown period when limit exceeded
  cooldownMs: 30000,  // 30 seconds cooldown
};

class RateLimiter {
  private requests: number[] = [];
  private isCooldown: boolean = false;
  private cooldownUntil: number = 0;
  private totalRequests: number = 0;
  private blockedRequests: number = 0;

  constructor(private config = RATE_LIMIT_CONFIG) {}

  /**
   * Check if request is allowed
   * Returns: { allowed: boolean, remaining: number, retryAfter?: number }
   */
  checkLimit(): { allowed: boolean; remaining: number; retryAfter?: number } {
    const now = Date.now();

    // Check if in cooldown mode
    if (this.isCooldown && now < this.cooldownUntil) {
      const retryAfter = Math.ceil((this.cooldownUntil - now) / 1000);
      this.blockedRequests++;
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
      };
    }

    // Exit cooldown if time passed
    if (this.isCooldown && now >= this.cooldownUntil) {
      this.isCooldown = false;
      this.requests = [];
    }

    // Remove old requests outside window
    this.requests = this.requests.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );

    // Check if under limit
    if (this.requests.length < this.config.maxRequests) {
      this.requests.push(now);
      this.totalRequests++;
      const remaining = this.config.maxRequests - this.requests.length;
      return {
        allowed: true,
        remaining,
      };
    }

    // Rate limit exceeded - enter cooldown
    this.isCooldown = true;
    this.cooldownUntil = now + this.config.cooldownMs;
    this.blockedRequests++;

    // console.warn(
    //   `[RateLimiter] ⚠️ Rate limit exceeded! Blocked for ${this.config.cooldownMs / 1000}s`
    // );

    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(this.config.cooldownMs / 1000),
    };
  }

  /**
   * Get current stats
   */
  getStats() {
    const now = Date.now();
    const activeRequests = this.requests.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    ).length;

    return {
      totalRequests: this.totalRequests,
      blockedRequests: this.blockedRequests,
      activeRequestsInWindow: activeRequests,
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
      isCooldown: this.isCooldown,
      cooldownRemaining: this.isCooldown
        ? Math.max(0, Math.ceil((this.cooldownUntil - now) / 1000))
        : 0,
    };
  }

  /**
   * Reset limiter (useful for debugging)
   */
  reset() {
    this.requests = [];
    this.isCooldown = false;
    this.cooldownUntil = 0;
  }
}

// Create shared rate limiters for different operations
export const rateLimiters = {
  // Map tile requests (most frequent)
  mapTiles: new RateLimiter({
    maxRequests: 20,  // Higher for map tiles
    windowMs: 60000,
    cooldownMs: 30000,
  }),

  // Routing requests (expensive)
  routing: new RateLimiter({
    maxRequests: 10,  // Conservative for routing
    windowMs: 60000,
    cooldownMs: 60000,  // 1 minute cooldown
  }),

  // Location updates (very frequent)
  locationUpdates: new RateLimiter({
    maxRequests: 30,  // Higher for location tracking
    windowMs: 60000,
    cooldownMs: 20000,
  }),

  // API calls (general)
  apiCalls: new RateLimiter({
    maxRequests: 15,
    windowMs: 60000,
    cooldownMs: 45000,
  }),
};

/**
 * Helper function to check rate limit and log warning
 */
export function checkRateLimit(
  limiterName: keyof typeof rateLimiters,
  operation: string
): boolean {
  const limiter = rateLimiters[limiterName];
  const result = limiter.checkLimit();

  if (!result.allowed) {
    // console.warn(
    //   `[RateLimit] 🚫 ${operation} blocked - Rate limit exceeded. Retry after ${result.retryAfter}s`
    // );

    // Show user-friendly message if in browser/app
    if (typeof window !== 'undefined') {
      // Could show toast/notification here
      // console.warn(
      //   `[RateLimit] Please wait ${result.retryAfter} seconds before trying again`
      // );
    }

    return false;
  }

  if (result.remaining <= 2) {
    // console.warn(
    //   `[RateLimit] ⚠️ ${operation} - Only ${result.remaining} requests remaining this minute`
    // );
  }

  return true;
}

/**
 * Log rate limiter stats periodically (for debugging)
 */
export function logRateLimiterStats() {
  Object.entries(rateLimiters).forEach(([name, limiter]) => {
    const stats = limiter.getStats();
    // console.log(`[RateLimiter] ${name}: ${stats.totalRequests} requests in last ${stats.windowMs / 1000}s`);
  });
}

// Auto-log stats every 5 minutes (for debugging)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    logRateLimiterStats();
  }, 300000); // 5 minutes
}

export default RateLimiter;
