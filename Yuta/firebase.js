import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
    getFirestore, doc, getDoc, setDoc, updateDoc, increment,
    collection, addDoc, query, where, orderBy, limit, getDocs,
    serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
    getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD-2M-M0y1I1JdD99N51HIZ0a2q3JogMuk",
    authDomain: "ai-mods1234.firebaseapp.com",
    projectId: "ai-mods1234",
    storageBucket: "ai-mods1234.firebasestorage.app",
    messagingSenderId: "1062647392775",
    appId: "1:1062647392775:web:f0da1e2925bd812c4518a2",
    measurementId: "G-PQ4LXJCKX5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let authReady = signInAnonymously(auth).catch(() => null);

function statsId(type, itemId) {
    return `${type}__${itemId}`;
}

async function registerView(type, itemId) {
    await authReady;
    if (!auth.currentUser) return;
    const key = `anime_view_${type}_${itemId}`;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
    const ref = doc(db, "stats", statsId(type, itemId));
    await setDoc(ref, {
        type, itemId,
        views: increment(1),
        updatedAt: serverTimestamp()
    }, { merge: true });
}

async function toggleLike(type, itemId) {
    await authReady;
    if (!auth.currentUser) throw new Error("لم يتم تسجيل الدخول");
    const userId = auth.currentUser.uid;
    const reactionRef = doc(db, "reactions", `${type}__${itemId}__${userId}`);
    const statsRef = doc(db, "stats", statsId(type, itemId));
    const snap = await getDoc(reactionRef);

    if (snap.exists()) {
        await deleteDoc(reactionRef);
        await setDoc(statsRef, { type, itemId, likes: increment(-1), updatedAt: serverTimestamp() }, { merge: true });
        return false;
    } else {
        await setDoc(reactionRef, { type, itemId, userId, createdAt: serverTimestamp() });
        await setDoc(statsRef, { type, itemId, likes: increment(1), updatedAt: serverTimestamp() }, { merge: true });
        return true;
    }
}

async function addComment(type, itemId, text) {
    await authReady;
    if (!auth.currentUser) throw new Error("لم يتم تسجيل الدخول");
    const clean = String(text || "").trim();
    if (!clean || clean.length > 500) throw new Error("التعليق غير صالح");
    return addDoc(collection(db, "comments"), {
        type, itemId, text: clean,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp()
    });
}

async function getComments(type, itemId) {
    try {
        const q = query(
            collection(db, "comments"),
            where("type", "==", type),
            where("itemId", "==", itemId),
            orderBy("createdAt", "desc"),
            limit(30)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
        const q = query(
            collection(db, "comments"),
            where("type", "==", type),
            where("itemId", "==", itemId),
            limit(30)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
}

async function getStats(type, itemId) {
    const snap = await getDoc(doc(db, "stats", statsId(type, itemId)));
    return snap.exists() ? snap.data() : { views: 0, likes: 0 };
}

async function getTopStats(max = 20) {
    try {
        const q = query(collection(db, "stats"), orderBy("views", "desc"), limit(max));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    } catch {
        return [];
    }
}

export {
    app, db, auth, onAuthStateChanged,
    registerView, toggleLike, addComment, getComments, getStats, getTopStats
};
