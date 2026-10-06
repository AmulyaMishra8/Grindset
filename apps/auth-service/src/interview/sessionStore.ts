import { randomUUID } from "crypto";
import type { RoleId } from "./personas";

// Live interview state lives in memory (it's chatty and ephemeral); only the
// FINISHED interview is persisted to Postgres on /end. Each /message sends the
// full turns array to the stateless LLM, so this object is the conversation's
// single source of truth while it's in flight.
//
// Single-process store: the auth-service runs as one Node process, so a Map is
// enough (same philosophy as the in-memory rate limiter). A restart drops any
// in-flight sessions, which is acceptable for a short-lived mock interview.

export type TurnRole = "system" | "assistant" | "user";
export interface Turn {
  role: TurnRole;
  content: string;
}

export interface InterviewState {
  sessionId: string;
  userId: string;
  role: RoleId;
  personaLabel: string;
  startedAt: number; // epoch ms
  turns: Turn[];
  questionCount: number; // assistant turns the candidate has answered to
  ended: boolean;
}

const TTL_MS = 2 * 60 * 60 * 1000; // 2h — abandoned sessions expire on their own

interface Entry {
  state: InterviewState;
  expiresAt: number;
}

const sessions = new Map<string, Entry>();

// Periodically drop expired sessions so the map can't grow without bound.
// unref() lets the process exit even though this timer is pending.
setInterval(() => {
  const now = Date.now();
  for (const [id, e] of sessions) if (e.expiresAt <= now) sessions.delete(id);
}, 10 * 60 * 1000).unref();

export async function createSession(input: {
  userId: string;
  role: RoleId;
  personaLabel: string;
  systemPrompt: string;
  opening: string;
}): Promise<InterviewState> {
  const state: InterviewState = {
    sessionId: randomUUID(),
    userId: input.userId,
    role: input.role,
    personaLabel: input.personaLabel,
    startedAt: Date.now(),
    turns: [
      { role: "system", content: input.systemPrompt },
      { role: "assistant", content: input.opening },
    ],
    questionCount: 1,
    ended: false,
  };
  await save(state);
  return state;
}

export async function getSession(sessionId: string): Promise<InterviewState | null> {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return entry.state;
}

export async function save(state: InterviewState): Promise<void> {
  sessions.set(state.sessionId, { state, expiresAt: Date.now() + TTL_MS });
}

export async function deleteSession(sessionId: string): Promise<void> {
  sessions.delete(sessionId);
}

// The transcript without the hidden system prompt — what we show the user and
// persist on /end.
export function visibleTranscript(state: InterviewState): Turn[] {
  return state.turns.filter((t) => t.role !== "system");
}
