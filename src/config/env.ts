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
  // Email (Brevo HTTP API) for verification + password-reset codes.
  EMAIL_DEV_MODE: booleanString.default(false),
  BREVO_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().min(1).default("Tukkabaz"),
  KITCHEN_PHONE_NUMBER: z.string().min(7).optional(),
  KITCHEN_EMAIL: z.string().email().optional(),
  KITCHEN_PASSWORD: z.string().min(4).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  // Secret configured in the Razorpay dashboard for the webhook endpoint. Used to
  // verify that incoming webhook calls genuinely came from Razorpay.
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Support phone number shown in the app (e.g. +919876543210)
  SUPPORT_PHONE: z.string().min(7).optional()
}).superRefine((data, ctx) => {
  // In production, real payments must be verifiable: keys cannot be missing
  // (otherwise the server would silently accept unverified "simulated" payments).
  if (data.NODE_ENV === "production") {
    if (!data.RAZORPAY_KEY_ID || !data.RAZORPAY_KEY_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in production."
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
