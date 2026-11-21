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
  apiKey: import.meta.env.FIREBASE_API_KEY || "",
  authDomain: import.meta.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.FIREBASE_APP_ID || "",
};

let app = null;
let auth = null;

if (firebaseConfig.apiKey) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
  } catch (e) {
    console.warn("Firebase initialization deferred:", e);
  }
} else {
  console.warn("Firebase API key not found in environment variables. Set FIREBASE_API_KEY in your hosting dashboard.");
}

const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider };

export async function loginWithFirebaseGoogle() {
  if (!auth) throw new Error("Google authentication service is currently unavailable. Please use email and password.");
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return { user: result.user, idToken };
}

export async function registerWithFirebaseEmail(email, password) {
  if (!auth) throw new Error("Authentication service is currently unavailable. Please try again later.");
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
  if (!auth) throw new Error("Authentication service is currently unavailable. Please try again later.");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await cred.user.getIdToken();
  return { user: cred.user, idToken };
}

export async function sendFirebasePasswordReset(email) {
  if (!auth) throw new Error("Authentication service is currently unavailable. Please try again later.");
  await sendPasswordResetEmail(auth, email);
}
