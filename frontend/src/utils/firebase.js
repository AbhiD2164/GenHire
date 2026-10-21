import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForDevelopment12345",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "genhire-app.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "genhire-app",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "genhire-app.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
};

let app;
let auth;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase client initialization deferred:", e);
}

const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider };

export async function loginWithFirebaseGoogle() {
  if (!auth) throw new Error("Firebase auth is not initialized");
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return { user: result.user, idToken };
}

export async function registerWithFirebaseEmail(email, password) {
  if (!auth) throw new Error("Firebase auth is not initialized");
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await sendEmailVerification(cred.user);
  } catch (err) {
    console.warn("Firebase verification email dispatch warning:", err);
  }
  const idToken = await cred.user.getIdToken();
  return { user: cred.user, idToken };
}

export async function loginWithFirebaseEmail(email, password) {
  if (!auth) throw new Error("Firebase auth is not initialized");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await cred.user.getIdToken();
  return { user: cred.user, idToken };
}

export async function sendFirebasePasswordReset(email) {
  if (!auth) throw new Error("Firebase auth is not initialized");
  await sendPasswordResetEmail(auth, email);
}
