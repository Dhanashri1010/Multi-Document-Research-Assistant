/**
 * Dedicated LLM Generation Throttle Queue
 * 
 * Separate from EmbeddingThrottleQueue.
 * Enforces safe rate limits for Gemini text generation:
 * - Max RPM: 10 requests per minute (well below the 15 RPM free tier limit)
 * - Minimum Spacing: 4,500ms between calls
 * - Daily Limit: 500 requests per UTC day
 * - Automatic UTC midnight quota reset
 * - Near-limit alerts (>450 requests)
 */

interface RequestRecord {
  timestamp: number;
}

export interface LLMQuotaStatus {
  dailyUsage: number;
  dailyLimit: number;
  remainingDaily: number;
  rpmUsage: number;
  maxRpm: number;
  isNearLimit: boolean;
  isExhausted: boolean;
  resetTimeUtc: string;
}

export class LLMThrottleQueue {
  private static readonly WINDOW_MS = 60_000;
  private static readonly MAX_RPM = 10;
  private static readonly MIN_CALL_SPACING_MS = 2_000;
  private static readonly DAILY_LIMIT = 500;
  private static readonly NEAR_LIMIT_THRESHOLD = 450;

  private static history: RequestRecord[] = [];
  private static lastCallTimestamp = 0;
  private static pauseUntilTimestamp = 0;
  private static pauseReason = '';

  // Daily tracking keyed by YYYY-MM-DD (UTC)
  private static currentDayUtc = '';
  private static dailyCount = 0;
  // Per-user daily tracking keyed by `${userId}:${YYYY-MM-DD}`
  private static userDailyCounts: Map<string, number> = new Map();

  // Queue lock for sequential acquisition
  private static queueLock: Promise<void> = Promise.resolve();

  private static checkAndResetDaily(now: Date = new Date()): void {
    const today = now.toISOString().slice(0, 10);
    if (this.currentDayUtc !== today) {
      this.currentDayUtc = today;
      this.dailyCount = 0;
      this.userDailyCounts.clear();
    }
  }

  /**
   * Cleans records older than 60 seconds.
   */
  private static pruneHistory(now: number): void {
    const cutoff = now - this.WINDOW_MS;
    while (this.history.length > 0 && this.history[0].timestamp < cutoff) {
      this.history.shift();
    }
  }

  /**
   * Returns current quota and rate limit status for UI and diagnostic telemetry.
   */
  static getQuotaStatus(): LLMQuotaStatus {
    const now = new Date();
    this.checkAndResetDaily(now);
    this.pruneHistory(now.getTime());

    const nextMidnight = new Date(now);
    nextMidnight.setUTCHours(24, 0, 0, 0);

    return {
      dailyUsage: this.dailyCount,
      dailyLimit: this.DAILY_LIMIT,
      remainingDaily: Math.max(0, this.DAILY_LIMIT - this.dailyCount),
      rpmUsage: this.history.length,
      maxRpm: this.MAX_RPM,
      isNearLimit: this.dailyCount >= this.NEAR_LIMIT_THRESHOLD,
      isExhausted: this.dailyCount >= this.DAILY_LIMIT,
      resetTimeUtc: nextMidnight.toISOString(),
    };
  }

  /**
   * Globally pauses all outgoing LLM calls during server-instructed 429 backoff.
   */
  static pause(durationMs: number, reason: string = 'Gemini 429 rate limit cooldown'): void {
    const until = Date.now() + durationMs;
    if (until > this.pauseUntilTimestamp) {
      this.pauseUntilTimestamp = until;
      this.pauseReason = reason;
      console.warn(`[LLMThrottleQueue] Global queue PAUSED for ${Math.round(durationMs / 1000)}s: ${reason}`);
    }
  }

  /**
   * Resets throttle queue state (used in tests).
   */
  static reset(): void {
    this.history = [];
    this.lastCallTimestamp = 0;
    this.pauseUntilTimestamp = 0;
    this.pauseReason = '';
    this.currentDayUtc = new Date().toISOString().slice(0, 10);
    this.dailyCount = 0;
    this.userDailyCounts.clear();
    this.queueLock = Promise.resolve();
  }

