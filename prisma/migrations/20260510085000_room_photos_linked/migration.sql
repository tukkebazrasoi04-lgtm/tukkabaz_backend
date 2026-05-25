ALTER TABLE "Room" ADD COLUMN "roomPhotos" JSONB NOT NULL DEFAULT '[]'::JSONB;

UPDATE "Room"
SET "roomPhotos" = COALESCE((
  SELECT jsonb_agg(
    jsonb_build_object(
      'url',
      "imageUrls"[index],
      'type',
      COALESCE("roomPhotoTypes"[index], 'Photo ' || index::TEXT)
    )
    ORDER BY index
  )
  FROM generate_subscripts("imageUrls", 1) AS index
  WHERE "imageUrls"[index] IS NOT NULL
    AND length(trim("imageUrls"[index])) > 0
), '[]'::JSONB)
WHERE "roomPhotos" = '[]'::JSONB
  AND COALESCE(array_length("imageUrls", 1), 0) > 0;

UPDATE "Room"
SET "roomPhotos" = jsonb_build_array(jsonb_build_object('url', "imageUrl", 'type', COALESCE("sleepTitle", 'Bedroom')))
WHERE "roomPhotos" = '[]'::JSONB
  AND "imageUrl" IS NOT NULL
  AND length(trim("imageUrl")) > 0;
