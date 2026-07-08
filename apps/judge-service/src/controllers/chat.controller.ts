import { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { getConvo, appendAi } from "../lib/convoStore";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export const chat = async (req: Request, res: Response) => {
  const { problemId, code, language, message, mode = "practice" } = req.body as {
    problemId: number;
    code: string;
    language: string;
    message: string;
    mode?: "practice" | "test";
  };
  const userId = req.user!.id;

  const apiKey = process.env.FIRST_GROQ_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI service not configured" });
  if (!Number.isInteger(problemId)) return res.status(400).json({ error: "Invalid problem ID" });
  if (typeof message !== "string" || !message.trim()) return res.status(400).json({ error: "Empty message" });

  // The problem context comes from the DB, and the conversation history from the
  // server-side store — neither is trusted from the client, because both feed
  // the /submit grading.
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { title: true, problemStatement: true },
  });
  if (!problem) return res.status(404).json({ error: "Problem not found" });

  const history = getConvo(userId, problemId).ai;
  const isFirstMessage = history.filter(m => m.role === "user").length === 0;

  const systemPrompt = mode === "test"
    ? `You are a JUNIOR engineer on a team. The SENIOR engineer (the user) is leading this work and will explain the task to you. You start with NO knowledge of the problem, requirements, or context.

Current code (${language}):
\`\`\`${language}
${code || "(none yet)"}
\`\`\`

YOUR RULES — follow these strictly:
${isFirstMessage
  ? `- This is the first message. You have no idea what the task is. Greet the senior briefly and say you're ready to help once they share what needs to be built.`
  : `- Only work with what the senior has explicitly told you so far. If their instructions are vague or missing details, ask one specific question about exactly what's unclear.`}
- Do NOT infer, assume, or fill in gaps from the existing code. Only use what the senior tells you.
- If the senior gives you too little to work with, tell them what specific information you need before you can proceed.
- When you write code, flag your assumptions and the exact parts you'd want the senior to verify.
- Never say "this should work" or "this is correct." The senior reviews your code.
- Keep responses short. One thing at a time.`
    : `You are a JUNIOR engineer on a team. The user is the SENIOR engineer leading this work. You are helping them solve the following problem:

Problem: ${problem.title}
Description: ${problem.problemStatement}

Current code (${language}):
\`\`\`${language}
${code || "(none yet)"}
\`\`\`

YOUR RULES — follow these strictly:
${isFirstMessage
  ? `- This is the first message. The senior just shared the problem. Do NOT write any code. Instead, read the problem carefully and ask 2-3 clarifying questions about ambiguities or missing requirements you notice. Surface edge cases and potential traps. Wait for their decisions before doing anything.`
  : `- Only implement the specific step the senior asks for. One step at a time. Never get ahead of them.`}
- Do NOT write a full solution unprompted. If asked to "just solve it" or "write the whole thing", push back: say you'd rather go step by step so they stay in control.
- When you write code, you are NOT infallible. Write what you think is correct, but always end with something like "take a look at [specific part] — I'm not 100% sure I got [X] right." Be specific about what to double-check, not vague.
- Never say "this should work", "this is correct", or "this is good to go." You don't know — the senior reviews your code.
- After writing any code, flag: (1) assumptions you made, (2) the one or two things you'd most want them to verify.
- Never hide uncertainty. If a requirement is unclear, say so explicitly rather than guessing silently.
- When asked for tests, write them — but ask the senior which edge cases they want covered rather than deciding yourself.
- Keep responses short. One thing at a time.`;

  const groqMessages = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODEL, messages: groqMessages, max_tokens: 1024 }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.json();
      return res.status(502).json({ error: "AI service error", detail: err });
    }

    const data = (await groqRes.json()) as { choices: { message: { content: string } }[] };
    const reply = data.choices[0]?.message?.content ?? "";

    // Record the exchange server-side — this is what /submit grades against.
    appendAi(userId, problemId, { role: "user", content: message }, { role: "ai", content: reply });

    return res.json({ reply });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
};
