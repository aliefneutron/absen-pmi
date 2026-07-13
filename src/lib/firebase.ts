import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAW4VYf8hdUEm0fYmlGgnV4V2QKo6Op56I",
  authDomain: "absen-location-af45c.firebaseapp.com",
  projectId: "absen-location-af45c",
  storageBucket: "absen-location-af45c.firebasestorage.app",
  messagingSenderId: "255607439021",
  appId: "1:255607439021:web:1709a7f65a6b96527e1024",
  measurementId: "G-8L5784JB3F"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
