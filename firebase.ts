import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDgIijdFVs2_ti7rqndRZhKI3QYpkOlwsg",
  authDomain: "mgr-conect2.firebaseapp.com",
  projectId: "mgr-conect2",
  storageBucket: "mgr-conect2.firebasestorage.app",
  messagingSenderId: "94240285880",
  appId: "1:94240285880:web:8fad80b8c49c7f7280c04d"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const storage = getStorage(app);
export default app;