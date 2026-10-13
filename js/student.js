// ═══════════════════════════════════════════════════════════════
//  STUDENT DASHBOARD  (student.html)  — secure
//  Login = dashboardUser + password, verified by FIREBASE AUTH
//  (hidden synthesized email). Password Firestore me store nahi hota.
//  Student sirf apna data padh sakta hai (rules authUid se lock).
// ═══════════════════════════════════════════════════════════════
import { app, auth } from './firebase-config.js';
import {
    signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    getFirestore, collection, doc, getDoc, getDocs, query, where, limit
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
    esc, safeImgUrl, safeMediaUrl, studentEmail
} from './security.js';

const db = getFirestore(app);

const loginScreen = document.getElementById('login-screen');
const dashScreen = document.getElementById('dashboard-screen');

function sAlert(msg, ok) {
    const box = document.getElementById('s-alert');
    box.classList.remove('hidden', 'bg-blue-50', 'text-blue-700', 'bg-amber-50', 'text-amber-700');
    box.classList.add(ok === false ? 'bg-amber-50' : 'bg-blue-50', ok === false ? 'text-amber-700' : 'text-blue-700');
    box.textContent = msg;                 // textContent — safe
}

function friendly(err) {
    switch (err.code) {
        case 'auth/invalid-email':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': return '❌ Username ya password galat hai.';
        case 'auth/too-many-requests': return '⚠️ Bahut baar try kiya. Thodi der baad karein.';
        default: return '❌ ' + (err.message || 'Login failed.');
    }
}

function showLogin() {
    dashScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
}
function showDashboard() {
    loginScreen.classList.add('hidden');
    dashScreen.classList.remove('hidden');
}

// ── LOGIN ────────────────────────────────────────────────────────
const loginForm = document.getElementById('student-login-form');
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('s-error');
    errBox.textContent = '';
    const user = document.getElementById('s-user').value.trim();
    const pass = document.getElementById('s-pass').value;
    const btn = document.getElementById('s-login-btn');
    if (!user || !pass) { errBox.textContent = '❌ Username aur password dono bharo.'; return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
    try {
        await signInWithEmailAndPassword(auth, studentEmail(user), pass);
        // onAuthStateChanged dashboard load karega
    } catch (err) {
        errBox.textContent = friendly(err);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login';
    }
});

document.getElementById('s-logout-btn').addEventListener('click', () => {
    signOut(auth).catch(() => {});
});

// ── SESSION ──────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) { showLogin(); return; }
    showDashboard();
    await loadDashboard(user.uid);
});

// ── LOAD STUDENT DATA ────────────────────────────────────────────
async function loadDashboard(uid) {
    const coursesBox = document.getElementById('s-courses');
    try {
        // 1) Apna admission record (authUid se) — sirf apna hi milega.
        const q = query(collection(db, "offline_admissions"), where("authUid", "==", uid), limit(1));
        const admSnap = await getDocs(q);
        if (admSnap.empty) {
            document.getElementById('s-student-name').textContent = '';
            coursesBox.innerHTML = '<div class="col-span-full text-center py-10 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500 font-bold">Account kisi admission se linked nahi hai. Admin se contact karo.</div>';
            return;
        }
        const adm = admSnap.docs[0].data();
        document.getElementById('s-student-name').textContent = adm.name || '';

        // 2) Kaun se courses unlock hain — docId = student ka AUTH UID
        //    (admin isi uid par grant karta hai, isliye hamesha match hoga).
        let unlocked = {};
        const uDoc = await getDoc(doc(db, "unlocked_courses", uid));
        if (uDoc.exists()) unlocked = uDoc.data() || {};

        // 3) Saare courses → sirf unlocked dikhao.
        const cSnap = await getDocs(collection(db, "courses"));
        const myCourses = [];
        cSnap.forEach(d => { if (unlocked[d.id] === true) myCourses.push({ id: d.id, ...(d.data() || {}) }); });

        renderCourses(myCourses);

        // 4) Centre assets.
        await loadCentreAssets();
    } catch (e) {
        console.error(e);
        coursesBox.innerHTML = '<div class="col-span-full text-center py-10 text-red-500 font-bold">Data load nahi hua: ' + esc(e.message) + '</div>';
    }
}

function renderCourses(courses) {
    const box = document.getElementById('s-courses');
    if (!courses.length) {
        box.innerHTML = '<div class="col-span-full text-center py-10 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500 font-bold"><i class="fa-solid fa-lock text-3xl mb-2 block"></i> Abhi koi course unlock nahi hai. Admin se access lo.</div>';
        return;
    }
    box.innerHTML = '';
    courses.forEach(c => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col';
        const thumb = safeImgUrl(c.thumb);
        const videos = Array.isArray(c.videos) ? c.videos : [];
        card.innerHTML = `
            ${thumb ? `<img src="${esc(thumb)}" alt="" class="w-full h-36 object-cover">` : `<div class="w-full h-36 bg-brandBlue/10 flex items-center justify-center text-brandBlue text-4xl"><i class="fa-solid fa-video"></i></div>`}
            <div class="p-4 flex-1 flex flex-col">
                <h3 class="font-bold text-gray-800 leading-tight mb-2">${esc(c.title)}</h3>
                <p class="text-[10px] text-gray-400 font-bold uppercase mb-3">${videos.length} lecture${videos.length === 1 ? '' : 's'}</p>
                <div class="space-y-2 mt-auto">
                    ${videos.map((v, i) => {
                        const url = safeMediaUrl(v && v.url);
                        const title = esc((v && v.title) || ('Lecture ' + (i + 1)));
                        return url
                            ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-brandBlue font-bold text-xs px-3 py-2.5 rounded-lg transition"><i class="fa-solid fa-circle-play"></i> ${title}</a>`
                            : `<div class="flex items-center gap-2 bg-gray-50 text-gray-400 font-bold text-xs px-3 py-2.5 rounded-lg"><i class="fa-solid fa-ban"></i> ${title}</div>`;
                    }).join('')}
                </div>
            </div>
        `;
        box.appendChild(card);
    });
}

async function loadCentreAssets() {
    const section = document.getElementById('s-centre-section');
    const ids = ['teacher', 'teacherCert', 'studentCert', 'centreVideo'];
    let any = false;
    try {
        const snaps = await Promise.all(ids.map(id => getDoc(doc(db, "assets", id))));
        const get = i => (snaps[i].exists() ? (snaps[i].data() || {}).url : '');

        const teacher = safeImgUrl(get(0));
        if (teacher) { document.getElementById('s-teacher-img').src = teacher; document.getElementById('s-teacher-box').classList.remove('hidden'); any = true; }

        const tcert = safeImgUrl(get(1));
        if (tcert) { document.getElementById('s-tcert-img').src = tcert; document.getElementById('s-tcert-box').classList.remove('hidden'); any = true; }

        const scert = safeImgUrl(get(2));
        if (scert) { document.getElementById('s-scert-img').src = scert; document.getElementById('s-scert-box').classList.remove('hidden'); any = true; }

        const video = safeMediaUrl(get(3));
        if (video) { document.getElementById('s-centre-video').src = video; document.getElementById('s-video-box').classList.remove('hidden'); any = true; }
    } catch (e) { console.error(e); }
    if (any) section.classList.remove('hidden');
}
