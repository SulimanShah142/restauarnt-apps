// 🚨 RATE LIMITER - Prevent Excessive API Requests
// Protects against infinite loops and billing surprises
// FREE tier: 50,000 requests/day = ~35 requests/minute

const RATE_LIMIT_CONFIG = {
  maxRequests: 10,
  windowMs: 60000,
  cooldownMs: 30000,
};

class RateLimiter {
  private requests: number[] = [];
  private isCooldown: boolean = false;
  private cooldownUntil: number = 0;
  private totalRequests: number = 0;
  private blockedRequests: number = 0;

  constructor(private config = RATE_LIMIT_CONFIG) {}

  checkLimit(): { allowed: boolean; remaining: number; retryAfter?: number } {
    const now = Date.now();

    if (this.isCooldown && now < this.cooldownUntil) {
      const retryAfter = Math.ceil((this.cooldownUntil - now) / 1000);
      this.blockedRequests++;
      return { allowed: false, remaining: 0, retryAfter };
    }

    if (this.isCooldown && now >= this.cooldownUntil) {
      this.isCooldown = false;
      this.requests = [];
    }

    this.requests = this.requests.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );

    if (this.requests.length < this.config.maxRequests) {
      this.requests.push(now);
      this.totalRequests++;
      return { allowed: true, remaining: this.config.maxRequests - this.requests.length };
    }

    this.isCooldown = true;
    this.cooldownUntil = now + this.config.cooldownMs;
    this.blockedRequests++;

    console.warn(`[RateLimiter] ⚠️ Rate limit exceeded! Cooldown: ${this.config.cooldownMs / 1000}s`);

    return { allowed: false, remaining: 0, retryAfter: Math.ceil(this.config.cooldownMs / 1000) };
  }

  getStats() {
    const now = Date.now();
    const activeRequests = this.requests.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    ).length;

    return {
      totalRequests: this.totalRequests,
      blockedRequests: this.blockedRequests,
      activeRequestsInWindow: activeRequests,
      isCooldown: this.isCooldown,
    };
  }

  reset() {
    this.requests = [];
    this.isCooldown = false;
  }
}

export const rateLimiters = {
  mapTiles: new RateLimiter({ maxRequests: 20, windowMs: 60000, cooldownMs: 30000 }),
  routing: new RateLimiter({ maxRequests: 10, windowMs: 60000, cooldownMs: 60000 }),
  locationUpdates: new RateLimiter({ maxRequests: 30, windowMs: 60000, cooldownMs: 20000 }),
  apiCalls: new RateLimiter({ maxRequests: 15, windowMs: 60000, cooldownMs: 45000 }),
};

export function checkRateLimit(limiterName: keyof typeof rateLimiters, operation: string): boolean {
  const limiter = rateLimiters[limiterName];
  const result = limiter.checkLimit();

  if (!result.allowed) {
    console.warn(`[RateLimit] 🚫 ${operation} blocked - Retry after ${result.retryAfter}s`);
    return false;
  }

  if (result.remaining <= 2) {
    console.warn(`[RateLimit] ⚠️ ${operation} - Only ${result.remaining} requests left`);
  }

  return true;
}

export default RateLimiter;
