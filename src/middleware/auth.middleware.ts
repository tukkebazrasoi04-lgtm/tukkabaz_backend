import { type NextFunction, type Request, type Response } from "express";
import { type Role } from "@prisma/client";
import { verifyAccessToken } from "../lib/jwt";
import { AppError } from "./error.middleware";

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new AppError(401, "Missing or invalid Authorization header"));
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    next(new AppError(401, "Access token is required"));
    return;
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch {
    next(new AppError(401, "Invalid or expired access token"));
  }
};

export const requireRoles = (...roles: Role[]) => (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    next(new AppError(401, "Unauthorized"));
    return;
  }

  if (!roles.includes(req.user.role)) {
    next(new AppError(403, "Forbidden"));
    return;
  }

  next();
};
