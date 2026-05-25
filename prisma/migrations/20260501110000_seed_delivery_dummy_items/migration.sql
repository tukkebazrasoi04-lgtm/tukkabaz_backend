INSERT INTO "DeliveryItem" ("id", "name", "description", "price", "imageUrl", "category", "isAvailable", "createdAt", "updatedAt")
VALUES
  ('demo_food_veg_thali', 'Homestyle Veg Thali', 'Fresh dal, seasonal sabzi, rice, roti, salad, and pickle.', 180, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=900', 'FOOD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo_food_maggi', 'Mountain Masala Maggi', 'Hot masala noodles with vegetables, served fresh for hill evenings.', 90, 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=900', 'FOOD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo_food_paratha', 'Aloo Paratha Combo', 'Two stuffed parathas with curd, pickle, and butter.', 140, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=900', 'FOOD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo_grocery_milk_bread', 'Milk & Bread Pack', 'One litre milk with fresh bread for your stay essentials.', 95, 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=900', 'GROCERY', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo_grocery_snacks', 'Travel Snacks Kit', 'Chips, biscuits, juice, and quick bites for local trips.', 220, 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=900', 'GROCERY', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo_grocery_breakfast', 'Breakfast Essentials', 'Eggs, butter, jam, bread, and tea sachets.', 260, 'https://images.unsplash.com/photo-1543362906-acfc16c67564?w=900', 'GROCERY', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
