═══════════════════════════════════════════════════════════════════
  SMART TECH — "Cource Paid Panel"  |  SECURITY SETUP GUIDE
═══════════════════════════════════════════════════════════════════

Folder structure (sab kuch isi tarah upload karna, repo ke ROOT me):

  Cource Paid Panel/
  ├── login.html          (Admin login)
  ├── index.html          (Admin dashboard)
  ├── admission.html      (Admissions admin — approve/assign)
  ├── apply.html          (PUBLIC admission form — student apply kare)
  ├── student.html        (Student dashboard — secure login)
  ├── firestore.rules     (⚠️ DRAFT — publish karna ZAROORI hai)
  ├── firebase.json
  ├── .gitignore
  ├── css/styles.css
  └── js/
      ├── firebase-config.js
      ├── security.js     (escaping + admin allowlist + student auth)
      ├── ui.js           (tabs / previews / alerts)
      ├── admin.js        (index.html)
      ├── admissions.js   (admission.html)
      ├── apply.js        (apply.html)
      ├── login.js        (login.html)
      └── student.js      (student.html)

Pages ka flow:
  apply.html  → public form, "offline_admissions" me Pending entry
  admission.html → admin approve karta hai, username+password assign
  student.html → student wahi username+password se login (Firebase Auth)
  index.html  → admin courses/access/centre manage karta hai


───────────────────────────────────────────────────────────────────
  KYA-KYA SECURE KIYA
───────────────────────────────────────────────────────────────────
1. STORED XSS band — admission form ka har field (name/email/address/
   course/fee/mobile/username) admin panel me esc() se escape hota hai.
2. Inline onclick injection band — Approve/Delete ab data-id +
   addEventListener se (user-data string me concat nahi hota).
3. CSP + X-Content-Type-Options + referrer headers — sabhi pages par.
4. PASSWORD AB PLAINTEXT ME NAHI — admin jab approve karta hai, ek
   Firebase Auth account banta hai (hidden email: username@smarttech-
   course.app). Firestore me sirf authUid store hota hai, password
   kabhi nahi. Purana plaintext dashboardPass approve par delete ho
   jaata hai. Credentials admin ko ek baar alert me dikhte hain.
5. STUDENT LOGIN = Firebase Auth — student dashboard sirf apna data
   padh sakta hai (rules authUid se lock). Anonymous read band.
6. Realtime (bina refresh) — admin lists onSnapshot se live.
7. safe URL helpers — javascript:/vbscript: image/video src me block.


───────────────────────────────────────────────────────────────────
  ⚠️ PUBLISH KARNE SE PEHLE — 3 KAAM (Console me, tumhe khud karna)
───────────────────────────────────────────────────────────────────

  KAAM 1 — Authentication ON karo:
     Firebase Console → Authentication → Sign-in method →
     "Email/Password" = ENABLE.
     • Admin ka account banao (ya pehle se hai).
     • Student accounts approve par apne aap banenge (sign-up bhi
       isi setting se chalta hai).

  KAAM 2 — Admin email set karo (2 jagah, SAME value):
     a) js/security.js  →  ADMIN_EMAILS = [ "tumhara-admin@email.com" ]
     b) firestore.rules →  'REPLACE_WITH_YOUR_ADMIN_EMAIL@example.com'
        ki jagah wahi email.
     (Ye wahi email hai jis se login.html par sign-in karte ho.)

  KAAM 3 — Firestore Rules PUBLISH karo:
     Console → Firestore Database → Rules → poora firestore.rules
     paste karo → PUBLISH.
     ➜ Sabse zaroori step. Isi se anonymous data-read band hota hai.


───────────────────────────────────────────────────────────────────
  NOTE
───────────────────────────────────────────────────────────────────
• login.html, apply.html aur student.html maine khud banaye hain
  (original me missing the). Brand (Smart Tech / blue-gold) match kiya.
• apply.html courses dropdown "courses" collection se bharta hai.
  Course me price hai to dikhega; duration/admFee/monthlyFee fields
  course doc me honge to admission card me bhi dikhenge (optional).
• Purane already-approved students (jinme plaintext dashboardPass tha)
  abhi Firebase Auth me nahi hain. Unhe dobara approve karo ya
  naya username+password assign karo taaki Auth account ban jaaye.


───────────────────────────────────────────────────────────────────
  GITHUB PAGES UPLOAD (404 se bachne ka tareeka)
───────────────────────────────────────────────────────────────────
Repo ke ROOT me index.html hona chahiye — folder ke andar folder
mat bana dena:
  1. "Cource Paid Panel" folder KOLO.
  2. Andar ki SAARI cheezein select karo (Ctrl+A).
  3. Unhe GitHub repo me drag karo (folder ko nahi, contents ko).
  4. Settings → Pages → branch = main / root → Save.
  5. URLs:
       Admin login : https://<user>.github.io/<repo>/login.html
       Apply form  : https://<user>.github.io/<repo>/apply.html
       Student     : https://<user>.github.io/<repo>/student.html
