import "dotenv/config";
import express from "express";
import cors from "cors";
import judgeRoutes from "./routes/judge.routes";
import { prisma } from "./db/prisma";

const app = express();
const PORT = 4002;

app.use(cors());
app.use(express.json());

app.use("/api/judge", judgeRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "judge-service" });
});

app.listen(PORT, async () => {
  console.log(`Judge service running on http://localhost:${PORT}`);

  // Warm the DB connection on startup so the first user request isn't slow
  try { await prisma.$queryRaw`SELECT 1`; } catch {}

  // Ping every 4 minutes to prevent Neon from suspending the compute
  setInterval(async () => {
    try { await prisma.$queryRaw`SELECT 1`; } catch {}
  }, 4 * 60 * 1000);
});
