ALTER TABLE "DeliveryItem" ADD COLUMN "availableQuantity" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "DeliveryOrder" ADD COLUMN "pickupOtp" TEXT;
ALTER TABLE "DeliveryOrder" ADD COLUMN "deliveryOtp" TEXT;
ALTER TABLE "DeliveryPartner" ADD COLUMN "loginOtp" TEXT;
ALTER TABLE "DeliveryPartner" ADD COLUMN "loginOtpExpiresAt" TIMESTAMP(3);

DELETE FROM "DeliveryPartner" a
USING "DeliveryPartner" b
WHERE a."id" > b."id"
  AND a."phone" = b."phone";

CREATE UNIQUE INDEX "DeliveryPartner_phone_key" ON "DeliveryPartner"("phone");

UPDATE "DeliveryOrder"
SET
  "pickupOtp" = LPAD((FLOOR(RANDOM() * 9000 + 1000))::TEXT, 4, '0'),
  "deliveryOtp" = LPAD((FLOOR(RANDOM() * 9000 + 1000))::TEXT, 4, '0')
WHERE "pickupOtp" IS NULL OR "deliveryOtp" IS NULL;
