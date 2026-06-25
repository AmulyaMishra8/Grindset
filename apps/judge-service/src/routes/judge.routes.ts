import { Router } from "express";
import { runCode } from "../controllers/judge.controller";
import { submitSolution } from "../controllers/submit.controller";
import { chat } from "../controllers/chat.controller";
import { pmChat } from "../controllers/pm-chat.controller";
import { getProblem, revealProblem, listProblems, listPracticeProblems, listTestProblems } from "../controllers/problems.controller";
import { getTests } from "../controllers/tests.controller";

const router = Router();

router.get("/problems", listProblems);
router.get("/practice/problems", listPracticeProblems);
router.get("/test/problems", listTestProblems);
router.get("/problems/:id", getProblem);
router.get("/problems/:id/reveal", revealProblem);
router.get("/problems/:id/tests", getTests);
router.post("/run", runCode);
router.post("/submit", submitSolution);
router.post("/chat", chat);
router.post("/pm-chat", pmChat);

export default router;
