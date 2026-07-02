import { Router, raw } from "express";
import { z } from "zod";
import * as interview from "../controllers/interviewController";
import { ROLE_IDS } from "../interview/personas";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { rateLimit } from "../middleware/rateLimit";

export const interviewRouter = Router();

const sessionSchema = z.object({
  role: z.enum(ROLE_IDS as [string, ...string[]]),
});
const messageSchema = z.object({
  sessionId: z.string().min(1),
  text: z.string().trim().min(1).max(4000),
});
const endSchema = z.object({ sessionId: z.string().min(1) });

// LLM/STT calls cost tokens, so throttle the chatty endpoints per user.
const turnLimiter = rateLimit({ windowSeconds: 60, max: 40 });
const sttLimiter = rateLimit({ windowSeconds: 60, max: 30 });

// Everything here requires a logged-in user (we key quota + history by user).
interviewRouter.get("/roles", requireAuth, asyncHandler(interview.listRoles));
interviewRouter.get("/history", requireAuth, asyncHandler(interview.history));

interviewRouter.post(
  "/session",
  requireAuth,
  rateLimit({ windowSeconds: 60, max: 10 }),
  validate(sessionSchema),
  asyncHandler(interview.startSession),
);

// Raw audio upload → Whisper. The global express.json({limit:"10kb"}) only
// parses application/json, so a binary audio content-type sails past it; we
// then buffer the body here with a generous cap (~12 MB ≈ minutes of Opus).
interviewRouter.post(
  "/stt",
  requireAuth,
  sttLimiter,
  raw({ type: () => true, limit: "12mb" }),
  asyncHandler(interview.transcribe),
);

interviewRouter.post(
  "/message",
  requireAuth,
  turnLimiter,
  validate(messageSchema),
  asyncHandler(interview.postMessage),
);

interviewRouter.post(
  "/end",
  requireAuth,
  validate(endSchema),
  asyncHandler(interview.endSession),
);
