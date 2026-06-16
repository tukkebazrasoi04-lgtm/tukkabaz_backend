-- Add EMAIL_VERIFY purpose for email-ownership verification OTPs
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'EMAIL_VERIFY';
