import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");

  if (key && (!key.includes("BEGIN PRIVATE KEY") || !key.includes("END PRIVATE KEY"))) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY must be the full service account private_key value, including BEGIN PRIVATE KEY and END PRIVATE KEY."
    );
  }

  return key;
}

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("Firebase Admin credentials are missing. Auth-protected requests will fail.");
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  }
}

export default admin;
