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

// Obtain an access token.
//  - Against PROD: set EMAIL + PASSWORD env vars for an existing verified
//    account; the script logs in (no OTP needed).
//  - Against a dev backend (OTP_DEV_MODE=true): falls back to register +
//    email-verify using the OTP the backend returns.
const getToken = async () => {
  if (process.env.EMAIL && process.env.PASSWORD) {
    const login = await post('/auth/login', { email: process.env.EMAIL, password: process.env.PASSWORD });
    if (!login.accessToken) {
      throw new Error('Login did not return an access token (is the account verified?). Response: ' + JSON.stringify(login));
    }
    return { email: process.env.EMAIL, token: login.accessToken };
  }

  const email = `kitchen-test+${Date.now()}@tukkebaz.test`;
  const reg = await post('/auth/register', { name: 'Kitchen Tester', email, password: 'Test@12345' });
  if (reg.accessToken) return { email, token: reg.accessToken };

  const otp = reg.otp || process.env.OTP;
  if (!otp) {
    throw new Error(
      'No token path available. For PROD, set EMAIL=<verified account> PASSWORD=<password>. ' +
      'For a dev backend, run with OTP_DEV_MODE=true (the OTP is returned), or pass OTP=<code>.'
    );
  }
  const verified = await post('/auth/email/verify', { email, otp });
  if (!verified.accessToken) throw new Error('Email verification did not return an access token.');
  return { email, token: verified.accessToken };
};

(async () => {
  // 1) Get an access token (login with EMAIL/PASSWORD, or dev register+verify)
  const { email, token } = await getToken();
  console.log('✓ authenticated as:', email);

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
