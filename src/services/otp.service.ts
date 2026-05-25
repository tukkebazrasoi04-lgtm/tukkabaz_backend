import bcrypt from "bcryptjs";
import { OtpPurpose } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { smsService } from "./sms.service";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const makeOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const PASSWORD_RESET_PURPOSE = "PASSWORD_RESET" as OtpPurpose;

const isPhoneOtpPurpose = (purpose: OtpPurpose): boolean =>
  purpose !== PASSWORD_RESET_PURPOSE;

const normalizeIdentifier = (identifier: string, purpose: OtpPurpose): string => {
  if (isPhoneOtpPurpose(purpose)) {
    return normalizePhone(identifier);
  }

  const normalizedEmail = identifier.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new AppError(400, "Enter a valid email address.");
  }

  return normalizedEmail;
};

export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  const withoutCountryCode = digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith("0")
      ? digits.slice(1)
      : digits;

  if (!/^[6-9]\d{9}$/.test(withoutCountryCode)) {
    throw new AppError(400, "Enter a valid Indian mobile number.");
  }

  return withoutCountryCode;
};

class OtpService {
  async requestOtp(identifier: string, purpose: OtpPurpose, label: string) {
    const normalizedIdentifier = normalizeIdentifier(identifier, purpose);
    const otp = makeOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await prisma.$transaction([
      prisma.otpVerification.updateMany({
        where: {
          identifier: normalizedIdentifier,
          purpose,
          consumedAt: null
        },
        data: {
          consumedAt: new Date()
        }
      }),
      prisma.otpVerification.create({
        data: {
          identifier: normalizedIdentifier,
          phone: isPhoneOtpPurpose(purpose) ? normalizedIdentifier : null,
          purpose,
          otpHash,
          expiresAt
        }
      })
    ]);

    if (isPhoneOtpPurpose(purpose)) {
      await smsService.sendOtp(normalizedIdentifier, otp, label);
    } else {
      console.info(`[otp:${label}] ${normalizedIdentifier} -> ${otp}`);
    }

    return {
      message: "OTP sent",
      otp: purpose === PASSWORD_RESET_PURPOSE ? otp : undefined,
      expiresAt
    };
  }

  async createOrderOtp(input: { orderId: string; userId: string; phone?: string | null; purpose: OtpPurpose; otp?: string; ttlMs?: number }) {
    const otp = input.otp ?? makeOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + (input.ttlMs ?? 24 * 60 * 60 * 1000));
    const phone = input.phone ? normalizePhone(input.phone) : null;

    await prisma.$transaction([
      prisma.otpVerification.updateMany({
        where: {
          orderId: input.orderId,
          purpose: input.purpose,
          consumedAt: null
        },
        data: { consumedAt: new Date() }
      }),
      prisma.otpVerification.create({
        data: {
          identifier: input.orderId,
          phone,
          userId: input.userId,
          orderId: input.orderId,
          purpose: input.purpose,
          otpHash,
          expiresAt
        }
      })
    ]);

    return { otp, expiresAt };
  }

  async verifyOtp(identifier: string, purpose: OtpPurpose, otp: string) {
    const normalizedIdentifier = normalizeIdentifier(identifier, purpose);
    const verification = await prisma.otpVerification.findFirst({
      where: {
        identifier: normalizedIdentifier,
        purpose,
        consumedAt: null
      },
      orderBy: { createdAt: "desc" }
    });

    if (!verification || verification.expiresAt < new Date()) {
      throw new AppError(400, "Invalid or expired OTP.");
    }

    if (verification.attempts >= MAX_ATTEMPTS) {
      throw new AppError(429, "Too many OTP attempts. Request a new code.");
    }

    const isValid = await bcrypt.compare(otp.trim(), verification.otpHash);
    if (!isValid) {
      await prisma.otpVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } }
      });
      throw new AppError(400, "Invalid or expired OTP.");
    }

    await prisma.otpVerification.update({
      where: { id: verification.id },
      data: { consumedAt: new Date() }
    });

    return normalizedIdentifier;
  }
}

export const otpService = new OtpService();
