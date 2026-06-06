-- Track when a delivery order was assigned to a rider (for the admin timeline).
ALTER TABLE "DeliveryOrder" ADD COLUMN "assignedAt" TIMESTAMP(3);
