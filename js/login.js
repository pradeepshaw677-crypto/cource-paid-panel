// ═══════════════════════════════════════════════════════════════
//  ADMIN LOGIN LOGIC  (login.html)
//  Firebase Auth email/password. If already signed in → dashboard.
//  The allowlist warning is advisory; the server-side firestore.rules
//  is what actually blocks non-admin writes/reads.
// ═══════════════════════════════════════════════════════════════
import { auth } from './firebase-config.js';
import {
    signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { isAdminEmail, adminListConfigured, normalizeEmail } from './security.js';

const emailInput = document.getElementById('login-email');
const passInput = document.getElementById('login-password');
const form = document.getElementById('login-form');
const btn = document.getElementById('login-btn');
const errorBox = document.getElementById('login-error');

function setError(msg) { if (errorBox) errorBox.textContent = msg || ''; }

function friendly(err) {
    switch (err.code) {
        case 'auth/invalid-email': return '❌ Email address galat hai.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': return '❌ Email ya password galat hai.';
        case 'auth/too-many-requests': return '⚠️ Bahut baar try kiya. Thodi der baad karein.';
        default: return '❌ ' + (err.message || 'Login failed.');
    }
}

// Already-signed-in admin goes straight to the dashboard.
onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "index.html";
});

if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('');
    const email = normalizeEmail(emailInput.value);
    const pass = passInput.value;
    if (!email || !pass) { setError('❌ Email aur password dono bharo.'); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

    try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        if (adminListConfigured() && !isAdminEmail(cred.user.email)) {
            await signOut(auth);
            setError('⛔ Ye account admin nahi hai.');
            return;
        }
        window.location.href = "index.html";
    } catch (err) {
        setError(friendly(err));
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login';
    }
});
