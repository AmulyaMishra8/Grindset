import { Request, Response } from "express";
import { prisma } from "../db/prisma";

const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

type Bucket = { solved: number; attempted: number; total: number };

// Progress for the signed-in user. "Solved" means a /submit where every
// generated test passed (Submission.solved); "attempted" means any /submit that
// got far enough to run tests. Both are counted per distinct problem, so
// re-submitting the same problem never inflates the numbers.
export const getMyStats = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const [problems, submissions] = await Promise.all([
    prisma.problem.findMany({ select: { id: true, difficulty: true } }),
    prisma.submission.findMany({
      where: { userId },
      select: { problemId: true, solved: true },
    }),
  ]);

  const solvedIds = new Set<number>();
  const attemptedIds = new Set<number>();
  for (const s of submissions) {
    attemptedIds.add(s.problemId);
    if (s.solved) solvedIds.add(s.problemId);
  }

  const empty = (): Bucket => ({ solved: 0, attempted: 0, total: 0 });
  const byDifficulty: Record<Difficulty, Bucket> = {
    Easy: empty(),
    Medium: empty(),
    Hard: empty(),
  };

  for (const p of problems) {
    // Difficulty is a free-text column; ignore anything outside the known three
    // rather than crashing on a typo in the seed.
    const bucket = byDifficulty[p.difficulty as Difficulty];
    if (!bucket) continue;
    bucket.total += 1;
    if (attemptedIds.has(p.id)) bucket.attempted += 1;
    if (solvedIds.has(p.id)) bucket.solved += 1;
  }

  const totals = DIFFICULTIES.reduce(
    (acc, d) => ({
      solved: acc.solved + byDifficulty[d].solved,
      attempted: acc.attempted + byDifficulty[d].attempted,
      total: acc.total + byDifficulty[d].total,
    }),
    empty(),
  );

  res.json({ ...totals, byDifficulty });
};
