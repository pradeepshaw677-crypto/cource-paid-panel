// ═══════════════════════════════════════════════════════════════
//  UI HELPERS  (classic script — exposes global functions used by
//  the static inline handlers in the HTML). No Firebase, no user
//  data — purely presentational, so it is safe to keep global.
// ═══════════════════════════════════════════════════════════════

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    const active = document.getElementById(tabId);
    if (active) active.classList.add('active');

    ['btn-manage-access', 'btn-manage-courses', 'btn-manage-centre'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.className = "w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-xl font-medium transition text-sm";
    });
    ['mob-btn-manage-access', 'mob-btn-manage-courses', 'mob-btn-manage-centre'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.className = "py-3 text-gray-500 border-t-2 border-transparent font-medium text-[10px]";
    });

    const desk = document.getElementById(`btn-${tabId}`);
    if (desk) desk.className = "w-full flex items-center gap-3 px-4 py-3 bg-brandBlue text-white rounded-xl font-medium transition text-sm";
    const mob = document.getElementById(`mob-btn-${tabId}`);
    if (mob) mob.className = "py-3 text-brandBlue border-t-2 border-brandBlue font-bold text-[10px]";
}

function previewLocalFile(inputElement, mediaId, containerId) {
    const file = inputElement.files[0];
    if (!file) return;
    if (file.size > 1048576) {
        alert("Warning: This image is larger than 1MB. It might fail to save in database. Please use a smaller image.");
    }
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = document.getElementById(mediaId);
        if (img) img.src = e.target.result;
        const box = document.getElementById(containerId);
        if (box) box.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function updateUrlPreview(inputElement, mediaId, containerId) {
    const url = inputElement.value.trim();
    const img = document.getElementById(mediaId);
    const box = document.getElementById(containerId);
    if (url) {
        if (img) img.src = url;
        if (box) box.classList.remove('hidden');
    } else {
        if (box) box.classList.add('hidden');
    }
}

function addVideoField() {
    const container = document.getElementById('video-fields-container');
    if (!container) return;
    const rowCount = container.children.length + 1;
    const div = document.createElement('div');
    div.className = "video-row bg-gray-50 p-4 rounded-xl border border-gray-200 relative space-y-2";
    // Built with DOM APIs (no string interpolation) so nothing can inject markup.
    const title = document.createElement('input');
    title.type = 'text';
    title.placeholder = `Video Title (e.g. Class ${rowCount})`;
    title.required = true;
    title.className = "vid-title w-full bg-white border border-gray-200 text-sm rounded-lg p-2.5 outline-none";

    const url = document.createElement('input');
    url.type = 'url';
    url.placeholder = "Video URL (Cloudinary/Drive link)";
    url.required = true;
    url.className = "vid-url w-full bg-white border border-gray-200 text-sm rounded-lg p-2.5 outline-none";

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = "absolute -right-2 -top-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 text-xs shadow";
    rm.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    rm.addEventListener('click', () => div.remove());

    div.append(title, url, rm);
    container.appendChild(div);
}

function showAlert(msg, isSuccess) {
    const alertBox = document.getElementById('admin-alert');
    const alertMsg = document.getElementById('admin-alert-msg');
    const alertIcon = document.getElementById('admin-alert-icon');
    if (!alertBox || !alertMsg || !alertIcon) return;

    alertBox.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800', 'bg-blue-100', 'text-blue-800');
    if (isSuccess === true) {
        alertBox.classList.add('bg-green-100', 'text-green-800');
        alertIcon.className = "fa-solid fa-circle-check text-xl";
    } else if (isSuccess === false) {
        alertBox.classList.add('bg-red-100', 'text-red-800');
        alertIcon.className = "fa-solid fa-triangle-exclamation text-xl";
    } else {
        alertBox.classList.add('bg-blue-100', 'text-blue-800');
        alertIcon.className = "fa-solid fa-spinner fa-spin text-xl";
    }
    alertMsg.innerText = msg;              // innerText — never parses HTML
    if (isSuccess !== 'loading') {
        setTimeout(() => { alertBox.classList.add('hidden'); }, 5000);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
