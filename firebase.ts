import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDgIijdFVs2_ti7rqndRZhKI3QYpkOlwsg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mgrrefrigeracao.com.br",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mgr-conect2",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mgr-conect2.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "94240285880",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:94240285880:web:8fad80b8c49c7f7280c04d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence
import { enableIndexedDbPersistence } from 'firebase/firestore';
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled
        // in one tab at a a time.
        console.warn('Firestore persistence failed: failed-precondition');
    } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the
        // features required to enable persistence
        console.warn('Firestore persistence failed: unimplemented');
    }
});
export const storage = getStorage(app);
export default app;
