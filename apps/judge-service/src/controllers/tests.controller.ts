import { Request, Response } from "express";
import { prisma } from "../db/prisma";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export type PregenTest = { description: string; args: unknown[]; expectedThrow?: string };
type CacheEntry = { functionName: string; isAsync: boolean; tests: PregenTest[] };

// In-memory cache keyed by problemId — resets on server restart (fine for dev)
const cache = new Map<number, CacheEntry>();

async function groq(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.THIRD_GROQ_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 2048, temperature: 0.1 }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content.trim();
}

function parseJson(text: string): unknown {
  const t = text.trim();
  try { return JSON.parse(t); } catch {}
  const fence = t.match(/```json\s*([\s\S]+?)```/);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch {} }
  const start = t.indexOf("{"); const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) { try { return JSON.parse(t.slice(start, end + 1)); } catch {} }
  throw new Error("Could not parse JSON");
}

async function generateForProblem(
  problemStatement: string,
  sealedExpectations: unknown,
  referenceCode: Record<string, string> | null
): Promise<CacheEntry> {
  const refJs = referenceCode?.["javascript"] ?? referenceCode?.["typescript"] ?? Object.values(referenceCode ?? {})[0] ?? "";

  const prompt = [
    "You are a test case generator for a coding challenge platform.",
    "",
    "Problem:",
    problemStatement,
    "",
    "Answer key (what correct code must handle):",
    JSON.stringify(sealedExpectations, null, 2),
    "",
    "Reference solution (javascript) — use this to identify the function name and parameter shape:",
    "```javascript",
    refJs,
    "```",
    "",
    "Generate 6-8 test INPUT sets (NOT expected outputs) that cover:",
    "- Happy path (valid input, should return a result)",
    "- Error cases that must throw (use expectedThrow field with a lowercase substring of the error message)",
    "- All edge cases from the answer key: boundaries, off-by-one, traps",
    "- For valid (non-expired) coupons use expires_at: '2099-12-31T00:00:00Z'",
    "- For expired coupons use expires_at: '2020-01-01T00:00:00Z'",
    "",
    "Return ONLY raw JSON (no markdown):",
    '{"functionName":"exactFunctionName","isAsync":false,"tests":[{"description":"happy path — 15% discount applied","args":[...]},{"description":"expired coupon rejected","args":[...],"expectedThrow":"expired"}]}',
  ].join("\n");

  const raw = await groq([{ role: "user", content: prompt }]);
  const parsed = parseJson(raw) as { functionName: string; isAsync: boolean; tests: PregenTest[] };
  return { functionName: parsed.functionName, isAsync: parsed.isAsync ?? false, tests: parsed.tests ?? [] };
}

export async function getPregenTests(problemId: number): Promise<CacheEntry | null> {
  if (cache.has(problemId)) return cache.get(problemId)!;
  return null;
}

export async function ensureTestsGenerated(problemId: number): Promise<CacheEntry> {
  if (cache.has(problemId)) return cache.get(problemId)!;

  const problem = await prisma.problem.findUnique({ where: { id: problemId } });
  if (!problem) throw new Error("Problem not found");

  const entry = await generateForProblem(
    problem.problemStatement,
    problem.sealedExpectations,
    problem.referenceCode as Record<string, string> | null
  );
  cache.set(problemId, entry);
  return entry;
}

export const getTests = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid problem id" });

  try {
    const entry = await ensureTestsGenerated(id);
    // Return descriptions only — args are shown but no expected values
    return res.json({ tests: entry.tests.map(t => ({ description: t.description, hasThrow: !!t.expectedThrow })) });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
};
