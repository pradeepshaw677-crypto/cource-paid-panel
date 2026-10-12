// ═══════════════════════════════════════════════════════════════
//  SECURITY HELPERS  (ES module)
//  Central place for output-escaping, safe URL handling and the
//  admin allowlist. Every piece of data that comes from Firestore
//  or from a public form MUST pass through esc() before it is put
//  into innerHTML — this is what stops stored XSS.
// ═══════════════════════════════════════════════════════════════

// ── ADMIN ALLOWLIST ──────────────────────────────────────────────
// ⚠️  REPLACE THIS with the real admin login email(s) for the
//     smart-tech-d6528 Firebase project BEFORE you publish the
//     Firestore rules. Until you do, the client-side admin check
//     stays disabled (so it can never lock you out by accident);
//     the real enforcement is the server-side firestore.rules.
export const ADMIN_EMAILS = [
    "REPLACE_WITH_YOUR_ADMIN_EMAIL@example.com"
];

const PLACEHOLDER = "REPLACE_WITH_YOUR_ADMIN_EMAIL@example.com";

// True only once a real email has been put in the list above.
export function adminListConfigured() {
    return ADMIN_EMAILS.some(e => e && e !== PLACEHOLDER);
}

export function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

export function isAdminEmail(email) {
    const e = normalizeEmail(email);
    return ADMIN_EMAILS.some(a => normalizeEmail(a) === e);
}

// ── STUDENT AUTH (dashboard login) ───────────────────────────────
// Admin jitna dashboardUser+password assign karta hai, uska ek hidden
// Firebase Auth account banta hai is synthesized email ke saath. Student
// wahi user+pass type karta hai; email kabhi kisi ko dikhta/likhna nahi
// padta. Password Firestore me PLAINTEXT me kabhi store nahi hota.
export const STUDENT_AUTH_DOMAIN = "smarttech-course.app";

export function studentEmail(username) {
    return normalizeEmail(username) + "@" + STUDENT_AUTH_DOMAIN;
}

// ── OUTPUT ESCAPING (anti-XSS) ───────────────────────────────────
// Escapes the 5 characters that can break out of HTML text or an
// attribute value. Use for EVERY dynamic value in innerHTML.
export function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ── SAFE URL HANDLERS ────────────────────────────────────────────
// Allow only harmless image sources (data:/blob: for base64 uploads,
// http(s): for pasted URLs). Blocks javascript:, vbscript:, data:text/html.
export function safeImgUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(u)) return u;
    if (/^blob:/i.test(u)) return u;
    if (/^https?:\/\//i.test(u)) return u;
    return "";
}

// Media (video) URLs — never allow data: here, only http(s)/blob.
export function safeMediaUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (/^blob:/i.test(u)) return u;
    if (/^https?:\/\//i.test(u)) return u;
    return "";
}

// tel: links — allow only digits, +, spaces, dashes.
export function safeTel(value) {
    const v = String(value || "").replace(/[^\d+\-\s]/g, "").trim();
    return v;
}