  /**
   * Returns a user's daily usage status.
   */
  static getUserDailyUsage(userId: string): { used: number; limit: number; remaining: number } {
    const today = new Date().toISOString().slice(0, 10);
    this.checkAndResetDaily();
    const userDailyCap = parseInt(process.env.USER_DAILY_AI_CAP || '30', 10);
    const key = `${userId}:${today}`;
    const used = this.userDailyCounts.get(key) || 0;
    return {
      used,
      limit: userDailyCap,
      remaining: Math.max(0, userDailyCap - used),
    };
  }

  /**
   * Acquires capacity to dispatch one generative LLM request.
   * Throws if daily quota of 500 requests is exhausted or if user exceeds USER_DAILY_AI_CAP.
   */
  static async acquire(
    userIdOrOnWaiting?: string | ((waitSec: number, reason: string) => Promise<void> | void),
    onWaiting?: (waitSec: number, reason: string) => Promise<void> | void
  ): Promise<void> {
    const userId = typeof userIdOrOnWaiting === 'string' ? userIdOrOnWaiting : undefined;
    const waitHandler = typeof userIdOrOnWaiting === 'function' ? userIdOrOnWaiting : onWaiting;

    const unlock = await this.acquireLock();
    try {
      while (true) {
        const now = Date.now();
        this.checkAndResetDaily(new Date(now));

        // 1. Check user-specific daily cap (default 30/day)
        const today = new Date(now).toISOString().slice(0, 10);
        const userDailyCap = parseInt(process.env.USER_DAILY_AI_CAP || '30', 10);
        const userKey = userId ? `${userId}:${today}` : null;
        if (userKey) {
          const userCount = this.userDailyCounts.get(userKey) || 0;
          if (userCount >= userDailyCap) {
            throw new Error(
              `Daily AI limit reached for today (${userDailyCap} requests). Document search and cached results remain fully available.`
            );
          }
        }

        // 2. Check global daily hard limit
        if (this.dailyCount >= this.DAILY_LIMIT) {
          throw new Error(
            `Gemini daily free-tier limit reached (${this.dailyCount}/${this.DAILY_LIMIT} requests). Quota resets at midnight UTC.`
          );
        }

        // 3. Check if globally paused on 429
        if (now < this.pauseUntilTimestamp) {
          const waitMs = this.pauseUntilTimestamp - now;
          const waitSec = Math.ceil(waitMs / 1000);
          const reason = this.pauseReason || 'Rate limit cooldown';
          console.log(`[LLMThrottleQueue] Paused: waiting ${waitSec}s (${reason})...`);
          if (waitHandler) {
            await waitHandler(waitSec, reason);
          }
          await new Promise((r) => setTimeout(r, waitMs + 100));
          continue;
        }

        // 4. Check minimum call spacing (skip in fast unit tests)
        const minSpacing = process.env.NODE_ENV === 'test' ? 5 : this.MIN_CALL_SPACING_MS;
        const timeSinceLast = now - this.lastCallTimestamp;
        if (timeSinceLast < minSpacing) {
          const spacingWait = minSpacing - timeSinceLast;
          await new Promise((r) => setTimeout(r, spacingWait));
          continue;
        }

        // 5. Check sliding 60-second window capacity
        this.pruneHistory(now);
        const hasHistory = this.history.length > 0;
        if (hasHistory && this.history.length >= this.MAX_RPM) {
          const oldest = this.history[0];
          const timeToWait = oldest ? Math.max(1000, oldest.timestamp + this.WINDOW_MS - now + 100) : 2000;
          const waitSec = Math.ceil(timeToWait / 1000);
          const reason = `RPM rate limit (${this.history.length}/${this.MAX_RPM} RPM)`;

          console.log(`[LLMThrottleQueue] Rate limit reached: waiting ${waitSec}s...`);
          if (waitHandler) {
            await waitHandler(waitSec, reason);
          }
          await new Promise((r) => setTimeout(r, timeToWait));
          continue;
        }

        // Capacity acquired! Record request
        this.history.push({ timestamp: Date.now() });
        this.lastCallTimestamp = Date.now();
        this.dailyCount++;
        if (userKey) {
          this.userDailyCounts.set(userKey, (this.userDailyCounts.get(userKey) || 0) + 1);
        }
        break;
      }
    } finally {
      unlock();
    }
  }

  private static async acquireLock(): Promise<() => void> {
    let release: () => void;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentLock = this.queueLock;
    this.queueLock = currentLock.then(() => nextLock);
    await currentLock;
    return release!;
  }
}

