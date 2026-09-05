import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, signOut,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJecsbktPr4_pPnHKq7MT6BII65UBNmEo",
  authDomain: "farm-game-575bc.firebaseapp.com",
  projectId: "farm-game-575bc",
  storageBucket: "farm-game-575bc.firebasestorage.app",
  messagingSenderId: "126241340925",
  appId: "1:126241340925:web:77abe0e0fd221263252d94",
  measurementId: "G-G0GBZT4RKF"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

try {
  if (await isSupported()) getAnalytics(firebaseApp);
} catch (_) {}

try {
  await setPersistence(auth, browserLocalPersistence);
} catch (err) {
  console.warn("Auth persistence unavailable:", err);
}

export {
  onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, signOut,
  doc, getDoc, setDoc, serverTimestamp
};
