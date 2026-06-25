import { Router } from "express";
import { z } from "zod";
import * as discuss from "../controllers/discussController";
import { requireAuth } from "../middleware/requireAuth";
import { optionalAuth } from "../middleware/optionalAuth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { rateLimit } from "../middleware/rateLimit";

export const discussRouter = Router();

const createThreadSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(10000),
});
const commentSchema = z.object({ body: z.string().trim().min(1).max(5000) });
const voteSchema = z.object({ value: z.union([z.literal(1), z.literal(-1)]) });

// Modest write limiter to curb spam (posts/comments).
const writeLimiter = rateLimit({ windowSeconds: 60, max: 20 });

// Reads are public but personalise via optionalAuth (your own vote direction).
discussRouter.get("/threads", optionalAuth, asyncHandler(discuss.listThreads));
discussRouter.get("/threads/:id", optionalAuth, asyncHandler(discuss.getThread));

// Writes require a logged-in user.
discussRouter.post("/threads", requireAuth, writeLimiter, validate(createThreadSchema), asyncHandler(discuss.createThread));
discussRouter.post("/threads/:id/comments", requireAuth, writeLimiter, validate(commentSchema), asyncHandler(discuss.addComment));
discussRouter.post("/threads/:id/vote", requireAuth, validate(voteSchema), asyncHandler(discuss.voteThread));
discussRouter.post("/comments/:id/vote", requireAuth, validate(voteSchema), asyncHandler(discuss.voteComment));
