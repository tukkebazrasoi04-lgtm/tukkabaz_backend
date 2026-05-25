# Tukkabz Rasoi Backend Auth

Production-like mobile auth backend using:

- Node.js
- TypeScript
- Express
- Prisma + PostgreSQL
- Firebase Admin SDK
- jsonwebtoken
- bcryptjs
- zod

## Architecture

This backend uses Firebase only for identity verification.  
Your backend is the actual auth authority for app sessions.

Flow:

1. Mobile app signs in with Firebase Google auth.
2. Mobile app receives Firebase ID token.
3. Mobile app calls `POST /auth/firebase` with that ID token.
4. Backend verifies token via Firebase Admin SDK.
5. Backend creates/fetches user in PostgreSQL via Prisma.
6. Backend issues app `accessToken` + `refreshToken`.
7. Backend stores only hashed refresh token in `Session` table.

## Setup

1. Install dependencies

```bash
npm install
```

2. Create env file

```bash
cp .env.example .env
```

3. Fill `.env` values

- `DATABASE_URL` from PostgreSQL
- `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` (long random values)
- Firebase service account fields
- `FAST2SMS_API_KEY` for India OTP SMS
- `FAST2SMS_SENDER_ID` if your Fast2SMS/DLT setup requires one
- `KITCHEN_PHONE_NUMBER` for kitchen/shopkeeper OTP login
- `OTP_DEV_MODE=true` only for local testing; this logs OTPs to the backend console and skips Fast2SMS

4. Generate Prisma client

```bash
npx prisma generate
```

5. Run migration

```bash
npx prisma migrate dev
```

6. Start dev server

```bash
npm run dev
```

Server default: `http://localhost:8000`

## Firebase Service Account Credentials

1. Open Firebase Console.
2. Go to `Project settings` -> `Service accounts`.
3. Click `Generate new private key`.
4. Copy values into `.env`:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

Important for private key:

- Convert new lines to escaped `\\n` when storing in `.env`.
- The backend converts them back internally.

## API Endpoints

### 1. Firebase Login

`POST /auth/firebase`

Request body:

```json
{
  "idToken": "firebase-id-token"
}
```

### 2. Refresh Tokens

`POST /auth/refresh`

Request body:

```json
{
  "refreshToken": "your-refresh-token"
}
```

### 3. Current User

`GET /auth/me`

Headers:

`Authorization: Bearer <access-token>`

### 4. Logout

`POST /auth/logout`

Headers:

`Authorization: Bearer <access-token>`

Optional body:

```json
{
  "refreshToken": "your-refresh-token"
}
```

## Sample cURL Requests

### POST /auth/firebase

```bash
curl -X POST http://localhost:8000/auth/firebase \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"firebase-id-token\"}"
```

### POST /auth/refresh

```bash
curl -X POST http://localhost:8000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"your-refresh-token\"}"
```

### GET /auth/me

```bash
curl -X GET http://localhost:8000/auth/me \
  -H "Authorization: Bearer your-access-token"
```

### POST /auth/logout

```bash
curl -X POST http://localhost:8000/auth/logout \
  -H "Authorization: Bearer your-access-token" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"your-refresh-token\"}"
```

## Security Notes

- Trusts only Firebase verified token data.
- Rejects missing or unverified email.
- Never trusts client-sent role/email/name.
- Stores only hashed refresh tokens.
- Login and phone-verification OTPs are sent through Fast2SMS.
- Fast2SMS is only the SMS provider; OTP hashing, expiry, attempt limits, and consume-on-success are handled by the backend OTP service.
- Order pickup OTPs are shown only to kitchen/admin screens, and delivery OTPs are shown only to the owning user/admin screen.
- Supports multiple sessions/devices.
- Session revocation enabled via `Session.revoked`.
- Access token is stateless and not stored in DB.
