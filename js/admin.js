// ═══════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD LOGIC  (index.html)  — hardened
//  • Realtime onSnapshot lists (updates bina refresh ke)
//  • Every DB value escaped with esc() before innerHTML  (anti-XSS)
//  • Delete buttons use data-id + addEventListener (no inline onclick
//    built from user data → no injection)
//  • Admin allowlist guard (activates once ADMIN_EMAILS is set)
// ═══════════════════════════════════════════════════════════════
import { app, auth } from './firebase-config.js';
import {
    onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    getFirestore, collection, doc, setDoc, deleteDoc, addDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
    esc, safeImgUrl, safeMediaUrl, isAdminEmail, adminListConfigured, normalizeEmail
} from './security.js';

const db = getFirestore(app);

// ── AUTH / ADMIN GUARD ───────────────────────────────────────────
let currentAdminEmail = null;

onAuthStateChanged(auth, (user) => {
    if (!user) {
        alert("Unauthorized Access.");
        window.location.href = "login.html";
        return;
    }
    currentAdminEmail = user.email;
    // Only enforce the allowlist once a real admin email is configured,
    // so a placeholder can never lock the real admin out.
    if (adminListConfigured() && !isAdminEmail(user.email)) {
        alert("This account is not an administrator.");
        signOut(auth).then(() => { window.location.href = "login.html"; });
    }
});

function bindLogout(id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => signOut(auth).then(() => window.location.href = "login.html"));
}
bindLogout('admin-logout-btn');
bindLogout('admin-logout-mobile');

// ── BASE64 CONVERTOR ─────────────────────────────────────────────
async function getBase64FromFile(fileInputId) {
    const input = document.getElementById(fileInputId);
    const file = input && input.files[0];
    if (!file) return null;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ── REALTIME RENDERERS ───────────────────────────────────────────
function renderCourses(snap) {
    const select = document.getElementById('course-select');
    const list = document.getElementById('existing-courses-list');
    if (!select || !list) return;

    select.innerHTML = '<option value="" disabled selected>-- Select a Course --</option>';
    list.innerHTML = '';

    if (snap.empty) {
        list.innerHTML = '<p class="text-xs text-gray-400 py-2">No courses found.</p>';
        return;
    }

    snap.forEach((docSnap) => {
        const id = docSnap.id;
        const data = docSnap.data() || {};

        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = data.title || '(untitled)';   // textContent — safe
        select.appendChild(opt);

        const row = document.createElement('div');
        row.className = "flex justify-between items-center bg-gray-50 border border-gray-200 p-3 rounded-xl";
        row.innerHTML = `
            <div><h4 class="font-bold text-sm text-gray-800">${esc(data.title)}</h4></div>
            <button data-del-course="${esc(id)}" class="bg-red-100 text-red-600 w-8 h-8 rounded-lg"><i class="fa-solid fa-trash-can"></i></button>
        `;
        list.appendChild(row);
    });

    list.querySelectorAll('[data-del-course]').forEach(btn => {
        btn.addEventListener('click', () => deleteCourse(btn.getAttribute('data-del-course')));
    });
}

function renderImages(snap, listId, kind) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '';
    const aspect = kind === 'banner' ? 'h-16' : 'aspect-square';

    snap.forEach(d => {
        const data = d.data() || {};
        const src = safeImgUrl(data.url);
        const cell = document.createElement('div');
        cell.className = `relative group rounded-lg overflow-hidden border border-gray-200 ${aspect}`;
        cell.innerHTML = `
            <img src="${esc(src)}" class="w-full h-full object-cover">
            <button data-del-${kind}="${esc(d.id)}" class="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100"><i class="fa-solid fa-trash text-red-500"></i></button>
        `;
        list.appendChild(cell);
    });

    list.querySelectorAll(`[data-del-${kind}]`).forEach(btn => {
        btn.addEventListener('click', () => deleteImage(kind, btn.getAttribute(`data-del-${kind}`)));
    });
}

// ── REALTIME LISTENERS ───────────────────────────────────────────
onSnapshot(collection(db, "courses"),  renderCourses,  e => console.error(e));
onSnapshot(collection(db, "banners"),  s => renderImages(s, 'existing-banners-list', 'banner'), e => console.error(e));
onSnapshot(collection(db, "gallery"),  s => renderImages(s, 'existing-gallery-list', 'gallery'), e => console.error(e));

// ── DELETE ───────────────────────────────────────────────────────
async function deleteCourse(id) {
    if (!id) return;
    if (confirm("Delete this course?")) {
        try { await deleteDoc(doc(db, "courses", id)); }
        catch (e) { showAlert("Error: " + e.message, false); }
    }
}
async function deleteImage(kind, id) {
    if (!id) return;
    const col = kind === 'banner' ? 'banners' : 'gallery';
    if (confirm(kind === 'banner' ? "Delete banner?" : "Delete image?")) {
        try { await deleteDoc(doc(db, col, id)); }
        catch (e) { showAlert("Error: " + e.message, false); }
    }
}

