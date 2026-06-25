import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/tokens";
import { ACCESS_COOKIE } from "../lib/cookies";
import { asyncHandler } from "./asyncHandler";

// Like requireAuth, but never rejects: if a valid token is present it attaches
// req.user, otherwise the request continues as anonymous. Used on read routes
// that are public but want to personalise (e.g. "which way did I vote?").
async function optionalAuthImpl(req: Request, _res: Response, next: NextFunction) {
  let token: string | undefined;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) token = header.slice("Bearer ".length);
  else if (req.cookies?.[ACCESS_COOKIE]) token = req.cookies[ACCESS_COOKIE];

  if (token) {
    try {
      const claims = await verifyAccessToken(token);
      req.user = { id: claims.sub!, email: claims.email };
    } catch {
      /* invalid/expired token — treat as anonymous */
    }
  }
  next();
}

export const optionalAuth = asyncHandler(optionalAuthImpl);
