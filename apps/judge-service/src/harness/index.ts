type TestCase = { input: unknown[]; expectedOutput: unknown };

export function buildHarness(
  language: string,
  userCode: string,
  functionName: string,
  testCases: TestCase[]
): string {
  const casesJson = JSON.stringify(testCases);

  if (language === "javascript" || language === "typescript") {
    return `
${userCode}

// === GRINDSET HARNESS ===
const __cases = ${casesJson};
for (const c of __cases) {
  try {
    const result = ${functionName}(...c.input);
    process.stdout.write(JSON.stringify({ ok: true, result }) + "\\n");
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: e.message }) + "\\n");
  }
}
`;
  }

  if (language === "python") {
    return `
${userCode}

# === GRINDSET HARNESS ===
import json as _json, sys as _sys
__cases = _json.loads("""${casesJson.replace(/\\/g, "\\\\").replace(/"""/g, "\\\"\\\"\\\"").replace(/\n/g, "\\n")}""")
__sol = Solution()
for __c in __cases:
    try:
        __r = __sol.${functionName}(*__c["input"])
        print(_json.dumps({"ok": True, "result": __r}))
    except Exception as __e:
        print(_json.dumps({"ok": False, "error": str(__e)}))
`;
  }

  throw new Error(`No harness available for language: ${language}`);
}

export function parseHarnessOutput(
  stdout: string,
  testCases: TestCase[]
): { passed: boolean; output: unknown; expected: unknown; error?: string }[] {
  const lines = stdout.split("\n").filter(Boolean);

  return testCases.map((tc, i) => {
    const line = lines[i];
    if (!line) return { passed: false, output: null, expected: tc.expectedOutput, error: "No output" };

    try {
      const parsed = JSON.parse(line) as { ok: boolean; result?: unknown; error?: string };
      if (!parsed.ok) return { passed: false, output: null, expected: tc.expectedOutput, error: parsed.error };

      const passed = JSON.stringify(parsed.result) === JSON.stringify(tc.expectedOutput);
      return { passed, output: parsed.result, expected: tc.expectedOutput };
    } catch {
      return { passed: false, output: line, expected: tc.expectedOutput, error: "Parse error" };
    }
  });
}
