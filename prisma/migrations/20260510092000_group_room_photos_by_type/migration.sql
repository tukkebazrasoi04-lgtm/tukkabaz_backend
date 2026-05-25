WITH normalized AS (
  SELECT
    "Room"."id",
    COALESCE(NULLIF(photo->>'type', ''), 'Photo') AS "type",
    url_items."url",
    expanded."ord"
  FROM "Room"
  CROSS JOIN LATERAL jsonb_array_elements("Room"."roomPhotos") WITH ORDINALITY AS expanded(photo, ord)
  CROSS JOIN LATERAL (
    SELECT photo->>'url' AS "url"
    WHERE photo ? 'url' AND NULLIF(photo->>'url', '') IS NOT NULL
    UNION ALL
    SELECT jsonb_array_elements_text(
      CASE
        WHEN photo ? 'urls' AND jsonb_typeof(photo->'urls') = 'array' THEN photo->'urls'
        ELSE '[]'::jsonb
      END
    ) AS "url"
  ) AS url_items
  WHERE jsonb_typeof("Room"."roomPhotos") = 'array'
    AND NULLIF(url_items."url", '') IS NOT NULL
),
grouped AS (
  SELECT
    "id",
    "type",
    jsonb_agg("url" ORDER BY "ord") AS "urls",
    MIN("ord") AS "firstOrd"
  FROM normalized
  GROUP BY "id", "type"
),
rebuilt AS (
  SELECT
    "id",
    jsonb_agg(jsonb_build_object('type', "type", 'urls', "urls") ORDER BY "firstOrd") AS "roomPhotos"
  FROM grouped
  GROUP BY "id"
)
UPDATE "Room"
SET "roomPhotos" = rebuilt."roomPhotos"
FROM rebuilt
WHERE "Room"."id" = rebuilt."id";
