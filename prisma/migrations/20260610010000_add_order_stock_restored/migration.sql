-- AlterTable: track whether a cancelled/failed order's stock has been returned
ALTER TABLE "DeliveryOrder" ADD COLUMN "stockRestored" BOOLEAN NOT NULL DEFAULT false;
