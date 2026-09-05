// firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyDummyKeyForDemo",
    authDomain: "modz-wep.firebaseapp.com",
    projectId: "modz-wep",
    storageBucket: "modz-wep.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// إعدادات Firestore
db.settings({ timestampsInSnapshots: true });