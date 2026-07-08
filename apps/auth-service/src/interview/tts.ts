import { createHash } from "crypto";
import { env } from "../config/env";
import { AppError } from "../lib/AppError";
import { logger } from "../lib/logger";

// ElevenLabs text-to-speech for the interviewer's voice. Kept intentionally
// minimal to control credits: Flash v2.5 (~half the cost of Multilingual v2),
// one voice, and an in-memory cache so repeated lines (the static opening
// questions, transitions) don't re-spend credits. The route falls back to the
// browser's free SpeechSynthesis whenever this isn't configured or errors.

const MODEL_ID = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";

export function ttsConfigured(): boolean {
  return Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_API_KEY.trim());
}

// Small bounded cache of already-synthesised clips (keyed by voice+model+text).
// The 4 opening questions repeat across every session — caching them is the
// biggest single credit saver.
const cache = new Map<string, Buffer>();
const CACHE_MAX = 64;

function stripTags(text: string): string {
  // The interviewer prefixes questions with a "[Medium] " difficulty tag we
  // never want read aloud.
  return text.replace(/\[(Easy|Medium|Hard)\]\s*/gi, "").trim();
}

export async function synthesize(rawText: string, voiceId?: string): Promise<Buffer> {
  const key = env.ELEVENLABS_API_KEY;
  if (!key) throw new AppError(400, "tts_not_configured", "Voice synthesis is not configured");

  const voice = voiceId || env.ELEVENLABS_VOICE_ID;
  const text = stripTags(rawText).slice(0, 2000); // free tier caps ~2500 chars/request
  if (!text) throw new AppError(400, "tts_empty", "Nothing to speak");

  const cacheKey = createHash("sha1").update(`${MODEL_ID}:${voice}:${text}`).digest("hex");
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=${OUTPUT_FORMAT}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: MODEL_ID }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.warn({ status: res.status, detail: detail.slice(0, 200) }, "elevenlabs tts error");
    // 401 = bad/over-scoped key, 429/402 = out of credits — surface as a 502 the
    // client treats as "fall back to the browser voice", not a hard failure.
    throw new AppError(502, "tts_unavailable", `Voice synthesis failed (${res.status})`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(cacheKey, buf);
  return buf;
}
