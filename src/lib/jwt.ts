import jwt, { type SignOptions } from "jsonwebtoken";
import { type Role } from "@prisma/client";
import { env } from "../config/env";

export type AccessTokenPayload = {
  userId: string;
  email: string;
  role: Role;
  sessionId: string;
};

export type RefreshTokenPayload = {
  userId: string;
  sessionId: string;
};

const durationUnitToMs: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
};

export const parseDurationToMs = (value: string): number => {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  return amount * durationUnitToMs[unit];
};

export const getRefreshExpiryDate = (): Date =>
  new Date(Date.now() + parseDurationToMs(env.REFRESH_TOKEN_EXPIRES_IN));

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions["expiresIn"]
  });

export const signRefreshToken = (payload: RefreshTokenPayload): string =>
  jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as SignOptions["expiresIn"]
  });

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessTokenPayload;

export const verifyRefreshToken = (token: string): RefreshTokenPayload =>
  jwt.verify(token, env.REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
