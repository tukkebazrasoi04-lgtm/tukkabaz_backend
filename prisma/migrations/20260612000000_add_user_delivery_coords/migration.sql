-- AlterTable: store the saved delivery location's coordinates on the user
ALTER TABLE "User" ADD COLUMN "deliveryLat" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN "deliveryLng" DOUBLE PRECISION;