// ── ADD COURSE ───────────────────────────────────────────────────
const addCourseForm = document.getElementById('add-course-form');
if (addCourseForm) addCourseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-course');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    showAlert("Saving to Database...", 'loading');

    try {
        let thumbUrl = await getBase64FromFile('course-thumb-file');
        if (!thumbUrl) thumbUrl = document.getElementById('course-thumb-url').value;

        const videos = [];
        document.querySelectorAll('.video-row').forEach(row => {
            const title = row.querySelector('.vid-title').value;
            const url = row.querySelector('.vid-url').value;
            if (title && url) videos.push({ title, url });
        });

        await addDoc(collection(db, "courses"), {
            title: document.getElementById('course-title').value,
            price: parseInt(document.getElementById('course-price').value, 10) || 0,
            thumb: thumbUrl || "",
            videos: videos,
            createdAt: new Date().toISOString()
        });

        showAlert("Course Published!", true);
        e.target.reset();
        document.getElementById('preview-course-thumb-container').classList.add('hidden');
        // reset video rows back to a single empty one
        const vc = document.getElementById('video-fields-container');
        vc.innerHTML = '';
        addVideoField();
    } catch (error) {
        showAlert("Error: " + error.message, false);
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Publish Course';
    }
});

// ── GRANT / REVOKE ACCESS ────────────────────────────────────────
const accessForm = document.getElementById('access-form');
if (accessForm) accessForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = normalizeEmail(document.getElementById('student-email').value);
    const courseId = document.getElementById('course-select').value;
    if (!email || !courseId) { showAlert("Email and course dono zaroori hai.", false); return; }
    try {
        await setDoc(doc(db, "unlocked_courses", email), { [courseId]: true }, { merge: true });
        showAlert("Access Granted", true);
        e.target.reset();
    } catch (err) { showAlert("Error: " + err.message, false); }
});

const lockBtn = document.getElementById('btn-lock');
if (lockBtn) lockBtn.addEventListener('click', async () => {
    const email = normalizeEmail(document.getElementById('student-email').value);
    const courseId = document.getElementById('course-select').value;
    if (!email || !courseId) { showAlert("Email and course dono zaroori hai.", false); return; }
    if (confirm("Lock course?")) {
        try {
            await setDoc(doc(db, "unlocked_courses", email), { [courseId]: false }, { merge: true });
            showAlert("Access Revoked", true);
            document.getElementById('access-form').reset();
        } catch (err) { showAlert("Error: " + err.message, false); }
    }
});

// ── CENTRE ASSETS ────────────────────────────────────────────────
const assetsForm = document.getElementById('assets-form');
if (assetsForm) assetsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-update-assets');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
    showAlert("Saving Assets...", 'loading');

    try {
        const teacherUrl = await getBase64FromFile('asset-teacher-file') || document.getElementById('asset-teacher').value;
        if (teacherUrl) await setDoc(doc(db, "assets", 'teacher'), { url: teacherUrl }, { merge: true });

        const tCertUrl = await getBase64FromFile('asset-tcert-file') || document.getElementById('asset-teacherCert').value;
        if (tCertUrl) await setDoc(doc(db, "assets", 'teacherCert'), { url: tCertUrl }, { merge: true });

        const sCertUrl = await getBase64FromFile('asset-scert-file') || document.getElementById('asset-studentCert').value;
        if (sCertUrl) await setDoc(doc(db, "assets", 'studentCert'), { url: sCertUrl }, { merge: true });

        const videoUrl = document.getElementById('asset-centreVideo').value;
        if (videoUrl) await setDoc(doc(db, "assets", 'centreVideo'), { url: safeMediaUrl(videoUrl) }, { merge: true });

        showAlert("Assets updated successfully!", true);
        e.target.reset();
        ['preview-teacher-container', 'preview-tcert-container', 'preview-scert-container'].forEach(id => {
            const el = document.getElementById(id); if (el) el.classList.add('hidden');
        });
    } catch (err) {
        showAlert(err.message, false);
    } finally {
        btn.innerHTML = 'Update All Assets';
    }
});

// ── ADD BANNER ───────────────────────────────────────────────────
const bannerForm = document.getElementById('banner-form');
if (bannerForm) bannerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-add-banner');
    btn.innerHTML = 'Saving...';
    try {
        const url = await getBase64FromFile('banner-file') || document.getElementById('banner-url').value;
        if (url) {
            await addDoc(collection(db, "banners"), { url: url, createdAt: new Date().toISOString() });
            showAlert("Banner added!", true);
            e.target.reset();
            document.getElementById('preview-banner-container').classList.add('hidden');
        }
    } catch (err) { showAlert(err.message, false); }
    finally { btn.innerHTML = 'Upload Banner'; }
});

// ── ADD GALLERY ──────────────────────────────────────────────────
const galleryForm = document.getElementById('gallery-form');
if (galleryForm) galleryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-add-gallery');
    btn.innerHTML = 'Saving...';
    try {
        const url = await getBase64FromFile('gallery-file') || document.getElementById('gallery-url').value;
        if (url) {
            await addDoc(collection(db, "gallery"), { url: url, createdAt: new Date().toISOString() });
            showAlert("Image added!", true);
            e.target.reset();
            document.getElementById('preview-gallery-container').classList.add('hidden');
        }
    } catch (err) { showAlert(err.message, false); }
    finally { btn.innerHTML = 'Upload to Gallery'; }
});
