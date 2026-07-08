import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

export type ExecuteResult = {
  stdout: string;
  stderr: string;
  timedOut: boolean;
  exitCode: number;
};

const TIMEOUT_MS = 5000;

// The child process runs UNTRUSTED user code — it must never see this service's
// secrets (DB URLs, LLM API keys). Only what node/python/npx need to start is
// passed through; everything else is withheld.
const ENV_ALLOWLIST = new Set([
  "PATH", "LANG", "LC_ALL", "TZ",
  // Windows: process spawning + temp dirs
  "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP",
  // npx/node resolution caches
  "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "XDG_CACHE_HOME", "TMPDIR",
]);

function sandboxEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of Object.keys(process.env)) {
    if (ENV_ALLOWLIST.has(key.toUpperCase())) env[key] = process.env[key];
  }
  return env;
}

// A runnable interpreter invocation. Each language lists candidates in priority
// order; we fall through to the next one only when the binary itself is missing
// (spawn ENOENT), so a Linux box with `python3` but no `python` still works.
type Candidate = { cmd: string; args: (f: string) => string[] };

const IS_WIN = process.platform === "win32";
const NPX = IS_WIN ? "npx.cmd" : "npx";

const LANG_CONFIG: Record<string, { ext: string; candidates: Candidate[] }> = {
  // Use the running node binary directly — never assume `node` is on PATH.
  javascript: { ext: "js", candidates: [{ cmd: process.execPath, args: (f) => [f] }] },
  // tsx as a node loader is the robust path (no npx cache / network); npx is a
  // fallback for environments where the loader flag isn't picked up.
  typescript: {
    ext: "ts",
    candidates: [
      { cmd: process.execPath, args: (f) => ["--import", "tsx", f] },
      { cmd: NPX, args: (f) => ["tsx", f] },
    ],
  },
  // Linux (Render) ships `python3`; local Windows dev has `python`. Try both.
  python: {
    ext: "py",
    candidates: [
      { cmd: "python3", args: (f) => [f] },
      { cmd: "python", args: (f) => [f] },
    ],
  },
};

function runCandidate(cand: Candidate, filename: string): Promise<ExecuteResult & { spawnFailed?: boolean }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const done = (r: ExecuteResult & { spawnFailed?: boolean }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };

    const proc = spawn(cand.cmd, cand.args(filename), { env: sandboxEnv() });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, TIMEOUT_MS);

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    // Without this, a missing binary emits 'error', never 'close', and the
    // promise would hang forever — the original bug for non-JS languages.
    proc.on("error", (err: NodeJS.ErrnoException) => {
      const missing = err.code === "ENOENT";
      done({ stdout: "", stderr: err.message, timedOut: false, exitCode: 127, spawnFailed: missing });
    });

    proc.on("close", (code) => {
      done({ stdout: stdout.trim(), stderr: stderr.trim(), timedOut, exitCode: code ?? 1 });
    });
  });
}

// Runs a trivial program through the real execution path for each language so
// we can confirm — from the actual deploy environment — which interpreters are
// present. Surfaced at startup and via /health; the sandbox degrades gracefully
// (clear error, no hang) for any that are missing.
export async function probeInterpreters(): Promise<Record<string, { ok: boolean; detail: string }>> {
  const checks: Record<string, string> = {
    javascript: `console.log("ok")`,
    typescript: `const __x: string = "ok"; console.log(__x)`,
    python: `print("ok")`,
  };
  const out: Record<string, { ok: boolean; detail: string }> = {};
  for (const [lang, code] of Object.entries(checks)) {
    try {
      const r = await executeCode(lang, code);
      out[lang] = { ok: r.stdout === "ok" && r.exitCode === 0, detail: r.stdout || r.stderr || `exit ${r.exitCode}` };
    } catch (e) {
      out[lang] = { ok: false, detail: (e as Error).message };
    }
  }
  return out;
}

export async function executeCode(language: string, code: string): Promise<ExecuteResult> {
  const config = LANG_CONFIG[language];
  if (!config) throw new Error(`Unsupported language: ${language}`);

  const filename = join(tmpdir(), `grindset_${randomUUID()}.${config.ext}`);
  await writeFile(filename, code, "utf8");

  try {
    let last: ExecuteResult & { spawnFailed?: boolean } = {
      stdout: "", stderr: `No interpreter available for ${language}`, timedOut: false, exitCode: 127,
    };
    for (const cand of config.candidates) {
      last = await runCandidate(cand, filename);
      // Only advance to the next candidate when the binary was missing; a real
      // runtime error (non-zero exit with output) is the user's code failing.
      if (!last.spawnFailed) break;
    }
    const { spawnFailed, ...result } = last;
    return result;
  } finally {
    await unlink(filename).catch(() => {});
  }
}
