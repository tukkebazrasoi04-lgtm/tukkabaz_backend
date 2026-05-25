-- Add phone verification fields for users.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- Shared OTP store for user, delivery partner, and kitchen verification.
CREATE TYPE "OtpPurpose" AS ENUM ('USER_LOGIN', 'USER_PHONE_VERIFY', 'DELIVERY_PARTNER_LOGIN', 'KITCHEN_LOGIN');

CREATE TABLE "OtpVerification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OtpVerification_identifier_purpose_consumedAt_idx" ON "OtpVerification"("identifier", "purpose", "consumedAt");
CREATE INDEX "OtpVerification_expiresAt_idx" ON "OtpVerification"("expiresAt");
