import { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { executeCode } from "../executors/index";
import { ensureTestsGenerated } from "./tests.controller";

const GROQ_URL    = "https://api.groq.com/openai/v1/chat/completions";
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-large-latest";
const MODEL = "llama-3.3-70b-versatile";

async function groq(key: string, messages: { role: string; content: string }[], maxTokens = 2048): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content.trim();
}

async function mistral(messages: { role: string; content: string }[], maxTokens = 1500): Promise<string> {
  const res = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MISTRAL_KEY}` },
    body: JSON.stringify({ model: MISTRAL_MODEL, messages, max_tokens: maxTokens, temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(`Mistral ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content.trim();
}

function parseJson(text: string): unknown {
  const t = text.trim();
  try { return JSON.parse(t); } catch {}
  const jsonFence = t.match(/```json\s*([\s\S]+?)```/);
  if (jsonFence) { try { return JSON.parse(jsonFence[1].trim()); } catch {} }
  const start = t.indexOf("{");
  const end   = t.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(t.slice(start, end + 1)); } catch {}
  }
  throw new Error(`Could not parse Groq JSON response: ${t.slice(0, 300)}`);
}

// ── Step 1: THIRD_GROQ_KEY — test inputs + complexity ────────────────────────
// We only generate INPUTS here. Expected outputs are computed by running the
// reference solution, so there's no risk of AI hallucinating wrong expected values.
type TestGenResult =
  | { cannotTest: true; reason: string }
  | { cannotTest: false; functionName: string; isAsync: boolean; complexity: { time: string; space: string }; tests: TestInput[] };

type TestInput = {
  description: string;
  args: unknown[];
  expectedThrow?: string; // only set for cases that must throw
};

async function generateTests(
  code: string,
  language: string,
  problemStatement: string,
  sealedExpectations: unknown
): Promise<TestGenResult> {
  const depCheck = [
    "Only set cannotTest=true if the code literally contains one of these:",
    "  - require() or import of an external npm package (sequelize, pg, axios, knex, mongoose, etc.)",
    "  - require() or import of a relative path that contains 'model', 'db', or 'database'",
    "  - A live network call: fetch('http...'), axios.get(...), http.request(...)",
    "  - A filesystem call: fs.readFile, fs.writeFile, etc.",
    "Plain JS/Python objects passed as function parameters are NOT external dependencies,",
    "even if they look like database records.",
    "Also set cannotTest=true if the code calls a function that is NOT defined anywhere in the submitted code",
    "and is NOT a built-in (like Date, Math, JSON, console, parseInt, etc.) — e.g. getCouponFromDb(), saveToDb(), fetchUser().",
    "If there are no such external calls, set cannotTest=false.",
  ].join("\n");

  const prompt = [
    "You are a test case generator for an engineering challenge platform.",
    "",
    "Problem the candidate had to solve:",
    problemStatement,
    "",
    "Hidden answer key (what correct code must handle):",
    JSON.stringify(sealedExpectations, null, 2),
    "",
    `Candidate's ${language} code:`,
    "```" + language,
    code,
    "```",
    "",
    "STEP 1 - Dependency check:",
    depCheck,
    "",
    "STEP 2 - If cannotTest is false:",
    "a) Identify the time and space complexity of the main function in Big O notation.",
    "b) Find the main function name exactly as written and generate 6-8 test INPUTS (NOT expected outputs) that:",
    "   - Use the real function name from the code",
    "   - Cover: happy path, error cases that must throw, the concurrency/edge trap, and edge cases from the answer key",
    "   - For valid (non-expired) coupons use expires_at: '2099-12-31T00:00:00Z'",
    "   - For expired coupons use expires_at: '2020-01-01T00:00:00Z'",
    "   - Only include 'expectedThrow' (lowercase error substring) for cases that MUST throw an error",
    "   - Do NOT include an 'expected' field — outputs will be computed from the reference solution",
    "",
    "Return ONLY raw JSON:",
    '{"cannotTest":false,"functionName":"exactName","isAsync":false,"complexity":{"time":"O(n)","space":"O(1)"},"tests":[{"description":"happy path","args":[...]},{"description":"expired coupon","args":[...],"expectedThrow":"expired"}]}',
  ].join("\n");

  const raw = await groq(process.env.THIRD_GROQ_KEY!, [{ role: "user", content: prompt }]);
  return parseJson(raw) as TestGenResult;
}

