import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const durationRegex = /^\d+[smhd]$/;
const booleanString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  return value.toLowerCase() === "true";
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ACCESS_TOKEN_SECRET: z.string().min(1, "ACCESS_TOKEN_SECRET is required"),
  REFRESH_TOKEN_SECRET: z.string().min(1, "REFRESH_TOKEN_SECRET is required"),
  ACCESS_TOKEN_EXPIRES_IN: z
    .string()
    .regex(durationRegex, "ACCESS_TOKEN_EXPIRES_IN must be like 15m, 1h, 30s"),
  REFRESH_TOKEN_EXPIRES_IN: z
    .string()
    .regex(durationRegex, "REFRESH_TOKEN_EXPIRES_IN must be like 30d, 12h"),
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, "FIREBASE_CLIENT_EMAIL is required"),
  FIREBASE_PRIVATE_KEY: z.string().min(1, "FIREBASE_PRIVATE_KEY is required"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(6).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  CLOUDINARY_UPLOAD_PRESET: z.string().min(1).optional(),
  CLOUDINARY_FOLDER: z.string().min(1).default("tukkabaz"),
  FAST2SMS_API_KEY: z.string().min(1).optional(),
  FAST2SMS_SENDER_ID: z.string().min(1).optional(),
  OTP_DEV_MODE: booleanString.default(false),
  KITCHEN_PHONE_NUMBER: z.string().min(7).optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
