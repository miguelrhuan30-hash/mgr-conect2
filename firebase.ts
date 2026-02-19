import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDgIijdFVs2_ti7rqndRZhKI3QYpkOlwsg",
  authDomain: "mgr-conect2.firebaseapp.com",
  projectId: "mgr-conect2",
  storageBucket: "mgr-conect2.firebasestorage.app",
  messagingSenderId: "94240285880",
  appId: "1:94240285880:web:8fad80b8c49c7f7280c04d"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const db = firebase.firestore();
export const auth = firebase.auth();
export const storage = firebase.storage();
export default firebase;