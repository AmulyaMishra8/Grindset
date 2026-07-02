// Server-side conversation state for a problem attempt, keyed by user+problem.
// The PM chat and junior-AI chat write here as exchanges actually happen, and
// /submit grades from here — so the histories that feed the evaluation can't be
// fabricated by the client. In-memory is deliberate: this app runs as a single
// process (one Render instance), the data is ephemeral coaching context, and a
// restart just means an attempt starts with a fresh conversation.

export type PmMsg = { role: "user" | "pm"; content: string };
export type AiMsg = { role: "user" | "ai"; content: string };

interface Convo {
  pm: PmMsg[];
  ai: AiMsg[];
  touched: number;
}

const TTL_MS = 3 * 60 * 60 * 1000; // an attempt older than 3h idle is abandoned
const MAX_MESSAGES = 200; // per conversation — bounds memory and LLM context

const store = new Map<string, Convo>();

const keyFor = (userId: string, problemId: number) => `${userId}:${problemId}`;

function fresh(): Convo {
  return { pm: [], ai: [], touched: Date.now() };
}

export function getConvo(userId: string, problemId: number): { pm: PmMsg[]; ai: AiMsg[] } {
  const convo = store.get(keyFor(userId, problemId));
  if (!convo || Date.now() - convo.touched > TTL_MS) return { pm: [], ai: [] };
  return { pm: convo.pm, ai: convo.ai };
}

// A new attempt at a problem starts a clean conversation.
export function resetConvo(userId: string, problemId: number): void {
  store.set(keyFor(userId, problemId), fresh());
}

function append<T>(list: T[], msgs: T[]): void {
  list.push(...msgs);
  if (list.length > MAX_MESSAGES) list.splice(0, list.length - MAX_MESSAGES);
}

export function appendPm(userId: string, problemId: number, ...msgs: PmMsg[]): void {
  const key = keyFor(userId, problemId);
  const convo = store.get(key) ?? fresh();
  append(convo.pm, msgs);
  convo.touched = Date.now();
  store.set(key, convo);
}

export function appendAi(userId: string, problemId: number, ...msgs: AiMsg[]): void {
  const key = keyFor(userId, problemId);
  const convo = store.get(key) ?? fresh();
  append(convo.ai, msgs);
  convo.touched = Date.now();
  store.set(key, convo);
}

// Sweep idle conversations so abandoned attempts don't accumulate forever.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, convo] of store) {
    if (now - convo.touched > TTL_MS) store.delete(key);
  }
}, 15 * 60 * 1000);
sweeper.unref();
