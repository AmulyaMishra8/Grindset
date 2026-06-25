// Builds the sandbox program that runs a problem's curated test cases against
// the candidate's code and prints a JSON array of per-case results to stdout.
//
// Equality is deliberately forgiving so correct solutions aren't failed on
// noise: numbers compare within 1e-6 (float/money rounding) and objects compare
// regardless of key order. Strings/booleans compare exactly.

export type TestCase = {
  description: string;
  args: unknown[];
  expect?: unknown;
  throws?: string;
};

export type TestSpec = {
  functionName: string;
  isAsync: boolean;
  cases: TestCase[];
};

export function buildRunHarness(language: string, userCode: string, spec: TestSpec): string {
  const specJson = JSON.stringify(spec);
  const fn = spec.functionName;

  if (language === "javascript" || language === "typescript") {
    return `${userCode}

// ── GRINDSET RUN HARNESS ──
;(async () => {
  const __spec = ${specJson};
  const __eq = (a, b) => {
    if (typeof a === "number" && typeof b === "number")
      return a === b || Math.abs(a - b) < 1e-6;
    if (typeof a !== typeof b) return false;
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b))
      return a.length === b.length && a.every((x, i) => __eq(x, b[i]));
    if (a && b && typeof a === "object") {
      const ka = Object.keys(a), kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && __eq(a[k], b[k]));
    }
    return false;
  };
  const __out = [];
  for (const c of __spec.cases) {
    let res, err;
    try {
      res = ${fn}(...c.args);
      if (res && typeof res.then === "function") res = await res;
    } catch (e) {
      err = (e && e.message) ? e.message : String(e);
    }
    if (c.throws !== undefined && c.throws !== null) {
      const ok = err != null && String(err).toLowerCase().includes(String(c.throws).toLowerCase());
      __out.push({ description: c.description, passed: ok, expectedThrow: c.throws, got: err == null ? "(no error)" : err });
    } else if (err != null) {
      __out.push({ description: c.description, passed: false, error: err });
    } else {
      __out.push({ description: c.description, passed: __eq(res, c.expect), got: res, expected: c.expect });
    }
  }
  console.log(JSON.stringify(__out));
})();`;
  }

  if (language === "python") {
    const safeJson = specJson.replace(/\\/g, "\\\\").replace(/'''/g, "\\'\\'\\'");
    return `${userCode}

# -- GRINDSET RUN HARNESS --
import json as _j, inspect as _i, asyncio as _a
def _eq(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return a is b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return a == b or abs(a - b) < 1e-6
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_eq(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return set(a.keys()) == set(b.keys()) and all(_eq(a[k], b[k]) for k in a)
    return a == b
_spec = _j.loads('''${safeJson}''')
_out = []
for c in _spec["cases"]:
    res = None; err = None
    try:
        res = ${fn}(*c["args"])
        if _i.iscoroutine(res):
            res = _a.new_event_loop().run_until_complete(res)
    except Exception as e:
        err = str(e)
    if c.get("throws") is not None:
        ok = err is not None and str(c["throws"]).lower() in err.lower()
        _out.append({"description": c["description"], "passed": ok, "expectedThrow": c["throws"], "got": "(no error)" if err is None else err})
    elif err is not None:
        _out.append({"description": c["description"], "passed": False, "error": err})
    else:
        _out.append({"description": c["description"], "passed": _eq(res, c.get("expect")), "got": res, "expected": c.get("expect")})
print(_j.dumps(_out))`;
  }

  throw new Error(`Unsupported language: ${language}`);
}
