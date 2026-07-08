import { redis } from "../lib/redis";
import { env } from "../config/env";

// Per-user daily interview budget, enforced in Redis. Keeps the whole feature
// free for the user while staying inside the upstream free tiers. We count
// STARTED interviews (one increment per /session) against a UTC-day window.

const DAY_TTL = 24 * 60 * 60;

// UTC day stamp, e.g. "2026-06-27". No timezone libs needed.
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const KEY = (userId: string) => `interview:quota:${userId}:${today()}`;

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean; // when true there is no daily cap (INTERVIEW_DAILY_LIMIT<=0)
}

export async function getQuota(userId: string): Promise<QuotaStatus> {
  const limit = env.INTERVIEW_DAILY_LIMIT;
  const unlimited = limit <= 0;
  const used = Number((await redis.get(KEY(userId))) ?? 0);
  return { used, limit, remaining: unlimited ? -1 : Math.max(0, limit - used), unlimited };
}

/**
 * Consume one interview from today's budget. Returns whether it was allowed plus
 * the resulting status. When the limit is 0/negative the feature is uncapped and
 * this always allows (we still count usage for visibility). The 24h TTL is set
 * on the first use of the day so the counter self-expires.
 */
export async function consumeQuota(userId: string): Promise<{ allowed: boolean } & QuotaStatus> {
  const limit = env.INTERVIEW_DAILY_LIMIT;
  const unlimited = limit <= 0;
  const key = KEY(userId);

  const used = await redis.incr(key);
  if (used === 1) await redis.expire(key, DAY_TTL);

  if (!unlimited && used > limit) {
    // Over budget — give the slot back so the count reflects reality.
    await redis.decr(key);
    return { allowed: false, used: limit, limit, remaining: 0, unlimited };
  }
  return { allowed: true, used, limit, remaining: unlimited ? -1 : Math.max(0, limit - used), unlimited };
}
