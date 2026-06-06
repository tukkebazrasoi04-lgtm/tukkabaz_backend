// Creates a test FOOD delivery order against the live backend and confirms it,
// which fires the instant kitchen push notification (and the 30s pending poll).
// Usage: node backend/scripts/create-test-order.js
const BASE = process.env.API_BASE || 'https://tukkabaz-backend.onrender.com';

const post = async (path, body, token) => {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${text}`);
  return json;
};

(async () => {
  // 1) Throwaway user -> access token
  const email = `kitchen-test+${Date.now()}@tukkebaz.test`;
  const reg = await post('/auth/register', { name: 'Kitchen Tester', email, password: 'Test@12345' });
  const token = reg.accessToken;
  console.log('✓ registered test user:', email);

  // 2) Pick a FOOD item
  const itemsRes = await (await fetch(BASE + '/delivery/items?category=FOOD')).json();
  const foodItem = (itemsRes.items || []).find((i) => i.category === 'FOOD' && i.isAvailable);
  if (!foodItem) throw new Error('No available FOOD item found');
  console.log('✓ ordering item:', foodItem.name, '₹' + foodItem.price);

  // 3) Create the order
  const orderRes = await post('/delivery/orders', {
    items: [{ itemId: foodItem.id, quantity: 1 }],
    deliveryAddress: 'Test Kitchen Order, Mukteshwar, Uttarakhand',
    customerPhone: '9' + String(Date.now()).slice(-9),
    destinationLat: 29.4727,
    destinationLng: 79.6479
  }, token);
  const order = orderRes.order;
  console.log('✓ order created:', order.orderNumber, '(id:', order.id + ')');

  // 4) Confirm payment -> fires the instant kitchen alert
  await post('/delivery/orders/confirm', { orderId: order.id, success: true, paymentReference: 'TEST_' + Date.now() }, token);
  console.log('✓ payment confirmed -> kitchen push fired for order', order.orderNumber);
  console.log('\nOpen the Kitchen screen now; it should buzz + show this PENDING order.');
})().catch((e) => { console.error('✗ FAILED:', e.message); process.exit(1); });
