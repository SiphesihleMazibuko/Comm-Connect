import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBg90DZwgNvNuBkJ6vW0R_IxwtJycDxgQw",
  authDomain: "comm-connect-d2968.firebaseapp.com",
  projectId: "comm-connect-d2968",
  storageBucket: "comm-connect-d2968.firebasestorage.app",
  messagingSenderId: "586488282093",
  appId: "1:586488282093:web:e117e45f8562745fa585e4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;