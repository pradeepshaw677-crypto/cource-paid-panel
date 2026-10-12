// ═══════════════════════════════════════════════════════════════
//  ADMISSIONS ADMIN LOGIC  (admission.html)  — hardened
//  • Realtime onSnapshot (stats + cards update bina refresh ke)
//  • Every field from the PUBLIC admission form is escaped (esc)
//    before innerHTML — this is the #1 stored-XSS sink, now closed
//  • Approve / Delete use data-id + an in-memory lookup (no user
//    data ever concatenated into an onclick string)
//  • Admin allowlist guard (activates once ADMIN_EMAILS is set)
// ═══════════════════════════════════════════════════════════════
import { app, auth, firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    onAuthStateChanged, signOut, getAuth, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, deleteField
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
    esc, safeTel, isAdminEmail, adminListConfigured, studentEmail
} from './security.js';

const db = getFirestore(app);

// ── SECONDARY AUTH APP (student accounts banane ke liye) ─────────
// Admin ki apni login session ko chhede bina naye student auth user
// banate hain — isliye ek alag (secondary) Firebase app instance.
function getSecondaryAuth() {
    const name = "stCourseSecondary";
    const existing = getApps().find(a => a.name === name);
    const app2 = existing || initializeApp(firebaseConfig, name);
    return getAuth(app2);
}

async function createStudentAuthUser(username, password) {
    const secAuth = getSecondaryAuth();
    try {
        const cred = await createUserWithEmailAndPassword(secAuth, studentEmail(username), password);
        return cred.user.uid;
    } finally {
        try { await signOut(secAuth); } catch (_) {}
    }
}

function authErrMessage(err) {
    switch (err.code) {
        case 'auth/operation-not-allowed':
            return 'Console me Email/Password sign-in ENABLE karo (Authentication → Sign-in method).';
        case 'auth/email-already-in-use':
            return 'Ye username pehle se kisi aur admission me use ho chuka hai — username badlo.';
        case 'auth/weak-password':
            return 'Password kam se kam 6 character ka hona chahiye.';
        case 'auth/invalid-email':
            return 'Username valid nahi hai (spaces/special chars hatao).';
        default:
            return err.message || 'Auth error';
    }
}

// ── AUTH / ADMIN GUARD ───────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (!user) {
        alert("Unauthorized Access.");
        window.location.href = "login.html";
        return;
    }
    if (adminListConfigured() && !isAdminEmail(user.email)) {
        alert("This account is not an administrator.");
        signOut(auth).then(() => { window.location.href = "login.html"; });
    }
});

const logoutBtn = document.getElementById('admin-logout-btn');
if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "login.html"));

