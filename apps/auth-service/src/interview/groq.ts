import { env } from "../config/env";
import { Errors, AppError } from "../lib/AppError";
import { logger } from "../lib/logger";

// Thin client over Groq's OpenAI-compatible API. We reuse the same account/keys
// as judge-service: one LLM (Llama 3.3 70B) for the interviewer brain + grading,
// and Whisper for speech-to-text. Keys are tried in order so a rate-limited key
// rotates to the next instead of failing the turn.

const CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

const CHAT_MODEL = "llama-3.3-70b-versatile";
const STT_MODEL = "whisper-large-v3-turbo";

function groqKeys(): string[] {
  return [
    env.FIRST_GROQ_KEY,
    env.SECOND_GROQ_KEY,
    env.THIRD_GROQ_KEY,
  ].filter((k): k is string => Boolean(k && k.trim()));
}

export function interviewConfigured(): boolean {
  return groqKeys().length > 0;
}

export interface ChatMessage {
  role: "system" | "assistant" | "user";
  content: string;
}

interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  json?: boolean; // request a strict JSON object back (grading)
}

/**
 * Call the Groq chat completion endpoint, rotating through available keys on a
 * 429/5xx. Returns the assistant's text. Throws an AppError the route handler
 * surfaces cleanly.
 */
export async function chatCompletion(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const keys = groqKeys();
  if (keys.length === 0) throw Errors.badRequest("AI interviewer is not configured (no Groq key)");

  const body: Record<string, unknown> = {
    model: CHAT_MODEL,
    messages,
    max_tokens: opts.maxTokens ?? 700,
    temperature: opts.temperature ?? 0.6,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  let lastErr = "";
  for (const key of keys) {
    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = `groq ${res.status}`;
        continue; // try the next key
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        logger.warn({ status: res.status, detail }, "groq chat error");
        throw Errors.badRequest("AI interviewer error");
      }

      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw Errors.badRequest("AI interviewer returned an empty reply");
      return text;
    } catch (err) {
      // Network-level failure on this key — record and try the next one.
      lastErr = (err as Error).message;
    }
  }

  logger.error({ lastErr }, "all groq keys failed (chat)");
  throw new AppError(502, "ai_unavailable", "AI interviewer is temporarily unavailable");
}

/**
 * Transcribe an audio clip with Groq Whisper. `audio` is the raw recorded blob
 * bytes; `mimeType` (e.g. "audio/webm") tells Groq how to decode it.
 */
export async function transcribeAudio(audio: Buffer, mimeType: string): Promise<string> {
  const keys = groqKeys();
  if (keys.length === 0) throw Errors.badRequest("Speech-to-text is not configured (no Groq key)");

  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") || mimeType.includes("mpeg") ? "mp4" : "webm";

  let lastErr = "";
  for (const key of keys) {
    try {
      const form = new FormData();
      // Node 18+ has global Blob/FormData/fetch. A Buffer IS a valid BlobPart at
      // runtime (it extends Uint8Array); the DOM lib types just don't model that,
      // hence the cast.
      form.append("file", new Blob([audio as unknown as BlobPart], { type: mimeType }), `clip.${ext}`);
      form.append("model", STT_MODEL);
      form.append("response_format", "json");

      const res = await fetch(STT_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = `groq ${res.status}`;
        continue;
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        logger.warn({ status: res.status, detail }, "groq stt error");
        throw Errors.badRequest("Transcription failed");
      }

      const data = (await res.json()) as { text?: string };
      return (data.text ?? "").trim();
    } catch (err) {
      lastErr = (err as Error).message;
    }
  }

  logger.error({ lastErr }, "all groq keys failed (stt)");
  throw new AppError(502, "ai_unavailable", "Transcription is temporarily unavailable");
}
