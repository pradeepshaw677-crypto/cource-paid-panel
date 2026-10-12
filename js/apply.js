// ═══════════════════════════════════════════════════════════════
//  PUBLIC ADMISSION FORM  (apply.html)
//  Koi bhi apply kar sakta hai — Firestore rules sirf 'Pending'
//  status ke saath create allow karte hain, aur dashboardUser/Pass
//  set karne se rok dete hain (koi self-approve nahi kar sakta).
// ═══════════════════════════════════════════════════════════════
import { app } from './firebase-config.js';
import {
    getFirestore, collection, getDocs, addDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const db = getFirestore(app);

const courseSelect = document.getElementById('f-course');
const coursesById = {};

function showApplyAlert(msg, ok) {
    const box = document.getElementById('apply-alert');
    if (!box) return;
    box.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800');
    box.classList.add(ok ? 'bg-green-100' : 'bg-red-100', ok ? 'text-green-800' : 'text-red-800');
    box.textContent = msg;                 // textContent — safe
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Load courses into the dropdown (public read) ─────────────────
async function loadCourses() {
    try {
        const snap = await getDocs(collection(db, "courses"));
        courseSelect.innerHTML = '<option value="" disabled selected>-- Select a Course --</option>';
        if (snap.empty) {
            courseSelect.innerHTML = '<option value="">No courses available yet</option>';
            return;
        }
        snap.forEach(d => {
            const data = d.data() || {};
            coursesById[d.id] = data;
            const opt = document.createElement('option');
            opt.value = d.id;
            const price = data.price ? ` — ₹${data.price}` : '';
            opt.textContent = `${data.title || '(untitled)'}${price}`;   // textContent — safe
            courseSelect.appendChild(opt);
        });
    } catch (e) {
        courseSelect.innerHTML = '<option value="">Could not load courses</option>';
        console.error(e);
    }
}
loadCourses();

// ── Submit ───────────────────────────────────────────────────────
const form = document.getElementById('apply-form');
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-apply');

    const name = document.getElementById('f-name').value.trim();
    const email = document.getElementById('f-email').value.trim().toLowerCase();
    const mobile = document.getElementById('f-mobile').value.trim();
    const courseId = courseSelect.value;
    const feeType = document.getElementById('f-feeType').value;
    const timing = document.getElementById('f-timing').value;
    const address = document.getElementById('f-address').value.trim();
    const state = document.getElementById('f-state').value.trim();
    const pin = document.getElementById('f-pin').value.trim();

    if (!name || !email || !mobile || !courseId || !address || !state || !pin) {
        showApplyAlert('❌ Sabhi zaroori fields bharo.', false);
        return;
    }

    const course = coursesById[courseId] || {};

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

    try {
        await addDoc(collection(db, "offline_admissions"), {
            name, email, mobile,
            course: course.title || '',
            courseId: courseId,
            feeType, timing,
            address, state, pin,
            // Course se jo fee info available hai wahi store karte hain.
            courseDetails: {
                total: course.price || '',
                mon: course.monthlyFee || '',
                dur: course.duration || '',
                adm: course.admFee || ''
            },
            status: 'Pending',
            submittedAt: new Date().toISOString()
        });

        form.reset();
        showApplyAlert('✅ Application submit ho gayi! Admin approve karke tumhe username & password dega.', true);
    } catch (err) {
        showApplyAlert('❌ Submit fail: ' + err.message, false);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1"></i> Submit Application';
    }
});
