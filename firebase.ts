import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDgIijdFVs2_ti7rqndRZhKI3QYpkOlwsg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mgr-conect2.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mgr-conect2",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mgr-conect2.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "94240285880",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:94240285880:web:8fad80b8c49c7f7280c04d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
