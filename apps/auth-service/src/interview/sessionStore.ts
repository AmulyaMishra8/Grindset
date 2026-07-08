import { randomUUID } from "crypto";
import { redis } from "../lib/redis";
import type { RoleId } from "./personas";

// Live interview state lives in Redis (it's chatty and ephemeral); only the
// FINISHED interview is persisted to Postgres on /end. Each /message sends the
// full turns array to the stateless LLM, so this object is the conversation's
// single source of truth while it's in flight.

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

const KEY = (id: string) => `interview:session:${id}`;
const TTL_SECONDS = 2 * 60 * 60; // 2h — abandoned sessions expire on their own

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
  const raw = await redis.get(KEY(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as InterviewState;
  } catch {
    return null;
  }
}

export async function save(state: InterviewState): Promise<void> {
  await redis.set(KEY(state.sessionId), JSON.stringify(state), "EX", TTL_SECONDS);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await redis.del(KEY(sessionId));
}

// The transcript without the hidden system prompt — what we show the user and
// persist on /end.
export function visibleTranscript(state: InterviewState): Turn[] {
  return state.turns.filter((t) => t.role !== "system");
}
