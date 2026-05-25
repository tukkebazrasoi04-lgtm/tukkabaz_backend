import { type Response } from "express";

export const sendSuccess = <T>(res: Response, data: T, statusCode = 200): Response =>
  res.status(statusCode).json(data);
