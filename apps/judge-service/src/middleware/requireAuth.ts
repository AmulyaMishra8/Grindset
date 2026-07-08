import type { Request, Response, NextFunction } from "express";
import fs from "node:fs";
import crypto from "node:crypto";
import {
  jwtVerify,
  importSPKI,
  createRemoteJWKSet,
  type KeyLike,
  type JWTVerifyGetKey,
  type JWTVerifyOptions,
} from "jose";

// ----------------------------------------------------------------------------
// Auth guard for the judge service. Verifies the access token the auth service
// issued (RS256) without ever talking to its database:
//   - In production (single Render service) JWT_PUBLIC_KEY is in the shared env,
//     so verification is purely local.
//   - In dev, falls back to fetching the JWKS from the auth process on
//     localhost (cached by jose).
// Accepts the same hybrid the auth service does: Authorization: Bearer <token>
// or the httpOnly access_token cookie. Cookie-authed state-changing requests
// must also pass the double-submit CSRF check (X-CSRF-Token header == csrf_token
// cookie), mirroring auth-service/src/middleware/csrf.ts.
// ----------------------------------------------------------------------------

const ALG = "RS256";
const ACCESS_COOKIE = "access_token";
const CSRF_COOKIE = "csrf_token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function localPublicPem(): string | null {
  if (process.env.JWT_PUBLIC_KEY) return process.env.JWT_PUBLIC_KEY.replace(/\\n/g, "\n");
  if (process.env.JWT_PUBLIC_KEY_PATH) {
    try {
      return fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH, "utf8");
    } catch {
      return null;
    }
  }
  return null;
}

let localKey: Promise<KeyLike> | null = null;
let remoteJwks: JWTVerifyGetKey | null = null;

async function verifyToken(token: string) {
  const opts: JWTVerifyOptions = {};
  if (process.env.JWT_ISSUER) opts.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) opts.audience = process.env.JWT_AUDIENCE;

  const pem = localPublicPem();
  if (pem) {
    localKey ??= importSPKI(pem, ALG);
    return jwtVerify(token, await localKey, opts);
  }

  const authUrl = process.env.AUTH_SERVICE_URL ?? "http://localhost:4003";
  remoteJwks ??= createRemoteJWKSet(new URL(`${authUrl}/.well-known/jwks.json`));
  return jwtVerify(token, remoteJwks, opts);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);

  let token: string | undefined;
  let via: "bearer" | "cookie" | undefined;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    token = header.slice("Bearer ".length);
    via = "bearer";
  } else if (cookies[ACCESS_COOKIE]) {
    token = cookies[ACCESS_COOKIE];
    via = "cookie";
  }

  if (!token) {
    return res.status(401).json({ error: "unauthorized", message: "Authentication required" });
  }

  let sub: string;
  let email: string | undefined;
  try {
    const { payload } = await verifyToken(token);
    if (payload.type !== "access" || !payload.sub) throw new Error("wrong token type");
    sub = payload.sub;
    email = typeof payload.email === "string" ? payload.email : undefined;
  } catch {
    return res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
  }

  if (via === "cookie" && !SAFE_METHODS.has(req.method)) {
    const cookieToken = cookies[CSRF_COOKIE];
    const headerToken = req.get("x-csrf-token");
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
      return res.status(403).json({ error: "forbidden", message: "Invalid CSRF token" });
    }
  }

  req.user = { id: sub, email: email ?? "" };
  next();
}
