-- Track whether a user's email has been verified (only gates email+password login).
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- Grandfather every EXISTING user as verified so no current account is locked out.
-- New sign-ups created after this migration start as unverified (set by the app).
UPDATE "User" SET "emailVerified" = true;
