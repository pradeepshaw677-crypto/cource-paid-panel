// ═══════════════════════════════════════════════════════════════
//  FIREBASE CONFIG  —  Smart Tech (project: smart-tech-d6528)
//  Modular SDK 10.8.1. The web apiKey is PUBLIC by design; real
//  protection comes from Firestore Security Rules + Firebase Auth.
// ═══════════════════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCJ9vr7y4_4tbQ4TtEc_D9AxaBqL4XqjiE",
    authDomain: "smart-tech-d6528.firebaseapp.com",
    projectId: "smart-tech-d6528",
    storageBucket: "smart-tech-d6528.firebasestorage.app",
    messagingSenderId: "609442300839",
    appId: "1:609442300839:web:4b49a90937f05a01042c82",
    measurementId: "G-YSV2PD1MNV"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth, firebaseConfig };
