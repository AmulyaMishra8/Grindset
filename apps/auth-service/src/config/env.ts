import { z } from "zod";
import "dotenv/config";

// ----------------------------------------------------------------------------
// We validate the environment ONCE, at startup. If something is missing or
// malformed the app refuses to boot with a clear message — far better than a
// mysterious crash deep inside a request later on.
// ----------------------------------------------------------------------------

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),

  WEB_ORIGIN: z.string().url(),
  APP_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // Accept either a file path (dev) or the raw PEM content (production / Render)
  JWT_PRIVATE_KEY_PATH: z.string().optional(),
  JWT_PUBLIC_KEY_PATH: z.string().optional(),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_PREVIOUS_PUBLIC_KEY_PATH: z.string().optional(),
  JWT_PREVIOUS_PUBLIC_KEY: z.string().optional(),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),

  ACCESS_TOKEN_TTL: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().default(1209600),
  MFA_TOKEN_TTL: z.coerce.number().default(300),

  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  COOKIE_DOMAIN: z.string().optional(),

  MFA_ISSUER: z.string().default("Auth Service"),

  // Encrypts TOTP secrets at rest. MUST be overridden in production.
  ENCRYPTION_KEY: z.string().min(1).default("dev-only-insecure-key-change-me"),

  // OAuth providers (optional — only needed if you enable social login).
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Auth Service <no-reply@example.com>"),

  // ---- AI Interview (Groq: LLM interviewer + Whisper STT) ----
  // Optional: if no key is set, the interview routes return a clear "not
  // configured" error instead of crashing the service at boot.
  FIRST_GROQ_KEY: z.string().optional(),
  SECOND_GROQ_KEY: z.string().optional(),
  THIRD_GROQ_KEY: z.string().optional(),
  // How many interviews a single user may START per UTC day. 0 = unlimited
  // (the default), so there's no cap unless you deliberately set one.
  INTERVIEW_DAILY_LIMIT: z.coerce.number().int().nonnegative().default(0),

  // ---- AI Interview voice (ElevenLabs TTS) ----
  // Optional: if unset, the interviewer voice falls back to the browser's
  // built-in SpeechSynthesis (free). Scope the key to Text-to-Speech only.
  ELEVENLABS_API_KEY: z.string().optional(),
  // Premade ElevenLabs voice id (default "Adam"). Flash v2.5 keeps credits low.
  ELEVENLABS_VOICE_ID: z.string().default("pNInz6obpgDQGcFmaJgB"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Must have at least one of path or content for private and public key
const d = parsed.data;
if (!d.JWT_PRIVATE_KEY_PATH && !d.JWT_PRIVATE_KEY) {
  console.error("❌ Set JWT_PRIVATE_KEY (PEM content) or JWT_PRIVATE_KEY_PATH (file path)");
  process.exit(1);
}
if (!d.JWT_PUBLIC_KEY_PATH && !d.JWT_PUBLIC_KEY) {
  console.error("❌ Set JWT_PUBLIC_KEY (PEM content) or JWT_PUBLIC_KEY_PATH (file path)");
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

// Safety net: never run in production with the insecure default encryption key.
if (isProd && env.ENCRYPTION_KEY === "dev-only-insecure-key-change-me") {
  console.error("❌ ENCRYPTION_KEY must be set to a strong random value in production");
  process.exit(1);
}
