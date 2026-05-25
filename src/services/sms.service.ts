import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";

type SmsResult = {
  sid?: string;
  devSkipped: boolean;
};

const normalizeIndianMobileForFast2Sms = (phone: string): string => {
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

class SmsService {
  private get isConfigured(): boolean {
    return Boolean(env.FAST2SMS_API_KEY);
  }

  async sendOtp(phone: string, otp: string, label: string): Promise<SmsResult> {
    // Fast2SMS is provider-only. OTP creation, hashing, expiry, attempts,
    // and consume-on-success stay in otp.service.ts.
    if (env.OTP_DEV_MODE) {
      console.info(`[otp:${label}] ${phone} -> ${otp}`);
      return { devSkipped: true };
    }

    if (!this.isConfigured) {
      throw new AppError(500, "SMS provider is not configured.");
    }

    const mobileNumber = normalizeIndianMobileForFast2Sms(phone);
    const body = new URLSearchParams({
      route: "otp",
      variables_values: otp,
      numbers: mobileNumber
    });

    if (env.FAST2SMS_SENDER_ID) {
      body.set("sender_id", env.FAST2SMS_SENDER_ID);
    }

    const response = await fetch(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        method: "POST",
        headers: {
          authorization: env.FAST2SMS_API_KEY!,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      }
    );

    const payload = await response.json().catch(() => null) as { sid?: string; message?: string } | null;

    if (!response.ok) {
      throw new AppError(502, payload?.message || "Failed to send OTP SMS.");
    }

    return { sid: payload?.sid, devSkipped: false };
  }
}

export const smsService = new SmsService();
