// Fires the kitchen -> partner buzz chain from the terminal.
//
// Usage:
//   node backend/scripts/mark-order-ready.js            -> creates a fresh paid order, then PREPARING -> READY_FOR_PICKUP
//   node backend/scripts/mark-order-ready.js <orderId>  -> marks an EXISTING order PREPARING -> READY_FOR_PICKUP
//
// Marking READY_FOR_PICKUP is what buzzes online, free delivery partners.
const BASE = process.env.API_BASE || 'https://tukkabaz-backend.onrender.com';

const req = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return json;
};

const getToken = async () => {
  if (process.env.EMAIL && process.env.PASSWORD) {
    const login = await req('POST', '/auth/login', { email: process.env.EMAIL, password: process.env.PASSWORD });
    if (!login.accessToken) throw new Error('Login did not return an access token. Response: ' + JSON.stringify(login));
    return { email: process.env.EMAIL, token: login.accessToken };
  }

  const email = `kitchen-test+${Date.now()}@tukkebaz.test`;
  const reg = await req('POST', '/auth/register', { name: 'Buzz Tester', email, password: 'Test@12345' });
  if (reg.accessToken) return { email, token: reg.accessToken };

  const otp = reg.otp || process.env.OTP;
  if (!otp) {
    throw new Error(
      'No token path available. For PROD set EMAIL=<verified account> PASSWORD=<password>. ' +
      'For a dev backend run with OTP_DEV_MODE=true, or pass OTP=<code>.'
    );
  }
  const verified = await req('POST', '/auth/email/verify', { email, otp });
  if (!verified.accessToken) throw new Error('Email verification did not return an access token.');
  return { email, token: verified.accessToken };
};

const createPaidOrder = async () => {
  const { email, token } = await getToken();
  console.log('✓ test customer:', email);

  const itemsRes = await (await fetch(BASE + '/delivery/items?category=FOOD')).json();
  const foodItem = (itemsRes.items || []).find((i) => i.category === 'FOOD' && i.isAvailable);
  if (!foodItem) throw new Error('No available FOOD item found');

  const orderRes = await req('POST', '/delivery/orders', {
    items: [{ itemId: foodItem.id, quantity: 1 }],
    deliveryAddress: 'Buzz Chain Test, Mukteshwar, Uttarakhand',
    customerPhone: '9' + String(Date.now()).slice(-9),
    destinationLat: 29.4727,
    destinationLng: 79.6479
  }, token);
  const order = orderRes.order;

  await req('POST', '/delivery/orders/confirm', { orderId: order.id, success: true, paymentReference: 'TEST_' + Date.now() }, token);
  console.log('✓ order created + paid:', order.orderNumber, `(id: ${order.id})`);
  return order;
};

const setStatus = async (orderId, status) => {
  const res = await req('PATCH', `/delivery/kitchen/orders/${orderId}/status`, { status });
  console.log(`✓ status -> ${status}  (${res.order?.orderNumber ?? orderId})`);
  return res;
};

(async () => {
  const orderId = process.argv[2];
  let id = orderId;
  let number = orderId;

  if (!id) {
    const order = await createPaidOrder();
    id = order.id;
    number = order.orderNumber;
  } else {
    console.log('✓ using existing order id:', id);
  }

  await setStatus(id, 'PREPARING');
  await setStatus(id, 'READY_FOR_PICKUP');

  console.log(`\n🛵 Order ${number} is READY_FOR_PICKUP.`);
  console.log('Online + free delivery partners should buzz within ~12s.');
})().catch((e) => { console.error('✗ FAILED:', e.message); process.exit(1); });
