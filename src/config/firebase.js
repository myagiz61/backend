import admin from "firebase-admin";

if (!process.env.FIREBASE_ADMIN) {
  throw new Error("FIREBASE_ADMIN env variable is missing");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
