-- DropIndex
DROP INDEX "DeliveryPartner_phone_key";

-- CreateIndex
CREATE INDEX "DeliveryPartner_phone_idx" ON "DeliveryPartner"("phone");
