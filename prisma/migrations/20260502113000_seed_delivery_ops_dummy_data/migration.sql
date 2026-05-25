INSERT INTO "DeliveryPartner" ("id", "name", "phone", "vehicleType", "isAvailable", "currentLat", "currentLng", "createdAt", "updatedAt")
VALUES
  ('demo_partner_arjun', 'Arjun Delivery', '9000000001', 'Bike', true, 29.4827, 79.6579, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo_partner_neeraj', 'Neeraj Rider', '9000000002', 'Scooty', true, 29.4627, 79.6379, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("phone") DO NOTHING;

UPDATE "DeliveryItem"
SET "availableQuantity" = CASE
  WHEN "category" = 'FOOD' THEN 24
  ELSE 40
END
WHERE "id" LIKE 'demo_%';
