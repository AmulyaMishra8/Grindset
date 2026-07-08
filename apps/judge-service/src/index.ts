import "dotenv/config";
import express from "express";
import cors from "cors";
import judgeRoutes from "./routes/judge.routes";
import { prisma } from "./db/prisma";
import { probeInterpreters } from "./executors/index";

// Cached at startup so /health can report interpreter availability without
// re-spawning processes on every hit.
let interpreterStatus: Record<string, { ok: boolean; detail: string }> = {};

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4002;

// Credentialed requests (the web app sends cookies) can't use a wildcard origin,
// so reflect the configured web origin (falls back to echoing the request origin).
app.use(cors({ origin: process.env.WEB_ORIGIN || true, credentials: true }));
app.use(express.json());

app.use("/api/judge", judgeRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "judge-service", interpreters: interpreterStatus });
});

app.listen(PORT, async () => {
  console.log(`Judge service running on http://localhost:${PORT}`);

  // Confirm which language interpreters this environment actually has — logged
  // once so the first deploy tells us whether python3/tsx are present on Render.
  probeInterpreters().then((status) => {
    interpreterStatus = status;
    console.log("[judge] interpreter availability:", JSON.stringify(status));
  }).catch(() => {});

  // Warm the DB connection on startup so the first user request isn't slow
  try { await prisma.$queryRaw`SELECT 1`; } catch {}

  // Ping every 4 minutes to prevent Neon from suspending the compute
  setInterval(async () => {
    try { await prisma.$queryRaw`SELECT 1`; } catch {}
  }, 4 * 60 * 1000);
});
