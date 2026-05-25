import admin from "firebase-admin";
import { env } from "../config/env";

// Configure these in .env from Firebase service account credentials:
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// Make sure FIREBASE_PRIVATE_KEY keeps escaped new lines (`\\n`).
const firebasePrivateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: firebasePrivateKey
    })
  });
}

export const firebaseAuth = admin.auth();
