ALTER TABLE "DeliveryOrder" ADD COLUMN "paymentProvider" TEXT NOT NULL DEFAULT 'SIMULATED';
ALTER TABLE "DeliveryOrder" ADD COLUMN "paymentReference" TEXT;
ALTER TABLE "DeliveryOrder" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "DeliveryOrder"
SET "paymentStatus" = 'SUCCESS'
WHERE "paymentReference" IS NULL;

CREATE INDEX "DeliveryOrder_paymentStatus_idx" ON "DeliveryOrder"("paymentStatus");