// ── Step 2: Sandbox — run user code vs reference code ────────────────────────
function buildHarness(
  language: string,
  userCode: string,
  refCode: string | null,
  functionName: string,
  isAsync: boolean,
  tests: TestInput[]
): string {
  const testsJson = JSON.stringify(tests);
  const awaitPrefix = isAsync ? "await " : "";

  if (language === "javascript" || language === "typescript") {
    // Rename every occurrence of the function name in the reference code to __refImpl
    // to prevent the IIFE from accidentally capturing the user's function from outer scope.
    const safeRefCode = refCode
      ? refCode.replace(new RegExp(`\\b${functionName}\\b`, "g"), "__refImpl")
      : null;
    const refBlock = safeRefCode
      ? `const __ref = (() => { ${safeRefCode}; return __refImpl; })();`
      : `const __ref = null;`;

    return `
${userCode}

// ── GRINDSET HARNESS ──
${refBlock}
(async () => {
  const __tests = ${testsJson};
  const __out = [];
  for (const t of __tests) {
    let __uRes, __uErr, __rRes, __rErr;
    try { __uRes = ${awaitPrefix}${functionName}(...t.args); } catch(e) { __uErr = e.message; }
    if (__ref) {
      try { __rRes = ${awaitPrefix}__ref(...t.args); } catch(e) { __rErr = e.message; }
      if (__rErr !== undefined) {
        // Reference threw — user must also throw (substring match)
        const __ok = __uErr !== undefined && __uErr.toLowerCase().includes(__rErr.toLowerCase().slice(0,20));
        __out.push({ description: t.description, passed: __ok, threwError: __uErr, expectedThrow: __rErr });
      } else if (__uErr !== undefined) {
        // User threw but reference didn't
        __out.push({ description: t.description, passed: false, reason: "Threw unexpectedly: " + __uErr, expected: __rRes });
      } else {
        const __ok = JSON.stringify(__uRes) === JSON.stringify(__rRes);
        __out.push({ description: t.description, passed: __ok, got: __uRes, expected: __rRes });
      }
    } else {
      // No reference — only validate throw/no-throw
      if (t.expectedThrow !== undefined) {
        const __ok = __uErr !== undefined && __uErr.toLowerCase().includes(t.expectedThrow.toLowerCase());
        __out.push({ description: t.description, passed: __ok, threwError: __uErr, expectedThrow: t.expectedThrow });
      } else {
        __out.push({ description: t.description, passed: __uErr === undefined, reason: __uErr });
      }
    }
  }
  console.log(JSON.stringify(__out));
})();`.trim();
  }

  if (language === "python") {
    const escaped = testsJson.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"');
    const refBlock = refCode
      ? `
_ref_ns = {}
exec("""${refCode.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')}""", _ref_ns)
__ref = _ref_ns.get("${functionName}")`.trim()
      : `__ref = None`;

    return `${userCode}

# -- GRINDSET HARNESS --
import json as _j, asyncio as _a, inspect as _i
${refBlock}
async def _run():
    __tests = _j.loads("""${escaped}""")
    __out = []
    for t in __tests:
        __u_res = __u_err = __r_res = __r_err = None
        try:
            __u_res = ${functionName}(*t["args"])
            if _i.iscoroutine(__u_res): __u_res = await __u_res
        except Exception as e: __u_err = str(e)
        if __ref:
            try:
                __r_res = __ref(*t["args"])
                if _i.iscoroutine(__r_res): __r_res = await __r_res
            except Exception as e: __r_err = str(e)
            if __r_err is not None:
                __ok = __u_err is not None and __r_err.lower()[:20] in __u_err.lower()
                __out.append({"description":t["description"],"passed":__ok,"threwError":__u_err,"expectedThrow":__r_err})
            elif __u_err is not None:
                __out.append({"description":t["description"],"passed":False,"reason":"Threw unexpectedly: "+__u_err,"expected":__r_res})
            else:
                __ok = _j.dumps(__u_res,sort_keys=True) == _j.dumps(__r_res,sort_keys=True)
                __out.append({"description":t["description"],"passed":__ok,"got":__u_res,"expected":__r_res})
        else:
            if "expectedThrow" in t:
                __ok = __u_err is not None and t["expectedThrow"].lower() in __u_err.lower()
                __out.append({"description":t["description"],"passed":__ok,"threwError":__u_err,"expectedThrow":t["expectedThrow"]})
            else:
                __out.append({"description":t["description"],"passed":__u_err is None,"reason":__u_err})
    print(_j.dumps(__out))
_a.run(_run())`;
  }

  throw new Error(`Unsupported language: ${language}`);
}

