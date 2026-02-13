import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
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
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);