/*
  Warnings:

  - The values [TRIP,DRONE_SHOOTING,OTHER] on the enum `ServiceType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ServiceType_new" AS ENUM ('RENT_SCOOTY', 'DRONE_SHOOT', 'CAMPING', 'TREKKING_WITH_CAMPING', 'CAB_AND_TAXI');
ALTER TABLE "Service" ALTER COLUMN "type" TYPE "ServiceType_new" USING ("type"::text::"ServiceType_new");
ALTER TYPE "ServiceType" RENAME TO "ServiceType_old";
ALTER TYPE "ServiceType_new" RENAME TO "ServiceType";
DROP TYPE "public"."ServiceType_old";
COMMIT;
