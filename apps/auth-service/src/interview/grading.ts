import { chatCompletion } from "./groq";
import type { Persona } from "./personas";
import type { Turn } from "./sessionStore";

// On /end we ask the LLM to grade the whole transcript against the role's rubric
// and return a strict JSON scorecard. Everything is defensively parsed/clamped —
// a model that returns junk degrades to a usable card, never a crash.

export interface DimensionScore {
  label: string;
  score: number; // 0-100
  comment: string;
}

export interface DifficultyBreakdown {
  asked: number;
  handledWell: number;
}

export interface Scorecard {
  overall: number; // 0-100
  summary: string;
  dimensions: DimensionScore[];
  strengths: string[];
  gaps: string[];
  perDifficulty: Record<"Easy" | "Medium" | "Hard", DifficultyBreakdown>;
}

const clamp = (n: unknown): number => {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()).slice(0, 6) : [];

const breakdown = (v: any): DifficultyBreakdown => ({
  asked: Math.max(0, Math.round(Number(v?.asked) || 0)),
  handledWell: Math.max(0, Math.round(Number(v?.handledWell) || 0)),
});

export async function gradeInterview(persona: Persona, transcript: Turn[]): Promise<Scorecard> {
  const convo = transcript
    .map((t) => `${t.role === "assistant" ? "INTERVIEWER" : "CANDIDATE"}: ${t.content}`)
    .join("\n\n");

  const dimensions = persona.rubric.map((r) => r.label);

  const prompt = `You are grading a completed mock ${persona.label} interview. Be fair but honest — this feedback helps the candidate improve.

Score the candidate ONLY on what they actually said. If the interview was very short or the candidate barely engaged, reflect that with low scores and say so in the summary.

Rate each of these dimensions from 0-100:
${dimensions.map((d) => `- ${d}`).join("\n")}

Also count, across the interview, how many questions were asked at each difficulty (Easy/Medium/Hard) and how many of those the candidate handled well.

Return ONLY a JSON object with this exact shape (no markdown, no prose outside the JSON):
{
  "overall": <0-100 weighted overall>,
  "summary": "<2-3 sentence honest summary>",
  "dimensions": [ { "label": "<one of the dimensions above>", "score": <0-100>, "comment": "<one specific sentence>" } ],
  "strengths": ["<specific strength>", ...],
  "gaps": ["<specific area to improve>", ...],
  "perDifficulty": {
    "Easy":   { "asked": <int>, "handledWell": <int> },
    "Medium": { "asked": <int>, "handledWell": <int> },
    "Hard":   { "asked": <int>, "handledWell": <int> }
  }
}

TRANSCRIPT:
${convo}`;

  const raw = await chatCompletion(
    [{ role: "user", content: prompt }],
    { json: true, maxTokens: 900, temperature: 0.3 },
  );

  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Last-ditch: pull the first {...} block out of the text.
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* give up → defaults below */ }
    }
  }

  // Map dimensions back onto the rubric so the UI always has every row, even if
  // the model dropped one.
  const byLabel = new Map<string, any>();
  if (Array.isArray(parsed.dimensions)) {
    for (const d of parsed.dimensions) if (d?.label) byLabel.set(String(d.label), d);
  }
  const dimScores: DimensionScore[] = persona.rubric.map((r) => {
    const d = byLabel.get(r.label);
    return {
      label: r.label,
      score: clamp(d?.score),
      comment: typeof d?.comment === "string" ? d.comment.trim() : "No specific feedback.",
    };
  });

  const pd = parsed.perDifficulty ?? {};
  return {
    overall: clamp(parsed.overall),
    summary: typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : "The interview ended before there was enough to assess in depth.",
    dimensions: dimScores,
    strengths: strList(parsed.strengths),
    gaps: strList(parsed.gaps),
    perDifficulty: {
      Easy: breakdown(pd.Easy),
      Medium: breakdown(pd.Medium),
      Hard: breakdown(pd.Hard),
    },
  };
}
