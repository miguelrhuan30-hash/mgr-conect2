import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDgIijdFVs2_ti7rqndRZhKI3QYpkOlwsg",
  authDomain: "mgr-conect2.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mgr-conect2",
  storageBucket: "mgr-conect2.firebasestorage.app",
  messagingSenderId: "94240285880",
  appId: "1:94240285880:web:8fad80b8c49c7f7280c04d"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Removido experimentalForceLongPolling — causava latência desnecessária
// O SDK moderno do Firebase usa WebSocket/gRPC automaticamente
export const db = getFirestore(app);

export const storage = getStorage(app);
export default app;
