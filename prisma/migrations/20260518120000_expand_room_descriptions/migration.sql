UPDATE "Room"
SET "description" = 'Spacious room with mountain view, breakfast, and high-speed Wi-Fi. A peaceful Mukteshwar stay made for slow mornings, fresh air, and easy access to nearby cafes and viewpoints.

The space
This private room is designed for comfort after a day out in the hills. Large windows bring in natural light and open views, while the bedroom setup keeps things simple, clean, and restful. Guests get a comfortable bed, reliable Wi-Fi, and access to food support during the stay.

The property sits in Village Satkhol, close enough for local exploring but quiet enough for a proper break. Free parking is available, and the owner can help with quick support before and during your visit.'
WHERE "title" = 'Premium Valley View Stay'
  AND length("description") < 220;

UPDATE "Room"
SET "description" = 'Warm wooden interiors, private sit-out, and sunrise view. A cozy cottage-style stay near Chauli Ki Jali with room for friends, family, or a relaxed mountain weekend.

The space
This cottage brings together wooden finishes, a private sit-out, and bright morning views. The bedroom arrangement works well for small groups, with three beds and enough space to settle in comfortably after exploring Mukteshwar.

Guests can enjoy Wi-Fi, food availability, free parking, and a calm outdoor corner for tea, reading, or quiet conversations. The location keeps you close to local viewpoints while still giving the stay a tucked-away feel.'
WHERE "title" = 'Wooden Cottage Resort'
  AND length("description") < 220;
