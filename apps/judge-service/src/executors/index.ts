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

const LANG_CONFIG: Record<string, { ext: string; cmd: string; args: (f: string) => string[] }> = {
  javascript: { ext: "js",  cmd: "node",   args: (f) => [f] },
  typescript: { ext: "ts",  cmd: "npx",    args: (f) => ["tsx", f] },
  python:     { ext: "py",  cmd: "python", args: (f) => [f] },
};

export async function executeCode(language: string, code: string): Promise<ExecuteResult> {
  const config = LANG_CONFIG[language];
  if (!config) throw new Error(`Unsupported language: ${language}`);

  const filename = join(tmpdir(), `grindset_${randomUUID()}.${config.ext}`);
  await writeFile(filename, code, "utf8");

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn(config.cmd, config.args(filename), {
      timeout: TIMEOUT_MS,
      env: { ...process.env, PATH: process.env.PATH },
    });

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, TIMEOUT_MS);

    proc.on("close", async (code) => {
      clearTimeout(timer);
      await unlink(filename).catch(() => {});
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), timedOut, exitCode: code ?? 1 });
    });
  });
}
