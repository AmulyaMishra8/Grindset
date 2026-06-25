import { Request, Response } from "express";
import type { ApiResponse } from "@grindset/shared-types";

type User = { id: string; name: string };

export const getUsers = (_req: Request, res: Response) => {
  const response: ApiResponse<User[]> = {
    data: [],
    message: "Users fetched successfully",
  };
  res.json(response);
};
