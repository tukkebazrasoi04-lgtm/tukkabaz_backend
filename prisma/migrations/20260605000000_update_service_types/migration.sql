-- Recreate the ServiceType enum with the new fixed catalogue of service types.
-- Existing rows are remapped: DRONE_SHOOT -> DRONE_VIDEOS, TREKKING_WITH_CAMPING -> CAMPING.

ALTER TYPE "ServiceType" RENAME TO "ServiceType_old";

CREATE TYPE "ServiceType" AS ENUM (
  'SKY_CYCLING',
  'ATV_RIDE',
  'ZIP_LINE',
  'RAPPELLING',
  'ROCK_CLIMBING',
  'DRONE_VIDEOS',
  'RENT_SCOOTY',
  'CAB_AND_TAXI',
  'CAMPING',
  'CAFE'
);

ALTER TABLE "Service" ALTER COLUMN "type" TYPE "ServiceType" USING (
  CASE "type"::text
    WHEN 'DRONE_SHOOT' THEN 'DRONE_VIDEOS'
    WHEN 'TREKKING_WITH_CAMPING' THEN 'CAMPING'
    ELSE "type"::text
  END::"ServiceType"
);

DROP TYPE "ServiceType_old";
