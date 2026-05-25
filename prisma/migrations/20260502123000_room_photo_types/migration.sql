ALTER TABLE "Room" ADD COLUMN "roomPhotoTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Room"
SET "roomPhotoTypes" = ARRAY(
  SELECT CASE
    WHEN index = 1 THEN 'Bedroom'
    WHEN index = 2 THEN 'Bathroom'
    WHEN index = 3 THEN 'Exterior'
    WHEN index = 4 THEN 'Bedroom area'
    ELSE 'Additional photos'
  END
  FROM generate_subscripts("imageUrls", 1) AS index
)
WHERE COALESCE(array_length("roomPhotoTypes", 1), 0) = 0
  AND COALESCE(array_length("imageUrls", 1), 0) > 0;
