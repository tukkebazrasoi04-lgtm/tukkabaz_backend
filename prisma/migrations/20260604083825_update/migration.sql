/*
  Warnings:

  - You are about to drop the column `password` on the `DeliveryPartner` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `DeliveryPartner` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `DeliveryPartner` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DeliveryItem" ADD COLUMN     "isVeg" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "DeliveryPartner" DROP COLUMN "password",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "googleMapUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartner_email_key" ON "DeliveryPartner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartner_userId_key" ON "DeliveryPartner"("userId");

-- AddForeignKey
ALTER TABLE "DeliveryPartner" ADD CONSTRAINT "DeliveryPartner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
