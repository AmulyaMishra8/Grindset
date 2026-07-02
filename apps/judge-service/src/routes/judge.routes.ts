import { Router } from "express";
import { runCode } from "../controllers/judge.controller";
import { submitSolution } from "../controllers/submit.controller";
import { chat } from "../controllers/chat.controller";
import { pmChat } from "../controllers/pm-chat.controller";
import { getProblem, listProblems, listPracticeProblems, listTestProblems, startProblemSession } from "../controllers/problems.controller";
import { getTests } from "../controllers/tests.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// Everything here costs money (LLM calls), runs code, or exposes problem
// internals — all of it requires a logged-in user.
router.use(requireAuth);

router.get("/problems", listProblems);
router.get("/practice/problems", listPracticeProblems);
router.get("/test/problems", listTestProblems);
router.get("/problems/:id", getProblem);
router.get("/problems/:id/tests", getTests);
router.post("/problems/:id/start", startProblemSession);
router.post("/run", runCode);
router.post("/submit", submitSolution);
router.post("/chat", chat);
router.post("/pm-chat", pmChat);

export default router;
