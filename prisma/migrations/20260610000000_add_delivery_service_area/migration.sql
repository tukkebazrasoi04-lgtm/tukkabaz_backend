-- AlterTable: add kitchen location + serviceable radius to DeliveryConfig
ALTER TABLE "DeliveryConfig" ADD COLUMN "kitchenLat" DOUBLE PRECISION NOT NULL DEFAULT 29.4727;
ALTER TABLE "DeliveryConfig" ADD COLUMN "kitchenLng" DOUBLE PRECISION NOT NULL DEFAULT 79.6479;
ALTER TABLE "DeliveryConfig" ADD COLUMN "serviceRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 8;
ALTER TABLE "DeliveryConfig" ADD COLUMN "kitchenAddress" TEXT;
