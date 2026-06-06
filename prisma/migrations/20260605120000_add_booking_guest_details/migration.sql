-- Add customer contact + per-guest details to bookings
ALTER TABLE "Booking" ADD COLUMN "contactName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "Booking" ADD COLUMN "guests" JSONB NOT NULL DEFAULT '[]';