// ── ALERT ────────────────────────────────────────────────────────
function showAlert(msg, isSuccess) {
    const alertBox = document.getElementById('admin-alert');
    const alertMsg = document.getElementById('admin-alert-msg');
    const alertIcon = document.getElementById('admin-alert-icon');
    if (!alertBox || !alertMsg || !alertIcon) return;
    alertBox.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800');
    if (isSuccess) {
        alertBox.classList.add('bg-green-100', 'text-green-800');
        alertIcon.className = "fa-solid fa-circle-check text-xl";
    } else {
        alertBox.classList.add('bg-red-100', 'text-red-800');
        alertIcon.className = "fa-solid fa-triangle-exclamation text-xl";
    }
    alertMsg.innerText = msg;                 // innerText — safe
    setTimeout(() => { alertBox.classList.add('hidden'); }, 4000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── IN-MEMORY LOOKUP (so buttons never carry user data) ──────────
const admissionsById = {};

// ── RENDER ───────────────────────────────────────────────────────
function renderAdmissions(snap) {
    const grid = document.getElementById('admissions-grid');
    if (!grid) return;

    for (const k in admissionsById) delete admissionsById[k];

    if (snap.empty) {
        document.getElementById('stat-total').textContent = "0";
        document.getElementById('stat-pending').textContent = "0";
        document.getElementById('stat-approved').textContent = "0";
        grid.innerHTML = '<div class="col-span-full text-center py-10 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500 font-bold"><i class="fa-regular fa-folder-open text-3xl mb-2 block"></i> No admissions found.</div>';
        return;
    }

    const admissions = [];
    let countTotal = 0, countPending = 0, countApproved = 0;

    snap.forEach(d => {
        const data = d.data() || {};
        admissions.push({ id: d.id, ...data });
        admissionsById[d.id] = data;
        countTotal++;
        if (data.status === "Approved") countApproved++; else countPending++;
    });

    document.getElementById('stat-total').textContent = countTotal;
    document.getElementById('stat-pending').textContent = countPending;
    document.getElementById('stat-approved').textContent = countApproved;

    admissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    let html = '';
    admissions.forEach(data => {
        const isApproved = data.status === "Approved";
        const cd = data.courseDetails || {};
        const dateObj = data.submittedAt ? new Date(data.submittedAt) : new Date();
        const formattedDate = isNaN(dateObj.getTime())
            ? ''
            : dateObj.toLocaleDateString('en-IN') + ' ' + dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        const feeAmountText = data.feeType === 'Monthly'
            ? `<span class="text-orange-500">₹${esc(cd.mon)}</span> <span class="text-gray-400 font-normal">/ month</span>`
            : `<span class="text-brandGold">₹${esc(cd.total)}</span> <span class="text-gray-400 font-normal">(Full)</span>`;

        const userDisplay = data.dashboardUser || '-';
        // Naye (secured) accounts ka password Firestore me hota hi nahi —
        // sirf purane legacy records me plaintext bacha hoga.
        const passDisplay = data.authUid
            ? '🔒 secured (Firebase Auth)'
            : (data.dashboardPass || '-');
        const credBgClass = (isApproved && data.dashboardUser) ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200';
        const credTextClass = (isApproved && data.dashboardUser) ? 'text-green-600' : 'text-gray-500';
        const credIconClass = (isApproved && data.dashboardUser) ? 'text-green-300' : 'text-gray-300';
        const tel = safeTel(data.mobile);

        html += `
            <div class="bg-white rounded-2xl shadow-lg border-2 ${isApproved ? 'border-green-400 shadow-green-100' : 'border-blue-100'} p-5 flex flex-col justify-between hover:-translate-y-1 transition duration-300">
                <div class="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                    <div>
                        <h3 class="font-black text-xl text-gray-800 leading-tight">${esc(data.name)}</h3>
                        <p class="text-[10px] text-gray-400 mt-1 font-bold uppercase"><i class="fa-solid fa-envelope mr-1"></i> ${esc(data.email)}</p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${isApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">
                        ${isApproved ? '<i class="fa-solid fa-check-double mr-1"></i> Approved' : '<i class="fa-solid fa-hourglass-half mr-1"></i> Pending'}
                    </span>
                </div>

                <div class="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100 space-y-2">
                    <div class="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Course</span>
                        <span class="text-sm font-black text-brandBlue">${esc(data.course)}</span>
                    </div>
                    <div class="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Mode &amp; Duration</span>
                        <span class="text-xs font-bold text-gray-700">${esc(data.feeType)} | ${esc(cd.dur)}</span>
                    </div>
                    <div class="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Adm. Fee</span>
                        <span class="text-xs font-bold text-green-600">₹${esc(cd.adm)}</span>
                    </div>
                    <div class="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Fee details</span>
                        <span class="text-sm font-black">${feeAmountText}</span>
                    </div>
                    <div class="flex justify-between items-center pt-1">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Timing</span>
                        <span class="text-xs font-bold text-gray-700 text-right w-1/2">${esc(data.timing)}</span>
                    </div>
                </div>

                <div class="mb-4 px-1">
                    <p class="text-[10px] font-bold text-gray-400 uppercase mb-1">Address / Village</p>
                    <p class="text-xs font-medium text-gray-600 leading-tight">${esc(data.address)}, ${esc(data.state)} - ${esc(data.pin)}</p>
                </div>

                <div class="${credBgClass} border rounded-xl p-3 mb-4 flex justify-between items-center transition-colors">
                    <div>
                        <p class="text-[9px] ${credTextClass} font-bold uppercase tracking-wider mb-1">Assigned Credentials</p>
                        <p class="text-xs font-bold text-gray-800"><span class="text-gray-500 font-medium">User:</span> ${esc(userDisplay)}</p>
                        <p class="text-xs font-bold text-gray-800"><span class="text-gray-500 font-medium">Pass:</span> ${esc(passDisplay)}</p>
                    </div>
                    <i class="fa-solid fa-key ${credIconClass} text-2xl"></i>
                </div>

                <div class="mt-auto border-t border-gray-100 pt-4 space-y-3">
                    <a href="tel:${esc(tel)}" class="w-full flex items-center justify-center gap-2 bg-blue-50 text-brandBlue hover:bg-blue-100 font-bold py-2.5 rounded-xl transition text-sm">
                        <i class="fa-solid fa-phone-volume"></i> Call ${esc(data.mobile)}
                    </a>
                    <div class="flex gap-2">
                        ${!isApproved
                            ? `<button data-approve="${esc(data.id)}" class="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2.5 rounded-xl transition shadow-md"><i class="fa-solid fa-thumbs-up mr-1"></i> Approve</button>`
                            : `<button disabled class="flex-1 bg-gray-100 text-gray-400 text-xs font-bold py-2.5 rounded-xl cursor-not-allowed"><i class="fa-solid fa-check"></i> Approved</button>`}
                        <button data-delete="${esc(data.id)}" class="bg-red-50 hover:bg-red-500 text-red-500 hover:text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                    <p class="text-[9px] text-gray-400 font-bold text-center mt-2"><i class="fa-regular fa-clock"></i> Applied on: ${esc(formattedDate)}</p>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;

    grid.querySelectorAll('[data-approve]').forEach(btn => {
        btn.addEventListener('click', () => openApproveModal(btn.getAttribute('data-approve')));
    });
    grid.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => deleteAdmission(btn.getAttribute('data-delete')));
    });
}

// ── REALTIME LISTENER ────────────────────────────────────────────
onSnapshot(collection(db, "offline_admissions"), renderAdmissions, (e) => {
    console.error(e);
    const grid = document.getElementById('admissions-grid');
    if (grid) grid.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold">Failed to load admissions. Check internet connection.</div>';
});

// ── APPROVE MODAL ────────────────────────────────────────────────
const approveModal = document.getElementById('approve-modal');

function openApproveModal(id) {
    const data = admissionsById[id];
    if (!data) return;
    document.getElementById('modal-student-id').value = id;
    document.getElementById('modal-student-name').textContent = `Student: ${data.name || ''}`;   // textContent — safe

    const name = String(data.name || '');
    const phone = String(data.mobile || '');
    const shortName = name.split(' ')[0].substring(0, 4);
    document.getElementById('assign-username').value = `ST_${shortName}${phone.substring(6)}`;
    document.getElementById('assign-password').value = `Pass@123`;

    approveModal.classList.remove('hidden');
}

function closeApproveModal() {
    if (approveModal) approveModal.classList.add('hidden');
}

async function confirmApproval() {
    const id = document.getElementById('modal-student-id').value;
    const user = document.getElementById('assign-username').value.trim();
    const pass = document.getElementById('assign-password').value.trim();
    const btn = document.getElementById('btn-confirm-approve');

    if (!user || !pass) { alert("Please assign both Username and Password."); return; }
    if (pass.length < 6) { alert("Password kam se kam 6 character ka hona chahiye."); return; }
    if (!/^[A-Za-z0-9_.-]+$/.test(user)) { alert("Username me sirf letters, numbers, _ . - allowed hain (space nahi)."); return; }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Approving...';
    btn.disabled = true;

    try {
        // 1) Firebase Auth me student ka account banao (hidden synthesized email).
        //    Password sirf yahi use hota hai — Firestore me kabhi store nahi hota.
        const uid = await createStudentAuthUser(user, pass);

        // 2) Admission doc update: authUid link karo, purana plaintext pass hatao.
        await setDoc(doc(db, "offline_admissions", id), {
            status: "Approved",
            dashboardUser: user,
            authUid: uid,
            authEmail: studentEmail(user),
            approvedAt: new Date().toISOString(),
            dashboardPass: deleteField()
        }, { merge: true });

        closeApproveModal();
        // 3) Credentials admin ko EK BAAR dikhao (baad me Firestore me nahi milenge).
        alert("✅ Admission Approved!\n\nStudent ko ye credentials do:\nUsername: " + user + "\nPassword: " + pass + "\n\n(Ye password ab sirf Firebase Auth me secure hai — dobara kahin stored nahi hai, to abhi note/copy kar lo.)");
        showAlert("Admission Approved & student account secured!", true);
    } catch (e) {
        showAlert("Approve fail: " + authErrMessage(e), false);
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Approve';
        btn.disabled = false;
    }
}

async function deleteAdmission(id) {
    if (!id) return;
    if (confirm("Are you sure you want to permanently delete this application?")) {
        try {
            await deleteDoc(doc(db, "offline_admissions", id));
            showAlert("Application Deleted.", true);
        } catch (e) { showAlert("Error deleting: " + e.message, false); }
    }
}

// Wire the static modal buttons (were inline onclick before).
document.getElementById('btn-confirm-approve').addEventListener('click', confirmApproval);
document.getElementById('btn-cancel-approve').addEventListener('click', closeApproveModal);

// Refresh button — data is already realtime, so just acknowledge it.
const refreshBtn = document.getElementById('refresh-btn');
if (refreshBtn) refreshBtn.addEventListener('click', () => showAlert("Data live hai — apne aap update hota rehta hai.", true));
