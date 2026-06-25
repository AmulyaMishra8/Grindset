import type { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { Errors } from "../lib/AppError";

// ── helpers ──────────────────────────────────────────────────────────────────
type VoteRow = { value: number; userId: string };
type Author = { displayName: string | null; email: string };

const authorSelect = { select: { displayName: true, email: true } } as const;
const voteSelect = { select: { value: true, userId: true } } as const;

const score = (votes: VoteRow[]) => votes.reduce((s, v) => s + v.value, 0);
const myVote = (votes: VoteRow[], uid?: string) =>
  uid ? votes.find((v) => v.userId === uid)?.value ?? 0 : 0;
const authorName = (a: Author) => a.displayName?.trim() || a.email.split("@")[0];

// ── threads ──────────────────────────────────────────────────────────────────
export async function listThreads(req: Request, res: Response) {
  const sort = req.query.sort === "top" ? "top" : "new";
  const uid = req.user?.id;

  const threads = await prisma.thread.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: authorSelect, votes: voteSelect, _count: { select: { comments: true } } },
  });

  let mapped = threads.map((t) => ({
    id: t.id,
    title: t.title,
    excerpt: t.body.length > 180 ? t.body.slice(0, 180).trimEnd() + "…" : t.body,
    author: authorName(t.author),
    createdAt: t.createdAt,
    score: score(t.votes),
    myVote: myVote(t.votes, uid),
    commentCount: t._count.comments,
  }));

  if (sort === "top") mapped = mapped.sort((a, b) => b.score - a.score);
  res.json(mapped);
}

export async function createThread(req: Request, res: Response) {
  const { title, body } = req.body as { title: string; body: string };
  const thread = await prisma.thread.create({ data: { title, body, authorId: req.user!.id } });
  res.status(201).json({ id: thread.id });
}

export async function getThread(req: Request, res: Response) {
  const uid = req.user?.id;
  const t = await prisma.thread.findUnique({
    where: { id: req.params.id },
    include: {
      author: authorSelect,
      votes: voteSelect,
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: authorSelect, votes: voteSelect },
      },
    },
  });
  if (!t) throw Errors.notFound("Thread not found");

  res.json({
    id: t.id,
    title: t.title,
    body: t.body,
    author: authorName(t.author),
    createdAt: t.createdAt,
    score: score(t.votes),
    myVote: myVote(t.votes, uid),
    comments: t.comments.map((c) => ({
      id: c.id,
      body: c.body,
      author: authorName(c.author),
      createdAt: c.createdAt,
      score: score(c.votes),
      myVote: myVote(c.votes, uid),
    })),
  });
}

export async function addComment(req: Request, res: Response) {
  const { body } = req.body as { body: string };
  const thread = await prisma.thread.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!thread) throw Errors.notFound("Thread not found");
  const comment = await prisma.comment.create({
    data: { body, threadId: thread.id, authorId: req.user!.id },
  });
  res.status(201).json({ id: comment.id });
}

// ── voting (toggle: re-clicking the same direction clears the vote) ──────────
export async function voteThread(req: Request, res: Response) {
  const value = req.body.value as 1 | -1;
  const threadId = req.params.id;
  const userId = req.user!.id;

  const existing = await prisma.threadVote.findUnique({
    where: { threadId_userId: { threadId, userId } },
  });
  if (existing && existing.value === value) {
    await prisma.threadVote.delete({ where: { id: existing.id } });
  } else {
    await prisma.threadVote.upsert({
      where: { threadId_userId: { threadId, userId } },
      create: { threadId, userId, value },
      update: { value },
    });
  }

  const agg = await prisma.threadVote.aggregate({ where: { threadId }, _sum: { value: true } });
  res.json({ score: agg._sum.value ?? 0, myVote: existing?.value === value ? 0 : value });
}

export async function voteComment(req: Request, res: Response) {
  const value = req.body.value as 1 | -1;
  const commentId = req.params.id;
  const userId = req.user!.id;

  const existing = await prisma.commentVote.findUnique({
    where: { commentId_userId: { commentId, userId } },
  });
  if (existing && existing.value === value) {
    await prisma.commentVote.delete({ where: { id: existing.id } });
  } else {
    await prisma.commentVote.upsert({
      where: { commentId_userId: { commentId, userId } },
      create: { commentId, userId, value },
      update: { value },
    });
  }

  const agg = await prisma.commentVote.aggregate({ where: { commentId }, _sum: { value: true } });
  res.json({ score: agg._sum.value ?? 0, myVote: existing?.value === value ? 0 : value });
}
