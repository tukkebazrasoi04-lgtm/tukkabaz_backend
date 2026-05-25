ALTER TABLE "Service" ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Service" ADD COLUMN "detailSections" JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE "Service" ADD COLUMN "requiredDocuments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Service" ADD COLUMN "pickupAddress" TEXT;
ALTER TABLE "Service" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "Service" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Service" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Service" ADD COLUMN "ctaLabel" TEXT;

UPDATE "Service"
SET "imageUrls" = ARRAY["imageUrl"]
WHERE "imageUrl" IS NOT NULL
  AND COALESCE(array_length("imageUrls", 1), 0) = 0;

UPDATE "Service"
SET "imageUrls" = ARRAY_REMOVE(ARRAY[
  "imageUrl",
  'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80'
], NULL)
WHERE "type" = 'RENT_SCOOTY'
  AND COALESCE(array_length("imageUrls", 1), 0) <= 1;

UPDATE "Service"
SET "imageUrls" = ARRAY_REMOVE(ARRAY[
  "imageUrl",
  'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80'
], NULL)
WHERE "type" = 'TRIP'
  AND COALESCE(array_length("imageUrls", 1), 0) <= 1;

UPDATE "Service"
SET "imageUrls" = ARRAY_REMOVE(ARRAY[
  "imageUrl",
  'https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1504851149312-7a075b496cc7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1445307806294-bff7f67ff225?auto=format&fit=crop&w=1200&q=80'
], NULL)
WHERE "type" = 'CAMPING'
  AND COALESCE(array_length("imageUrls", 1), 0) <= 1;

UPDATE "Service"
SET "imageUrls" = ARRAY_REMOVE(ARRAY[
  "imageUrl",
  'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=1200&q=80'
], NULL)
WHERE "type" = 'DRONE_SHOOTING'
  AND COALESCE(array_length("imageUrls", 1), 0) <= 1;

UPDATE "Service"
SET
  "detailSections" = '[{"title":"Booking procedure","items":["Contact the owner and confirm your pickup time.","Share licence and ID proof before pickup.","Collect the scooty, helmet, and local route tips."]},{"title":"Pickup support","body":"Get directions to the pickup point or contact the owner before you start."}]'::JSONB,
  "requiredDocuments" = ARRAY['Driving licence', 'Aadhaar or government ID', 'Refundable security deposit if requested'],
  "pickupAddress" = COALESCE("pickupAddress", 'Main Market, Mukteshwar, Uttarakhand'),
  "contactPhone" = COALESCE("contactPhone", '+919876543210'),
  "latitude" = COALESCE("latitude", 29.4728),
  "longitude" = COALESCE("longitude", 79.6423),
  "ctaLabel" = COALESCE("ctaLabel", 'Contact now')
WHERE "type" = 'RENT_SCOOTY'
  AND "detailSections" = '[]'::JSONB;

UPDATE "Service"
SET
  "detailSections" = '[{"title":"What you will do","items":["Meet your local host and confirm the route.","Visit viewpoints, cafes, and village spots around Mukteshwar.","Return with support from the Tukkebaz team."]},{"title":"Things to know","body":"Price includes one guided booking slot. Availability and final route are confirmed after booking."}]'::JSONB,
  "ctaLabel" = COALESCE("ctaLabel", 'Book now')
WHERE "type" = 'TRIP'
  AND "detailSections" = '[]'::JSONB;

UPDATE "Service"
SET
  "detailSections" = '[{"title":"What you will do","items":["Reach the campsite and check your tent setup.","Enjoy bonfire time and included meals.","Wake up to the mountain view and check out with host support."]},{"title":"Things to know","body":"Warm clothing is recommended. Final campsite details are confirmed after booking."}]'::JSONB,
  "ctaLabel" = COALESCE("ctaLabel", 'Book now')
WHERE "type" = 'CAMPING'
  AND "detailSections" = '[]'::JSONB;

UPDATE "Service"
SET
  "detailSections" = '[{"title":"What you will do","items":["Choose a nearby shoot location with the operator.","Capture scenic aerial shots and short clips.","Receive edited files after the shoot window."]},{"title":"Things to know","body":"Drone flying depends on weather and local permission. Final timing is confirmed after booking."}]'::JSONB,
  "ctaLabel" = COALESCE("ctaLabel", 'Book now')
WHERE "type" = 'DRONE_SHOOTING'
  AND "detailSections" = '[]'::JSONB;
