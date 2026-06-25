import { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { executeCode } from "../executors/index";
import { buildRunHarness, type TestSpec } from "../executors/runHarness";

type CaseResult = {
  description: string;
  passed: boolean;
  expected?: unknown;
  got?: unknown;
  error?: string;
  expectedThrow?: string;
};

// Runs the problem's curated test cases against the candidate's code in the
// sandbox and returns per-case pass/fail. This is the "Run" button — fast,
// deterministic, and separate from the deeper AI "Submit" evaluation.
export const runCode = async (req: Request, res: Response) => {
  const { problemId, code, language = "javascript" } = req.body as {
    problemId: number;
    code: string;
    language: string;
  };

  if (!code?.trim()) return res.json({ status: "empty", error: "Write some code first." });

  const problem = await prisma.problem.findUnique({ where: { id: problemId } });
  if (!problem) return res.status(404).json({ status: "error", error: "Problem not found" });

  const spec = problem.testCases as TestSpec | null;
  if (!spec || !spec.cases?.length) {
    return res.json({ status: "no_tests", message: "This problem has no automated tests yet." });
  }

  try {
    const harness = buildRunHarness(language, code, spec);
    const { stdout, stderr, timedOut, exitCode } = await executeCode(language, harness);

    if (timedOut) return res.json({ status: "timeout" });
    if (!stdout) {
      return res.json({ status: "runtime_error", error: stderr || `Exited ${exitCode} with no output` });
    }

    let results: CaseResult[];
    try {
      results = JSON.parse(stdout);
    } catch {
      return res.json({
        status: "runtime_error",
        error: "Could not parse test output",
        raw: stdout.slice(0, 500),
        stderr: stderr.slice(0, 500),
      });
    }

    const passed = results.filter((r) => r.passed).length;
    return res.json({ status: "ran", passed, total: results.length, results });
  } catch (err) {
    return res.json({ status: "error", error: (err as Error).message });
  }
};

// Legacy alias kept for the route barrel; real grading lives in
// submit.controller.ts (submitSolution).
export const submitCode = async (_req: Request, res: Response) => {
  return res.json({ status: "moved", message: "Use /submit (submitSolution)." });
};
