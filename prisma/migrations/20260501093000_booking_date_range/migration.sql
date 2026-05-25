ALTER TABLE "Booking" ADD COLUMN "checkInDate" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "checkOutDate" TIMESTAMP(3);
UPDATE "Booking" SET "checkInDate" = "bookedFor" WHERE "checkInDate" IS NULL AND "bookedFor" IS NOT NULL;
