ALTER TABLE "DeliveryItem" ADD COLUMN "grocerySection" TEXT;

UPDATE "DeliveryItem"
SET "grocerySection" = CASE
  WHEN "category" = 'GROCERY' AND ("name" ILIKE '%apple%' OR "name" ILIKE '%banana%' OR "name" ILIKE '%tomato%' OR "name" ILIKE '%onion%' OR "name" ILIKE '%potato%' OR "name" ILIKE '%fruit%' OR "name" ILIKE '%vegetable%') THEN 'Vegetables & Fruits'
  WHEN "category" = 'GROCERY' AND ("name" ILIKE '%atta%' OR "name" ILIKE '%rice%' OR "name" ILIKE '%dal%' OR "name" ILIKE '%flour%') THEN 'Atta, Rice & Dal'
  WHEN "category" = 'GROCERY' AND ("name" ILIKE '%chips%' OR "name" ILIKE '%biscuit%' OR "name" ILIKE '%noodle%' OR "name" ILIKE '%water%' OR "name" ILIKE '%drink%') THEN 'Snacks & Drinks'
  WHEN "category" = 'GROCERY' AND ("name" ILIKE '%milk%' OR "name" ILIKE '%bread%' OR "name" ILIKE '%egg%' OR "name" ILIKE '%butter%' OR "name" ILIKE '%jam%' OR "name" ILIKE '%tea%') THEN 'Kitchen Essentials'
  WHEN "category" = 'GROCERY' THEN 'Daily Essentials'
  ELSE NULL
END;

INSERT INTO "DeliveryItem" ("id", "name", "description", "price", "imageUrl", "category", "grocerySection", "isAvailable", "availableQuantity", "createdAt", "updatedAt")
VALUES
  ('grocery_tomato_1kg', 'Tomato 1 kg', 'Fresh tomatoes for curries, salads, and breakfast sides.', 55, 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=900&q=80', 'GROCERY', 'Vegetables & Fruits', true, 35, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_onion_1kg', 'Onion 1 kg', 'Daily cooking onions for kitchen essentials.', 48, 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=900&q=80', 'GROCERY', 'Vegetables & Fruits', true, 35, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_banana_dozen', 'Banana 1 dozen', 'Fresh bananas for breakfast and quick snacks.', 72, 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?auto=format&fit=crop&w=900&q=80', 'GROCERY', 'Vegetables & Fruits', true, 24, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_dal_1kg', 'Dal 1 kg', 'Everyday yellow dal pack for homestyle meals.', 135, 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&w=900&q=80', 'GROCERY', 'Atta, Rice & Dal', true, 22, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_cold_drink_750ml', 'Cold Drink 750 ml', 'Chilled soft drink bottle for snacks and meals.', 45, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80', 'GROCERY', 'Snacks & Drinks', true, 36, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "price" = EXCLUDED."price",
  "imageUrl" = EXCLUDED."imageUrl",
  "category" = EXCLUDED."category",
  "grocerySection" = EXCLUDED."grocerySection",
  "isAvailable" = EXCLUDED."isAvailable",
  "availableQuantity" = EXCLUDED."availableQuantity",
  "updatedAt" = CURRENT_TIMESTAMP;
