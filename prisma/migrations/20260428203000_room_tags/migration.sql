ALTER TABLE "Room" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Room"
SET "tags" = ARRAY['Free WiFi', 'Food Available', "capacity"::TEXT || ' Beds']
WHERE cardinality("tags") = 0;
