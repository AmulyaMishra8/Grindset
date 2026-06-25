import { Request, Response } from "express";
import { prisma } from "../db/prisma";

// Simple in-memory cache — problems change rarely, 60s TTL is fine
const cache = new Map<string, { data: unknown; at: number }>();
const TTL = 60_000;

function fromCache<T>(key: string): T | null {
  const e = cache.get(key);
  return e && Date.now() - e.at < TTL ? (e.data as T) : null;
}

function toCache(key: string, data: unknown): void {
  cache.set(key, { data, at: Date.now() });
}

export function bustProblemCache(): void {
  cache.clear();
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const CHAT_MODEL = "llama-3.3-70b-versatile";

const CHAT_FORMAT_PROMPT = `You are formatting an engineering problem brief as a Slack-style chat thread.

Split the brief into exactly 2–3 natural chat messages as if a PM fired them off in a burst.
Keep the EXACT original wording — do NOT paraphrase, clean up, or rewrite anything.
Split only at natural sentence boundaries.

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "persona": { "name": "...", "role": "Product Manager", "initials": "XX", "color": "#xxxxxx" },
  "messages": [
    { "text": "...", "timestamp": "10:23 AM" },
    { "text": "...", "timestamp": "10:23 AM" },
    { "text": "...", "timestamp": "10:24 AM" }
  ],
  "reactions": [{ "emoji": "👍", "count": 2 }]
}

Rules:
- Pick a vivid but professional hex color for the persona avatar (not white or black).
- Initials are the first letters of the first and last name.
- Timestamps should look like a burst: first two share a minute, last one is +1 min.
- The split must cover ALL of the original text with no omissions.`;

async function generateChatFormat(problemStatement: string): Promise<object> {
  const apiKey = process.env.SECOND_GROQ_KEY;
  if (!apiKey) throw new Error("SECOND_GROQ_KEY not configured");

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: CHAT_FORMAT_PROMPT },
        { role: "user", content: problemStatement },
      ],
      max_tokens: 1024,
      temperature: 0.4,
    }),
  });

  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const raw = data.choices[0]?.message?.content ?? "{}";

  // Strip accidental markdown fences if the model adds them
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

export const getProblem = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid problem ID" });

  const cacheKey = `problem:${id}`;
  const cached = fromCache<object>(cacheKey);
  if (cached) return res.json(cached);

  const problem = await prisma.problem.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      domain: true,
      difficulty: true,
      estimatedMinutes: true,
      problemStatement: true,
      chatFormat: true,
    },
  });

  if (!problem) return res.status(404).json({ error: "Problem not found" });

  // If chatFormat is missing, generate in the background and cache the updated version when ready.
  if (!problem.chatFormat) {
    generateChatFormat(problem.problemStatement)
      .then(async (chatFormat) => {
        await prisma.problem.update({ where: { id }, data: { chatFormat } });
        toCache(cacheKey, { ...problem, chatFormat });
      })
      .catch((err) => console.error("Failed to generate chat format:", err));
  } else {
    toCache(cacheKey, problem);
  }

  return res.json(problem);
};

export const revealProblem = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid problem ID" });

  const problem = await prisma.problem.findUnique({ where: { id } });
  if (!problem) return res.status(404).json({ error: "Problem not found" });
  return res.json(problem);
};

const PROBLEM_SELECT = { id: true, slug: true, title: true, difficulty: true, domain: true, estimatedMinutes: true } as const;

export const listProblems = async (_req: Request, res: Response) => {
  const cached = fromCache<unknown[]>("all");
  if (cached) return res.json(cached);

  const problems = await prisma.problem.findMany({ select: PROBLEM_SELECT, orderBy: { id: "asc" } });
  toCache("all", problems);
  return res.json(problems);
};

export const listPracticeProblems = async (_req: Request, res: Response) => {
  const cached = fromCache<unknown[]>("practice");
  if (cached) return res.json(cached);

  const sets = await prisma.practiceSet.findMany({
    include: { problem: { select: PROBLEM_SELECT } },
    orderBy: { problemId: "asc" },
  });
  const problems = sets.map((s) => s.problem);
  toCache("practice", problems);
  return res.json(problems);
};

export const listTestProblems = async (_req: Request, res: Response) => {
  const cached = fromCache<unknown[]>("test");
  if (cached) return res.json(cached);

  const sets = await prisma.testSet.findMany({
    include: { problem: { select: PROBLEM_SELECT } },
    orderBy: { problemId: "asc" },
  });
  const problems = sets.map((s) => s.problem);
  toCache("test", problems);
  return res.json(problems);
};
