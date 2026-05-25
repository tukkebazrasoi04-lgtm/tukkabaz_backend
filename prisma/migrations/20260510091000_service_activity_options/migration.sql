ALTER TABLE "Service" ADD COLUMN "activityOptions" JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE "Booking" ADD COLUMN "activityOptions" JSONB NOT NULL DEFAULT '[]'::JSONB;

UPDATE "Service"
SET "activityOptions" = '[{"id":"local-guide","title":"Local guide","description":"Add a local guide for route help and stories.","pricePerGuest":350},{"id":"meal-stop","title":"Meal stop coordination","description":"Add cafe or lunch stop coordination during the trip.","pricePerGuest":250}]'::JSONB
WHERE "type" = 'TRIP'
  AND "activityOptions" = '[]'::JSONB;

UPDATE "Service"
SET "contactPhone" = COALESCE("contactPhone", '+919876543210')
WHERE "type" IN ('TRIP', 'CAMPING', 'DRONE_SHOOTING');

UPDATE "Service"
SET "activityOptions" = '[{"id":"bonfire-upgrade","title":"Bonfire upgrade","description":"Extra bonfire setup support for the group.","pricePerGuest":300},{"id":"breakfast-add-on","title":"Breakfast add-on","description":"Add morning breakfast to the camping plan.","pricePerGuest":220}]'::JSONB
WHERE "type" = 'CAMPING'
  AND "activityOptions" = '[]'::JSONB;

UPDATE "Service"
SET "activityOptions" = '[{"id":"extra-edits","title":"Extra edited reel","description":"Add one extra short edited reel from the shoot.","pricePerGuest":500},{"id":"extended-shoot","title":"Extended shoot time","description":"Add more shoot time for extra locations.","pricePerGuest":700}]'::JSONB
WHERE "type" = 'DRONE_SHOOTING'
  AND "activityOptions" = '[]'::JSONB;
