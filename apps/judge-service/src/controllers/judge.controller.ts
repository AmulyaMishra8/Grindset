import { Request, Response } from "express";

export const runCode = async (_req: Request, res: Response) => {
  return res.json({
    status: "open_ended",
    message: "This is an open-ended engineering problem — there are no automated test cases. Write your solution, then use the AI assistant to review it or ask Ethan about the requirements.",
  });
};

export const submitCode = async (_req: Request, res: Response) => {
  return res.json({
    status: "open_ended",
    message: "Open-ended problems are not auto-graded. Reveal the Answer Key to check your own work against the expected requirements.",
  });
};
