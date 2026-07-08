import type { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { Errors } from "../lib/AppError";
import { logger } from "../lib/logger";
import {
  PERSONAS,
  ROLE_IDS,
  publicRole,
  type RoleId,
} from "../interview/personas";
import { chatCompletion, transcribeAudio, interviewConfigured } from "../interview/groq";
import {
  createSession,
  getSession,
  save,
  deleteSession,
  visibleTranscript,
  type InterviewState,
} from "../interview/sessionStore";
import { consumeQuota, getQuota } from "../interview/quota";
import { gradeInterview } from "../interview/grading";

// A turn-limit safety net so a runaway session can't grow the LLM context (and
// token cost) without bound. The user can always /end sooner.
const MAX_QUESTIONS = 20;

// Pull the candidate's spoken answer out of the persisted/visible turns to send
// back to the stateless model.
function toChatMessages(state: InterviewState) {
  return state.turns.map((t) => ({ role: t.role, content: t.content }));
}

// Ensure the caller owns the session (sessions are per-user).
function assertOwner(state: InterviewState | null, userId: string): asserts state is InterviewState {
  if (!state) throw Errors.notFound("Interview session not found or expired");
  if (state.userId !== userId) throw Errors.forbidden("This interview belongs to another user");
}

// GET /roles — metadata for the role picker + the caller's remaining budget.
export async function listRoles(req: Request, res: Response) {
  const quota = await getQuota(req.user!.id);
  res.json({
    configured: interviewConfigured(),
    quota,
    roles: ROLE_IDS.map((id) => publicRole(PERSONAS[id])),
  });
}

// POST /session { role } — start a new interview (consumes daily quota).
export async function startSession(req: Request, res: Response) {
  const role = req.body.role as RoleId;
  const persona = PERSONAS[role];
  const userId = req.user!.id;

  if (!interviewConfigured()) throw Errors.badRequest("AI interview is not configured on this server");

  const quota = await consumeQuota(userId);
  if (!quota.allowed) {
    throw Errors.tooMany(
      `You've used all ${quota.limit} interviews for today. Come back tomorrow!`,
    );
  }

  const state = await createSession({
    userId,
    role: persona.id,
    personaLabel: persona.label,
    systemPrompt: persona.systemPrompt,
    opening: persona.openingQuestion,
  });

  res.status(201).json({
    sessionId: state.sessionId,
    role: persona.id,
    persona: publicRole(persona),
    opening: { text: persona.openingQuestion },
    quota: { used: quota.used, limit: quota.limit, remaining: quota.remaining },
  });
}

// POST /stt — raw audio body (express.raw) → Groq Whisper → { text }.
export async function transcribe(req: Request, res: Response) {
  const audio = req.body as Buffer;
  if (!Buffer.isBuffer(audio) || audio.length === 0) {
    throw Errors.badRequest("No audio received");
  }
  const mimeType = req.get("content-type") || "audio/webm";
  const text = await transcribeAudio(audio, mimeType);
  res.json({ text });
}

// POST /message { sessionId, text } — one candidate turn → interviewer reply.
export async function postMessage(req: Request, res: Response) {
  const { sessionId, text } = req.body as { sessionId: string; text: string };
  const userId = req.user!.id;

  const state = await getSession(sessionId);
  assertOwner(state, userId);
  if (state.ended) throw Errors.badRequest("This interview has already ended");

  state.turns.push({ role: "user", content: text });

  // Once we hit the question cap, instruct the interviewer to wrap up.
  const atCap = state.questionCount >= MAX_QUESTIONS;
  const messages = toChatMessages(state);
  if (atCap) {
    messages.push({
      role: "system",
      content:
        "You have reached the end of the interview. Do NOT ask another question. Thank the candidate warmly and let them know you'll share feedback now.",
    });
  }

  const reply = await chatCompletion(messages, { maxTokens: 500, temperature: 0.6 });
  state.turns.push({ role: "assistant", content: reply });
  if (!atCap) state.questionCount += 1;
  await save(state);

  res.json({
    reply: { text: reply },
    questionCount: state.questionCount,
    atCap,
  });
}

// POST /end { sessionId } — grade, persist, tear down the live session.
export async function endSession(req: Request, res: Response) {
  const { sessionId } = req.body as { sessionId: string };
  const userId = req.user!.id;

  const state = await getSession(sessionId);
  assertOwner(state, userId);

  const persona = PERSONAS[state.role];
  const transcript = visibleTranscript(state);
  const durationS = Math.max(0, Math.round((Date.now() - state.startedAt) / 1000));

  const scorecard = await gradeInterview(persona, transcript);

  // Persist the finished interview. If the DB write fails (e.g. table not yet
  // migrated), still return the scorecard — the live experience shouldn't break
  // on a history-logging hiccup.
  let saved = false;
  try {
    await prisma.interviewSession.create({
      data: {
        userId,
        role: state.role,
        transcript: transcript as object[] as never,
        scorecard: scorecard as object as never,
        durationS,
      },
    });
    saved = true;
  } catch (err) {
    logger.error({ err: (err as Error).message }, "failed to persist interview session");
  }

  state.ended = true;
  await deleteSession(sessionId);

  res.json({ scorecard, transcript, durationS, persisted: saved });
}

// GET /history — the user's past interviews (most recent first).
export async function history(req: Request, res: Response) {
  const userId = req.user!.id;
  try {
    const rows = await prisma.interviewSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, role: true, scorecard: true, durationS: true, createdAt: true },
    });
    res.json(
      rows.map((r) => ({
        id: r.id,
        role: r.role,
        roleLabel: PERSONAS[r.role as RoleId]?.label ?? r.role,
        overall: (r.scorecard as { overall?: number } | null)?.overall ?? null,
        durationS: r.durationS,
        createdAt: r.createdAt,
      })),
    );
  } catch (err) {
    // History is non-critical; degrade to empty rather than erroring the page.
    logger.warn({ err: (err as Error).message }, "interview history query failed");
    res.json([]);
  }
}
