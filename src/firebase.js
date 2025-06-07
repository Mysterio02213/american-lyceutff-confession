// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // ✅ Add this

const firebaseConfig = {
  apiKey: "AIzaSyAMtu6iOOsaaG7TvG_JFjO5lvrbxHoQmJs",
  authDomain: "amercanlycetuff-confession.firebaseapp.com",
  projectId: "amercanlycetuff-confession",
  storageBucket: "amercanlycetuff-confession.firebasestorage.app",
  messagingSenderId: "654608362698",
  appId: "1:654608362698:web:2179d61443092699121833",
  measurementId: "G-QT9G33PTG7",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app); // ✅ Export auth
export const db = getFirestore(app); // ✅ Export db