// ── Step 3: Mistral evaluation ────────────────────────────────────────────────
type EvalScores = { codeQuality: number; edgeCaseHandling: number; complexityAnalysis: number; requirementsClarification: number };
type HiringDecision = "Nailed it" | "Strong attempt" | "On the right track" | "Needs work" | "Start over";
type EvalResult =
  | { mode: "practice"; review: string }
  | { mode: "test"; scores: EvalScores; average: number; hiringDecision: HiringDecision; review: string };

async function evaluateWithMistral(
  code: string,
  language: string,
  problemStatement: string,
  sealedExpectations: unknown,
  referenceCode: Record<string, string> | null,
  complexity: { time: string; space: string },
  testResults: { description: string; passed: boolean; reason?: string; got?: unknown; expected?: unknown; threwError?: string; expectedThrow?: string }[],
  passed: number,
  chatHistory: { role: "user" | "pm"; content: string }[],
  aiHistory: { role: "user" | "ai"; content: string }[],
  mode: "practice" | "test"
): Promise<EvalResult> {
  const refSolution = referenceCode?.[language] ?? referenceCode?.["javascript"] ?? "Not available";

  // ── Practice mode: prompt coaching, no scores ─────────────────────────────
  if (mode === "practice") {
    const userMsg = [
      "Review this candidate's practice session.",
      "",
      "Problem they were solving:",
      problemStatement,
      "",
      "Internal answer key (for your reference only — do not reveal verbatim):",
      JSON.stringify(sealedExpectations, null, 2),
      "",
      `Candidate's ${language} code:`,
      "```" + language,
      code,
      "```",
      "",
      `Test results — ${passed}/${testResults.length} passed:`,
      JSON.stringify(testResults, null, 2),
      "",
      ...(chatHistory.length > 0 ? [
        "Candidate's conversation with the PM (Ethan Wong):",
        chatHistory.map((m) => `${m.role === "user" ? "Candidate" : "PM"}: ${m.content}`).join("\n"),
        "",
      ] : []),
      ...(aiHistory.filter((_, i) => i > 0).length > 0 ? [
        "Candidate's conversation with the AI junior developer:",
        aiHistory
          .filter((_, i) => i > 0)
          .map((m) => `${m.role === "user" ? "Candidate" : "Junior AI"}: ${m.content}`)
          .join("\n"),
        "",
      ] : []),
      "Give feedback focused entirely on helping them improve. No scores, no pass/fail verdict.",
      "",
      "REVIEW FORMAT — use these exact sections:",
      "## What You Did Well",
      "## Questions You Should Have Asked the PM",
      "## How You Could Have Prompted the Junior Better",
      "## Tips for Next Time",
    ].join("\n");

    const raw = await mistral([
      {
        role: "system",
        content: [
          "You are a senior engineer and prompt coach reviewing a practice session on an agentic AI coding platform.",
          "",
          "This platform trains people for agentic coding rounds used by top tech companies. In these rounds, candidates are NOT just evaluated on their code.",
          "They are evaluated on THREE skills:",
          "  1. How well they clarify requirements with the PM before coding",
          "  2. How clearly and specifically they communicate tasks to an AI junior developer",
          "  3. Whether their code reflects what they learned from those conversations",
          "",
          "PRACTICE MODE — your job is to help the candidate improve, not judge them.",
          "- Point out what they asked well and what ambiguities they missed in the PM conversation.",
          "- Analyse how they communicated with the junior: were the prompts specific enough? Did they break the task down clearly? Did they give the junior enough context to work with?",
          "- Suggest concrete, better questions they could have asked — give actual example phrasings, not just vague advice.",
          "- Be encouraging but direct. Don't soften feedback to the point it loses meaning.",
          "- DO NOT give numeric scores. DO NOT give a pass/fail verdict. Focus entirely on how to improve.",
          "",
          "CRITICAL: If the PM conversation shows Ethan explicitly said something was out of scope, do not fault the candidate for not handling it.",
        ].join("\n"),
      },
      { role: "user", content: userMsg },
    ]);

    return { mode: "practice", review: raw };
  }

  // ── Test mode: full scoring, agentic round framing ────────────────────────
  const aiExchanges = aiHistory.filter((_, i) => i > 0);
  const candidateJuniorMessages = aiExchanges
    .filter(m => m.role === "user")
    .map(m => m.content);

  const copyPasteWarning = candidateJuniorMessages.length > 0
    ? [
        "COPY-PASTE CHECK:",
        "The original problem statement is shown above. Compare each of the candidate's messages to the Junior AI against it.",
        "If any message is a near-verbatim copy of the problem statement (same wording, same structure, just forwarded as-is),",
        "score requirementsClarification 0-15. They failed to do their job — they just delegated the raw task instead of decomposing it.",
        "Partial overlap (reusing some phrasing but with added context or breakdown) is not a penalty.",
        "",
      ]
    : [];

  const userMsg = [
    "Evaluate this candidate submission for an agentic AI coding round.",
    "",
    "Problem:",
    problemStatement,
    "",
    "Answer key:",
    JSON.stringify(sealedExpectations, null, 2),
    "",
    `Reference solution (${language}):`,
    "```" + language,
    refSolution,
    "```",
    "",
    `Candidate's ${language} code:`,
    "```" + language,
    code,
    "```",
    "",
    `Complexity identified: time ${complexity.time}, space ${complexity.space}`,
    "",
    `Test results (expected values are from the reference solution) — ${passed}/${testResults.length} passed:`,
    JSON.stringify(testResults, null, 2),
    "",
    ...(chatHistory.length > 0 ? [
      "Candidate's conversation with the PM (Ethan Wong) before coding:",
      chatHistory.map((m) => `${m.role === "user" ? "Candidate" : "PM"}: ${m.content}`).join("\n"),
      "",
    ] : []),
    ...(aiExchanges.length > 0 ? [
      "Candidate's conversation with the AI junior developer:",
      aiExchanges.map((m) => `${m.role === "user" ? "Candidate" : "Junior AI"}: ${m.content}`).join("\n"),
      "",
      ...copyPasteWarning,
    ] : []),
    "Score each criterion out of 100.",
    "",
    "Respond in EXACTLY this format — scores first as JSON, then review as plain text:",
    "",
    "SCORES:",
    '{"codeQuality":<0-100>,"edgeCaseHandling":<0-100>,"complexityAnalysis":<0-100>,"requirementsClarification":<0-100>,"hiringDecision":"<one of: Nailed it|Strong attempt|On the right track|Needs work|Start over>"}',
    "",
    "Scoring guidance:",
    "- requirementsClarification is the MOST IMPORTANT signal (double-weighted in final score).",
    "  This covers BOTH the PM conversation AND how well they broke down the task for the Junior AI.",
    "  Score 70-100: asked the PM sharp questions that surfaced real ambiguities, AND gave the Junior clear, decomposed instructions.",
    "  Score 40-70: decent PM questions but vague or lazy prompting to the Junior.",
    "  Score 0-20: asked nothing meaningful, OR copy-pasted the problem straight to the Junior without decomposing it.",
    "  IMPORTANT: Over-specifying to the Junior (giving detailed, step-by-step context) is GOOD. Under-specifying (vague one-liners) is BAD.",
    "- hiringDecision must reflect BOTH code quality AND how well they played the agentic lead role.",
    "  Perfect code + sharp PM questions + clear Junior prompting = 'Nailed it'.",
    "  Correct core but missed one trap = 'Strong attempt'.",
    "  Right idea but gaps = 'On the right track'. Significant errors = 'Needs work'. Wrong approach entirely = 'Start over'.",
    "",
    "REVIEW:",
    "## Overview",
    "...",
    "## What They Got Right",
    "...",
    "## What They Missed",
    "...",
    "## Code Quality",
    "...",
    "## Verdict",
    "**Pass** / **Fail**",
  ].join("\n");

  const raw = await mistral([
    {
      role: "system",
      content: [
        "You are a senior engineer evaluating a candidate in an AGENTIC AI CODING ROUND.",
        "",
        "THIS IS NOT A TRADITIONAL CODING ROUND. Do not evaluate it like one.",
        "",
        "In an agentic round, the candidate acts as a TECH LEAD working with an AI junior developer.",
        "The primary skill being tested is NOT just whether they can write correct code.",
        "It is whether they can:",
        "  1. Clarify ambiguous requirements with a PM before writing a single line of code",
        "  2. Decompose a task and communicate it clearly to an AI junior — with enough context for the junior to succeed",
        "  3. Review and guide the junior's output rather than just accepting it",
        "  4. Produce working code that reflects what they learned from the PM and the junior's questions",
        "",
        "GRADING PHILOSOPHY:",
        "- requirementsClarification is double-weighted. A candidate who wrote perfect code but gave the junior a one-sentence prompt and asked the PM nothing is a poor agentic lead.",
        "- Over-specifying to the junior is a virtue — give them credit for detailed, structured prompts.",
        "- Under-specifying to the junior is a red flag — vague instructions that would leave a real junior confused should cost points.",
        "- Copy-pasting the raw problem statement to the junior with no decomposition is a disqualifying failure of the agentic role.",
        "- Be generous with partial credit on code: someone who got the core logic right but missed one edge case should score 70-80, not 30.",
        "- Every deduction must explain WHY it matters in production.",
        "- The candidate wrote a PURE FUNCTION. Do not penalise for missing DB transactions, HTTP calls, or filesystem concerns.",
        "- CRITICAL: If the PM told the candidate to ignore or deprioritise something, do NOT penalise them for missing it. Quote the PM guidance in the review.",
        "",
        "VERDICT SCALE — pick exactly one:",
        "  'Nailed it'          — clean code, sharp PM questions, clear Junior prompting, key edge cases handled",
        "  'Strong attempt'     — solid on most fronts, missed 1-2 non-obvious things",
        "  'On the right track' — right idea but meaningful gaps in code, PM questions, or Junior prompting",
        "  'Needs work'         — partial credit for effort, but significant gaps",
        "  'Start over'         — fundamental misunderstanding of the task or the agentic role",
        "",
        "REVIEW FORMAT — use these exact sections:",
        "## What you got right",
        "## What you missed (and why it matters in production)",
        "## How to fix it",
        "## Verdict",
      ].join("\n"),
    },
    { role: "user", content: userMsg },
  ]);

  const scoresSection = raw.match(/SCORES:\s*([\s\S]+?)(?=REVIEW:|$)/)?.[1] ?? raw;
  const stripped = scoresSection.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
  const jsonMatch = stripped.match(/\{[\s\S]+?\}/);

  let scores: EvalScores = { codeQuality: 0, edgeCaseHandling: 0, complexityAnalysis: 0, requirementsClarification: 0 };
  if (jsonMatch) {
    try {
      scores = JSON.parse(jsonMatch[0]) as EvalScores;
    } catch {
      const grab = (key: string) => {
        const m = raw.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`));
        return m ? parseInt(m[1], 10) : 0;
      };
      scores = {
        codeQuality:                grab("codeQuality"),
        edgeCaseHandling:           grab("edgeCaseHandling"),
        complexityAnalysis:         grab("complexityAnalysis"),
        requirementsClarification:  grab("requirementsClarification"),
      };
    }
  }

  const reviewMatch = raw.match(/REVIEW:\s*([\s\S]+)$/);
  const review = reviewMatch ? reviewMatch[1].trim() : raw;
  const { codeQuality, edgeCaseHandling, complexityAnalysis, requirementsClarification } = scores;
  // requirementsClarification is double-weighted — it's the key agentic-round signal
  const average = Math.round((codeQuality + edgeCaseHandling + complexityAnalysis + requirementsClarification * 2) / 5);

  const validDecisions: HiringDecision[] = ["Nailed it", "Strong attempt", "On the right track", "Needs work", "Start over"];
  const hiringDecision: HiringDecision = validDecisions.find(d => raw.includes(d)) ?? "On the right track";

  return { mode: "test", scores, average, hiringDecision, review };
}

// ── Main handler (SSE streaming) ─────────────────────────────────────────────
export const submitSolution = async (req: Request, res: Response) => {
  const { problemId, code, language, chatHistory = [], aiHistory = [], mode = "test" } = req.body as {
    problemId: number;
    code: string;
    language: string;
    chatHistory: { role: "user" | "pm"; content: string }[];
    aiHistory: { role: "user" | "ai"; content: string }[];
    mode?: "practice" | "test";
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const emit = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const end = (data: unknown) => {
    emit("done", data);
    res.end();
  };

  if (!code?.trim()) return end({ status: "error", error: "No code submitted" });

  try {
    const problem = await prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem) return end({ status: "error", error: "Problem not found" });

    // Step 1 — get test inputs (use pre-generated cache, or generate fresh + cache)
    emit("stage", { stage: "generating" });

    // Try pre-generated tests first (generated when problem was loaded)
    let pregen: { functionName: string; isAsync: boolean; tests: TestInput[] } | null = null;
    try { pregen = await ensureTestsGenerated(problemId); } catch {}

    let testGen: TestGenResult;
    if (pregen) {
      // Use cached tests — still need complexity, derive it from user code quickly
      const complexityOnly = await generateTests(code, language, problem.problemStatement, problem.sealedExpectations);
      if (complexityOnly.cannotTest) return end({ status: "untestable", reason: complexityOnly.reason });
      testGen = { cannotTest: false, functionName: pregen.functionName, isAsync: pregen.isAsync, complexity: complexityOnly.complexity, tests: pregen.tests };
    } else {
      testGen = await generateTests(code, language, problem.problemStatement, problem.sealedExpectations);
    }

    if (testGen.cannotTest) {
      return end({ status: "untestable", reason: testGen.reason });
    }

    // Step 2 — run in sandbox (user code vs reference code)
    emit("stage", { stage: "running" });
    const refCode = (problem.referenceCode as Record<string, string> | null)?.[language]
      ?? (problem.referenceCode as Record<string, string> | null)?.["javascript"]
      ?? null;

    const harness = buildHarness(language, code, refCode, testGen.functionName, testGen.isAsync, testGen.tests);
    const { stdout, stderr, timedOut, exitCode } = await executeCode(language, harness);

    if (timedOut) return end({ status: "timeout" });
    if (exitCode !== 0 && !stdout) return end({ status: "runtime_error", error: stderr || "Runtime error" });

    let testResults: { description: string; passed: boolean; reason?: string; got?: unknown; expected?: unknown; threwError?: string; expectedThrow?: string }[];
    try {
      testResults = JSON.parse(stdout);
    } catch {
      return end({ status: "runtime_error", error: "Could not parse test output", raw: stdout });
    }

    // Step 3 — Mistral evaluation
    emit("stage", { stage: "analyzing" });
    const passed = testResults.filter((r) => r.passed).length;
    const evaluation = await evaluateWithMistral(
      code,
      language,
      problem.problemStatement,
      problem.sealedExpectations,
      problem.referenceCode as Record<string, string> | null,
      testGen.complexity,
      testResults,
      passed,
      chatHistory,
      aiHistory,
      mode
    );

    return end({
      status: "complete",
      score: { passed, total: testResults.length },
      complexity: testGen.complexity,
      testResults,
      evaluation,
    });
  } catch (err) {
    return end({ status: "error", error: (err as Error).message });
  }
};
