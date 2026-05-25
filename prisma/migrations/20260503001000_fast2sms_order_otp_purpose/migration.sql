-- Rename the earlier user login OTP purpose to make phone login explicit.
ALTER TYPE "OtpPurpose" RENAME VALUE 'USER_LOGIN' TO 'USER_PHONE_LOGIN';
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'ORDER_PICKUP';
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'ORDER_DELIVERY';

ALTER TABLE "OtpVerification" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "OtpVerification" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "OtpVerification" ADD COLUMN IF NOT EXISTS "orderId" TEXT;

CREATE INDEX IF NOT EXISTS "OtpVerification_phone_purpose_idx" ON "OtpVerification"("phone", "purpose");
CREATE INDEX IF NOT EXISTS "OtpVerification_userId_purpose_idx" ON "OtpVerification"("userId", "purpose");
CREATE INDEX IF NOT EXISTS "OtpVerification_orderId_purpose_idx" ON "OtpVerification"("orderId", "purpose");

ALTER TABLE "DeliveryOrder" ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;

WITH numbered_orders AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS row_number
  FROM "DeliveryOrder"
  WHERE "orderNumber" IS NULL
)
UPDATE "DeliveryOrder"
SET "orderNumber" = 'ORD-' || EXTRACT(YEAR FROM CURRENT_DATE)::INT || '-' || LPAD(numbered_orders.row_number::TEXT, 6, '0')
FROM numbered_orders
WHERE "DeliveryOrder"."id" = numbered_orders."id";

ALTER TABLE "DeliveryOrder" ALTER COLUMN "orderNumber" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryOrder_orderNumber_key" ON "DeliveryOrder"("orderNumber");
CREATE INDEX IF NOT EXISTS "DeliveryOrder_orderNumber_idx" ON "DeliveryOrder"("orderNumber");
