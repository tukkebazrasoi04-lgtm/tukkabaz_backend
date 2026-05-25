import { Prisma } from "@prisma/client";
import { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger";

export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  const requestId = res.getHeader("x-request-id");
  const requestContext = {
    requestId,
    method: req.method,
    path: req.originalUrl
  };

  if (err instanceof AppError) {
    logger.warn("request:error", {
      ...requestContext,
      statusCode: err.statusCode,
      message: err.message,
      details: err.details
    });

    return res.status(err.statusCode).json({
      message: err.message,
      ...(err.details ? { details: err.details } : {})
    });
  }

  if (err instanceof ZodError) {
    logger.warn("request:validation-error", {
      ...requestContext,
      errors: err.flatten()
    });

    return res.status(400).json({
      message: "Validation failed",
      errors: err.flatten()
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error("request:database-error", {
      ...requestContext,
      code: err.code,
      error: err
    });

    return res.status(400).json({
      message: "Database error",
      code: err.code
    });
  }

  logger.error("request:unhandled-error", {
    ...requestContext,
    error: err
  });

  return res.status(500).json({ message: "Internal server error" });
};
