INSERT INTO "DeliveryItem" ("id", "name", "description", "price", "imageUrl", "category", "isAvailable", "availableQuantity", "createdAt", "updatedAt")
VALUES
  ('grocery_milk_1l', 'Milk 1 L', 'Fresh toned milk pack for tea, coffee, and breakfast.', 68, 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_bread_loaf', 'Bread Loaf', 'Soft white bread loaf for toast and sandwiches.', 45, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 35, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_eggs_6', 'Eggs 6 pcs', 'Farm eggs pack for breakfast and quick meals.', 72, 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_rice_1kg', 'Rice 1 kg', 'Everyday white rice pack for homestyle meals.', 95, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 28, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_atta_5kg', 'Atta 5 kg', 'Whole wheat flour pack for rotis and parathas.', 260, 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_sugar_1kg', 'Sugar 1 kg', 'Refined sugar pack for tea and pantry needs.', 58, 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_tea_250g', 'Tea 250 g', 'Strong tea leaves for fresh hill mornings.', 145, 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 24, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_butter_100g', 'Butter 100 g', 'Creamy butter pack for toast and cooking.', 62, 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_jam_200g', 'Mixed Fruit Jam', 'Sweet fruit jam jar for bread and snacks.', 110, 'https://images.unsplash.com/photo-1605522561233-768ad7a8fabf?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_noodles_pack', 'Instant Noodles', 'Quick noodles pack for late-night hunger.', 48, 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 45, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_chips_pack', 'Potato Chips', 'Crispy salted chips pack for travel snacking.', 35, 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_biscuits_pack', 'Biscuits Pack', 'Tea-time biscuits for rooms and road trips.', 30, 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_water_1l', 'Water Bottle 1 L', 'Packaged drinking water bottle.', 25, 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grocery_soap_bar', 'Bath Soap', 'Daily-use bath soap bar for stays.', 42, 'https://images.unsplash.com/photo-1607006344380-b6775a0824ce?auto=format&fit=crop&w=900&q=80', 'GROCERY', true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "price" = EXCLUDED."price",
  "imageUrl" = EXCLUDED."imageUrl",
  "category" = EXCLUDED."category",
  "isAvailable" = EXCLUDED."isAvailable",
  "availableQuantity" = EXCLUDED."availableQuantity",
  "updatedAt" = CURRENT_TIMESTAMP;
