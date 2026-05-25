CREATE TYPE "DeliveryCategory" AS ENUM ('FOOD', 'GROCERY');
CREATE TYPE "DeliveryOrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

CREATE TABLE "DeliveryItem" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "imageUrl" TEXT,
  "category" "DeliveryCategory" NOT NULL,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryPartner" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "vehicleType" TEXT NOT NULL,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "currentOrderId" TEXT,
  "currentLat" DOUBLE PRECISION,
  "currentLng" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryPartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryOrder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "totalAmount" INTEGER NOT NULL,
  "status" "DeliveryOrderStatus" NOT NULL DEFAULT 'PENDING',
  "deliveryAddress" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "partnerId" TEXT,
  "destinationLat" DOUBLE PRECISION,
  "destinationLng" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeliveryItem_category_isAvailable_idx" ON "DeliveryItem"("category", "isAvailable");
CREATE INDEX "DeliveryPartner_isAvailable_idx" ON "DeliveryPartner"("isAvailable");
CREATE INDEX "DeliveryPartner_currentOrderId_idx" ON "DeliveryPartner"("currentOrderId");
CREATE INDEX "DeliveryOrder_userId_createdAt_idx" ON "DeliveryOrder"("userId", "createdAt");
CREATE INDEX "DeliveryOrder_partnerId_idx" ON "DeliveryOrder"("partnerId");
CREATE INDEX "DeliveryOrder_status_idx" ON "DeliveryOrder"("status");

ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "DeliveryPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
