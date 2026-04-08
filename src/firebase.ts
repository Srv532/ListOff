import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// SECURITY (#4 Exposed Secrets / Environment Variables):
// Access Firebase credentials through environment variables instead of a static JSON file.
// This allows you to manage these safely in your environment settings (Vercel, local .env).
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase SDK with defensive checks
let app;
let db: any = null;
let auth: any = null;

const isValidConfig = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_firebase_api_key' && !firebaseConfig.apiKey.includes('remixed');

if (isValidConfig) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (err) {
    console.error('Firebase initialization failed:', err);
  }
} else {
  console.warn('Firebase configuration is missing or invalid. Falling back to local/memory mode.');
}

export { db, auth };
