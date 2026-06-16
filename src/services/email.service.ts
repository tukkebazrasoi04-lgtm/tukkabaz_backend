import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";

type EmailResult = {
  devSkipped: boolean;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Transactional email via Brevo's HTTP API (free tier: 300 emails/day, no domain
 * required to start). Dependency-free — uses fetch, like the SMS/Razorpay clients.
 *
 * If email isn't configured (or EMAIL_DEV_MODE=true), the code is logged to the
 * server console instead of sent, and the caller may surface it for local testing.
 */
class EmailService {
  private get isConfigured(): boolean {
    return Boolean(env.BREVO_API_KEY && env.EMAIL_FROM);
  }

  async sendOtp(email: string, otp: string, label: string): Promise<EmailResult> {
    const subject = `Your ${label} code: ${otp}`;
    const htmlContent = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color:#15110E; margin:0 0 8px;">${escapeHtml(env.EMAIL_FROM_NAME)}</h2>
        <p style="color:#5F5650; font-size:15px;">Use this code to ${escapeHtml(label)}:</p>
        <p style="font-size:32px; font-weight:700; letter-spacing:8px; color:#ED7D4B; margin:16px 0;">${escapeHtml(otp)}</p>
        <p style="color:#9B9085; font-size:13px;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      </div>`;

    // Only an explicit dev flag exposes the code (logged + returned to caller).
    if (env.EMAIL_DEV_MODE) {
      console.info(`[email:${label}] ${email} -> ${otp}`);
      return { devSkipped: true };
    }

    // Not configured and not in dev mode → fail loudly rather than silently
    // skipping delivery (which would otherwise leak the code in the response).
    if (!this.isConfigured) {
      throw new AppError(500, "Email provider is not configured. Set BREVO_API_KEY and EMAIL_FROM.");
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY!,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        sender: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
        to: [{ email }],
        subject,
        htmlContent
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Brevo email send failed:", errText);
      throw new AppError(502, "Failed to send the email. Please try again.");
    }

    return { devSkipped: false };
  }
}

export const emailService = new EmailService();
