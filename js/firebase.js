import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, signOut,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp
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

const app = initializeApp(firebaseConfig);
let analytics = null;
try { if (await isSupported()) analytics = getAnalytics(app); } catch (_) {}

const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence);
const db = getFirestore(app);

const gameRef = uid => doc(db, "players", uid, "game", "state");

async function loadGame(uid) {
  const snap = await getDoc(gameRef(uid));
  return snap.exists() ? snap.data() : null;
}
async function createGame(uid, email) {
  const state = window.FarmGame.defaultState();
  state.email = email || "";
  await setDoc(gameRef(uid), {...state, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
  return state;
}
async function saveGame(uid, state) {
  await setDoc(gameRef(uid), {...state, updatedAt: serverTimestamp()}, {merge:true});
}
async function register(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}
async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}
async function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}
async function logout() { return signOut(auth); }

window.FirebaseGame = { auth, db, onAuthStateChanged, loadGame, createGame, saveGame, register, login, resetPassword, logout };
