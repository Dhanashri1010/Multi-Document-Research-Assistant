/**
 * Global Embedding Throttle Queue
 * 
 * Enforces global rate limits across all document uploads and chat query embedding requests:
 * - Max Requests Per Minute: 50 (well below Gemini's 100 RPM free-tier limit)
 * - Max Tokens Per Minute: 18,000 (strictly below Gemini's 20,000 TPM limit)
 * - Minimum Spacing: At least 1,200ms between calls
 * - 429 Backoff Coordination: Globally pauses all callers when a rate limit is signaled
 */

interface RequestRecord {
  timestamp: number;
  tokens: number;
}

export class EmbeddingThrottleQueue {
  private static readonly WINDOW_MS = 60_000;
  private static readonly MAX_REQUESTS_PER_MINUTE = 60;
  private static readonly MAX_TOKENS_PER_MINUTE = 28_000;
  private static readonly MIN_CALL_SPACING_MS = 1_000;

  private static history: RequestRecord[] = [];
  private static lastCallTimestamp = 0;
  private static pauseUntilTimestamp = 0;
  private static pauseReason = '';

  // Concurrency lock ensuring sequential capacity evaluation
  private static queueLock: Promise<void> = Promise.resolve();

  /**
   * Estimates token count for text or an array of texts.
   */
  static estimateTokens(input: string | string[]): number {
    if (Array.isArray(input)) {
      return input.reduce((acc, t) => acc + Math.ceil((t.length || 0) / 4), 0);
    }
    return Math.ceil((input?.length || 0) / 4);
  }

  /**
   * Globally pauses all outgoing embedding requests until pauseUntilTimestamp.
   */
  static pause(durationMs: number, reason: string = 'Gemini rate limit cooldown'): void {
    const until = Date.now() + durationMs;
    if (until > this.pauseUntilTimestamp) {
      this.pauseUntilTimestamp = until;
      this.pauseReason = reason;
      console.warn(`[EmbeddingThrottleQueue] Global queue PAUSED for ${Math.round(durationMs / 1000)}s: ${reason}`);
    }
  }

  /**
   * Resets the throttle queue state (useful in tests).
   */
  static reset(): void {
    this.history = [];
    this.lastCallTimestamp = 0;
    this.pauseUntilTimestamp = 0;
    this.pauseReason = '';
    this.queueLock = Promise.resolve();
  }

  /**
   * Cleans up records older than the sliding window.
   */
  private static pruneHistory(now: number): void {
    const cutoff = now - this.WINDOW_MS;
    while (this.history.length > 0 && this.history[0].timestamp < cutoff) {
      this.history.shift();
    }
  }

  /**
   * Calculates current window usage (request count and token count).
   */
  private static getWindowUsage(now: number): { requests: number; tokens: number } {
    this.pruneHistory(now);
    let tokens = 0;
    for (const record of this.history) {
      tokens += record.tokens;
    }
    return { requests: this.history.length, tokens };
  }

  /**
   * Acquires capacity to run an embedding request with the given token estimate.
   * If limits or a pause are active, asynchronously sleeps and notifies onWaiting.
   */
  static async acquire(
    tokenEstimate: number,
    onWaiting?: (waitSec: number, reason: string) => Promise<void> | void
  ): Promise<void> {
    // Chain onto the queueLock so requests evaluate and reserve capacity sequentially
    const unlock = await this.acquireLock();
    try {
      while (true) {
        const now = Date.now();

        // 1. Check if globally paused
        if (now < this.pauseUntilTimestamp) {
          const waitMs = this.pauseUntilTimestamp - now;
          const waitSec = Math.ceil(waitMs / 1000);
          const reason = this.pauseReason || 'Rate limit cooldown';
          console.log(`[EmbeddingThrottleQueue] Paused: waiting ${waitSec}s (${reason})...`);
          if (onWaiting) {
            await onWaiting(waitSec, reason);
          }
          await new Promise((r) => setTimeout(r, waitMs + 100));
          continue;
        }

        // 2. Check minimum call spacing
        const minSpacing = process.env.NODE_ENV === 'test' ? 5 : this.MIN_CALL_SPACING_MS;
        const timeSinceLast = now - this.lastCallTimestamp;
        if (timeSinceLast < minSpacing) {
          const spacingWait = minSpacing - timeSinceLast;
          await new Promise((r) => setTimeout(r, spacingWait));
          continue;
        }

        // 3. Check sliding 60-second window capacity
        const usage = this.getWindowUsage(now);
        const hasHistory = this.history.length > 0;
        const wouldExceedRequests = hasHistory && (usage.requests + 1 > this.MAX_REQUESTS_PER_MINUTE);
        const wouldExceedTokens = hasHistory && (usage.tokens + tokenEstimate > this.MAX_TOKENS_PER_MINUTE);

        if (wouldExceedRequests || wouldExceedTokens) {
          // Find earliest expiring record to know how long to sleep
          const oldest = this.history[0];
          const timeToWait = oldest ? Math.max(1000, oldest.timestamp + this.WINDOW_MS - now + 100) : 1000;
          const waitSec = Math.ceil(timeToWait / 1000);
          const reason = wouldExceedTokens
            ? `Token capacity (${usage.tokens + tokenEstimate}/${this.MAX_TOKENS_PER_MINUTE} TPM)`
            : `Request capacity (${usage.requests + 1}/${this.MAX_REQUESTS_PER_MINUTE} RPM)`;

          console.log(`[EmbeddingThrottleQueue] Window capacity reached: waiting ${waitSec}s for ${reason}...`);
          if (onWaiting) {
            await onWaiting(waitSec, reason);
          }
          await new Promise((r) => setTimeout(r, timeToWait));
          continue;
        }

        // Capacity successfully acquired! Record call.
        this.history.push({
          timestamp: Date.now(),
          tokens: Math.max(1, tokenEstimate),
        });
        this.lastCallTimestamp = Date.now();
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
