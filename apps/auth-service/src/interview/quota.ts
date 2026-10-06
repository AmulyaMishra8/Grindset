import { env } from "../config/env";

// Per-user daily interview budget, kept in memory. We count STARTED interviews
// (one increment per /session) against a UTC-day window.
//
// Single-process store (like middleware/rateLimit.ts): a restart resets the
// day's counts, which is fine here — the cap is advisory abuse-prevention, and
// production runs uncapped (INTERVIEW_DAILY_LIMIT=0). Keeping it in-process
// avoids any external dependency.

// UTC day stamp, e.g. "2026-06-27". No timezone libs needed.
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const KEY = (userId: string) => `${userId}:${today()}`;

// key -> count used today. Keys from previous days are swept hourly.
const counts = new Map<string, number>();

setInterval(() => {
  const suffix = `:${today()}`;
  for (const key of counts.keys()) if (!key.endsWith(suffix)) counts.delete(key);
}, 60 * 60 * 1000).unref();

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean; // when true there is no daily cap (INTERVIEW_DAILY_LIMIT<=0)
}

export async function getQuota(userId: string): Promise<QuotaStatus> {
  const limit = env.INTERVIEW_DAILY_LIMIT;
  const unlimited = limit <= 0;
  const used = counts.get(KEY(userId)) ?? 0;
  return { used, limit, remaining: unlimited ? -1 : Math.max(0, limit - used), unlimited };
}

/**
 * Consume one interview from today's budget. Returns whether it was allowed plus
 * the resulting status. When the limit is 0/negative the feature is uncapped and
 * this always allows (we still count usage for visibility).
 */
export async function consumeQuota(userId: string): Promise<{ allowed: boolean } & QuotaStatus> {
  const limit = env.INTERVIEW_DAILY_LIMIT;
  const unlimited = limit <= 0;
  const key = KEY(userId);
  const used = (counts.get(key) ?? 0) + 1;

  if (!unlimited && used > limit) {
    // Over budget — don't record the attempt, so the count reflects reality.
    return { allowed: false, used: limit, limit, remaining: 0, unlimited };
  }

  counts.set(key, used);
  return { allowed: true, used, limit, remaining: unlimited ? -1 : Math.max(0, limit - used), unlimited };
}
