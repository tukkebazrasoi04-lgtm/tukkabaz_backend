import { z } from "zod";

export const firebaseAuthSchema = z.object({
  idToken: z.string().min(1, "idToken is required")
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required")
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken cannot be empty").optional()
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email("Valid email is required")
});

export const emailVerificationRequestSchema = z.object({
  email: z.string().email("Valid email is required")
});

export const emailVerifySchema = z.object({
  email: z.string().email("Valid email is required"),
  otp: z.string().min(4).max(8)
});

export const passwordResetVerifySchema = z.object({
  email: z.string().email("Valid email is required"),
  otp: z.string().min(4).max(8),
  password: z.string().min(6, "Password must be at least 6 characters")
});

export const userOtpRequestSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().min(7).max(20)
});

export const userOtpVerifySchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().min(7).max(20),
  otp: z.string().min(4).max(8)
});

export const phoneVerificationRequestSchema = z.object({
  phone: z.string().min(7).max(20)
});

export const phoneVerificationVerifySchema = z.object({
  phone: z.string().min(7).max(20),
  otp: z.string().min(4).max(8)
});

export const saveDeliveryAddressSchema = z.object({
  address: z.string().trim().min(3).max(500),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180)
});

export const adminLoginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

export type FirebaseAuthInput = z.infer<typeof firebaseAuthSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetVerifyInput = z.infer<typeof passwordResetVerifySchema>;
export type UserOtpRequestInput = z.infer<typeof userOtpRequestSchema>;
export type UserOtpVerifyInput = z.infer<typeof userOtpVerifySchema>;
export type PhoneVerificationRequestInput = z.infer<typeof phoneVerificationRequestSchema>;
export type PhoneVerificationVerifyInput = z.infer<typeof phoneVerificationVerifySchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
