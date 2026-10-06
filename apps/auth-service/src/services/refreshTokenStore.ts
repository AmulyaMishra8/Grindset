import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma";
import { randomToken, sha256 } from "../lib/crypto";
import { env } from "../config/env";

// ----------------------------------------------------------------------------
// Refresh tokens, stored in Postgres (one row per live/used token).
//
// Key ideas:
//  - The refresh token itself is a long random string we hand to the client.
//    We only ever store its SHA-256 HASH, so a DB leak can't be replayed.
//  - Tokens belong to a "family" (one family per login/device). Rotating a
//    token issues a new one in the SAME family and marks the old one used.
//  - REUSE DETECTION: if an already-rotated (used) token is presented again, it
//    means someone copied it — we revoke the entire family as a precaution.
//
// Why Postgres and not Redis? Refresh tokens are touched only a few times per
// SESSION (login / refresh / logout), so the DB load is trivial, and keeping
// them here means sessions survive a service restart (the free tier spins the
// service down when idle). Expired rows are swept in services/maintenance.ts.
// ----------------------------------------------------------------------------

const TTL_MS = env.REFRESH_TOKEN_TTL * 1000;

// Create a brand-new token + family (called at login).
export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomToken(32);
  await prisma.refreshToken.create({
    data: {
      tokenHash: sha256(token),
      userId,
      familyId: randomUUID(),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  return token;
}

// Exchange an old token for a new one (called at /auth/refresh).
export async function rotateRefreshToken(
  oldToken: string,
): Promise<{ token: string; userId: string }> {
  const hash = sha256(oldToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });

  // Unknown token — nothing we can trust.
  if (!existing) throw new Error("invalid_refresh_token");

  // Already rotated once -> this is a replay of a superseded token. Someone
  // copied it; we can't trust the family anymore, so nuke all of it.
  if (existing.usedAt) {
    await revokeFamily(existing.familyId);
    throw new Error("refresh_token_reuse");
  }

  if (existing.expiresAt <= new Date()) throw new Error("invalid_refresh_token");

  // Mark the old token used and mint its replacement in the same family — both
  // in one transaction so we never end up with a used token but no successor.
  const token = randomToken(32);
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { tokenHash: hash }, data: { usedAt: new Date() } }),
    prisma.refreshToken.create({
      data: {
        tokenHash: sha256(token),
        userId: existing.userId,
        familyId: existing.familyId,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    }),
  ]);

  return { token, userId: existing.userId };
}

// Revoke a single token (normal logout of one device).
export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { tokenHash: sha256(token) } });
}

// Revoke every token in a family.
export async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { familyId } });
}

// Revoke EVERY session for a user (used after a password reset).
export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

// Drop expired/used-and-stale rows so the table can't grow without bound.
export async function sweepExpiredRefreshTokens(): Promise<number> {
  const { count } = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
