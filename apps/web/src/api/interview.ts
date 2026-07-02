import { api, API_URL, ApiError } from "./client";

// Typed client for the AI Interview endpoints. Most go through the shared `api`
// JSON wrapper; STT is special (it POSTs a raw audio blob, not JSON) so it has
// its own fetch that still carries cookies + the CSRF header.

export interface RoleMeta {
  id: string;
  label: string;
  interviewer: string;
  blurb: string;
  accent: string;
  dimensions: string[];
}

export interface Quota {
  used: number;
  limit: number;
  remaining: number;
}

export interface RolesResponse {
  configured: boolean;
  quota: Quota;
  roles: RoleMeta[];
}

export interface DimensionScore {
  label: string;
  score: number;
  comment: string;
}

export interface DifficultyBreakdown {
  asked: number;
  handledWell: number;
}

export interface Scorecard {
  overall: number;
  summary: string;
  dimensions: DimensionScore[];
  strengths: string[];
  gaps: string[];
  perDifficulty: Record<"Easy" | "Medium" | "Hard", DifficultyBreakdown>;
}

export interface Turn {
  role: "assistant" | "user";
  content: string;
}

export interface SessionResponse {
  sessionId: string;
  role: string;
  persona: RoleMeta;
  opening: { text: string };
  quota: Quota;
}

export interface MessageResponse {
  reply: { text: string };
  questionCount: number;
  atCap: boolean;
}

export interface EndResponse {
  scorecard: Scorecard;
  transcript: Turn[];
  durationS: number;
  persisted: boolean;
}

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="))
    ?.split("=")[1];
}

export const interviewApi = {
  getRoles: () => api.get<RolesResponse>("/api/interview/roles"),

  startSession: (role: string) =>
    api.post<SessionResponse>("/api/interview/session", { role }),

  sendMessage: (sessionId: string, text: string) =>
    api.post<MessageResponse>("/api/interview/message", { sessionId, text }),

  endInterview: (sessionId: string) =>
    api.post<EndResponse>("/api/interview/end", { sessionId }),

  history: () => api.get<unknown[]>("/api/interview/history"),

  // Send a recorded audio clip to Groq Whisper and get the transcript back.
  async transcribe(blob: Blob): Promise<string> {
    const csrf = readCookie("csrf_token");
    const res = await fetch(`${API_URL}/api/interview/stt`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": blob.type || "audio/webm",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      body: blob,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(res.status, data?.error ?? "stt_error", data?.message ?? "Transcription failed");
    }
    return (data?.text as string) ?? "";
  },
};
