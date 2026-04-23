// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBg90DZwgNvNuBkJ6vW0R_IxwtJycDxgQw",
  authDomain: "comm-connect-d2968.firebaseapp.com",
  projectId: "comm-connect-d2968",
  storageBucket: "comm-connect-d2968.firebasestorage.app",
  messagingSenderId: "586488282093",
  appId: "1:586488282093:web:e117e45f8562745fa585e4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const auth = getAuth(app);
export default { app };