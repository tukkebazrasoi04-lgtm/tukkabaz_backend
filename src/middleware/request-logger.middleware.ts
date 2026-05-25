import { randomUUID } from "crypto";
import { type NextFunction, type Request, type Response } from "express";
import { logger, redactSensitive } from "../utils/logger";

const getRequestIp = (req: Request): string | undefined => {
  const forwardedFor = req.header("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim();
  }

  return req.ip;
};

export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.header("x-request-id") ?? randomUUID();
  const startedAt = process.hrtime.bigint();

  res.setHeader("x-request-id", requestId);

  logger.debug("request:start", {
    requestId,
    method: req.method,
    path: req.originalUrl,
    ip: getRequestIp(req),
    userAgent: req.header("user-agent"),
    body: req.method === "GET" ? undefined : redactSensitive(req.body)
  });

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level]("request:complete", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      contentLength: res.getHeader("content-length")
    });
  });

  next();
};
