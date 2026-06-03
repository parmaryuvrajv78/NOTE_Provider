/* ============================================
   Shniro Notes - Super Admin Dashboard Logic
   ============================================ */

(function () {
    if (!DataStore.isLoggedIn() || !DataStore.isSuperAdmin()) {
        window.location.href = 'index.html';
        return;
    }
    if (localStorage.getItem('sn_theme') === 'dark') document.body.classList.add('dark');
})();

const currentSuperAdmin = DataStore.getCurrentUser();
function renderAvatar(el, currentUser, fallback = 'S') {
    if (!el) return;
    const initial = currentUser && currentUser.name ? currentUser.name[0].toUpperCase() : fallback;
    el.textContent = '';
    if (currentUser && currentUser.profileImageUrl) {
        const img = document.createElement('img');
        img.src = safeAssetUrl(currentUser.profileImageUrl);
        img.alt = currentUser.name || 'Profile';
        el.appendChild(img);
        el.classList.add('has-image');
    } else {
        el.textContent = initial;
        el.classList.remove('has-image');
    }
}

if (currentSuperAdmin) {
    const navUser = document.querySelector('.nav-user');
    const avatar = navUser && navUser.querySelector('.avatar-circle');
    const label = navUser && navUser.querySelector('span');
    renderAvatar(avatar, currentSuperAdmin);
    if (label) label.textContent = currentSuperAdmin.name || 'Super Admin';
}

function showToast(msg, type = 'info') {
    const box = document.getElementById('toastBox');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    box.appendChild(toast);
    setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 300); }, 3500);
}

function esc(str) {
    if (str === null || str === undefined) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}

function attr(str) {
    return esc(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function jsArg(value) {
    return attr(JSON.stringify(String(value || '')));
}

function safeAssetUrl(value) {
    const raw = String(value || '').trim();
    if (/^https?:\/\//i.test(raw) || /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(raw)) return raw;
    return '';
}

function apiMaterialUrl(action, materialId, userId) {
    return `${API_BASE}/materials/${action}/${encodeURIComponent(materialId)}?userId=${encodeURIComponent(userId || '')}`;
}

function refreshCurrentUserProfileUi() {
    const updated = DataStore.getCurrentUser();
    if (!updated) return;
    renderAvatar(document.getElementById('superAdminProfileAvatar'), updated);
    const navUser = document.querySelector('.nav-user');
    const label = navUser && navUser.querySelector('span');
    if (label) label.textContent = updated.name || 'Super Admin';
}

function openEditProfileModal() {
    const current = DataStore.getCurrentUser();
    if (!current) return;
    document.getElementById('profileName').value = current.name || '';
    document.getElementById('profileInstituteName').value = current.instituteName || '';
    document.getElementById('profileBranch').value = current.branch || '';
    document.getElementById('profileSemester').value = current.semester || '';
    document.getElementById('profileImageFile').value = '';
    document.getElementById('editProfileModal').style.display = 'flex';
}

function closeEditProfileModal() {
    document.getElementById('editProfileModal').style.display = 'none';
}

async function saveCurrentUserProfile(e) {
    e.preventDefault();
    const file = document.getElementById('profileImageFile').files[0];

    try {
        const details = {
            name: document.getElementById('profileName').value.trim(),
            instituteName: document.getElementById('profileInstituteName').value.trim(),
            branch: document.getElementById('profileBranch').value.trim(),
            semester: document.getElementById('profileSemester').value.trim()
        };

        if (!details.name || !details.instituteName) {
            showToast('Name and institution are required', 'error');
            return;
        }

        if (file && (!file.type || !file.type.startsWith('image/'))) {
            showToast('Please select an image file', 'error');
            return;
        }

        const btn = document.getElementById('saveProfileBtn');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        const res = await DataStore.updateProfile(details, file);
        if (res.success) {
            refreshCurrentUserProfileUi();
            closeEditProfileModal();
            showToast('Profile updated', 'success');
        } else {
            showToast(res.message || 'Profile update failed', 'error');
        }
    } catch (err) {
        showToast('Profile update failed', 'error');
    } finally {
        const btn = document.getElementById('saveProfileBtn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Save';
        }
    }
}

function avatarText(name, fallback = 'U') {
    return esc((name || fallback)[0].toUpperCase());
}

function adminName(user) {
    if (!user || !user.adminId) return 'Unassigned';
    if (typeof user.adminId === 'string') return user.adminId;
    return user.adminId.instituteName || user.adminId.name || user.adminId.adminCode || user.adminId.rollNo || 'Admin';
}

async function refreshData() {
    try {
        const data = await DataStore.getSuperAdminData();
        if (data.success === false) throw new Error(data.message || 'Failed');

        renderPendingAdmins(data.pendingAdmins || []);
        renderAdmins(data.admins || []);
        renderStudents(data.pendingStudents || [], data.students || []);
        renderMaterials(data.materials || []);

        document.getElementById('statPendingAdmins').textContent = (data.pendingAdmins || []).length;
        document.getElementById('statAdmins').textContent = (data.admins || []).length;
        document.getElementById('statStudents').textContent = (data.students || []).length;
        document.getElementById('statMaterials').textContent = (data.materials || []).length;
    } catch (err) {
        showToast('Failed to load super admin data', 'error');
    }
}

function renderPendingAdmins(admins) {
    const list = document.getElementById('pendingAdminsList');
    const empty = document.getElementById('pendingAdminsEmpty');
    list.innerHTML = '';
    if (!admins.length) { list.style.display = 'none'; empty.style.display = 'block'; return; }
    list.style.display = 'block'; empty.style.display = 'none';

    admins.forEach(admin => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle">${avatarText(admin.name, 'A')}</div>
                <div>
                    <div class="user-name">${esc(admin.name)} <span class="nav-tag">${esc(admin.instituteName || 'Institute')}</span></div>
                    <div class="user-meta">Admin ID: ${esc(admin.adminCode || admin.phone || admin.rollNo)} | Mobile: ${esc(admin.phone || '-')}</div>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn btn-primary btn-sm" onclick="approveAdmin(${jsArg(admin.id)})">Approve</button>
                <button class="btn btn-ghost btn-sm" onclick="rejectAdmin(${jsArg(admin.id)})" style="color:var(--error)">Reject</button>
            </div>
        `;
        list.appendChild(row);
    });
}

function renderAdmins(admins) {
    const list = document.getElementById('adminsList');
    const empty = document.getElementById('adminsEmpty');
    list.innerHTML = '';
    if (!admins.length) { list.style.display = 'none'; empty.style.display = 'block'; return; }
    list.style.display = 'block'; empty.style.display = 'none';

    admins.forEach(admin => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle">${avatarText(admin.name, 'A')}</div>
                <div>
                    <div class="user-name">${esc(admin.name)} <span class="nav-tag">${esc(admin.instituteName || 'Institute')}</span></div>
                    <div class="user-meta">Admin ID: ${esc(admin.adminCode || admin.phone || admin.rollNo)} | Mobile: ${esc(admin.phone || '-')}</div>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn btn-ghost btn-sm" onclick="removeAdmin(${jsArg(admin.id)})" style="color:var(--error)">Remove</button>
            </div>
        `;
        list.appendChild(row);
    });
}

function renderStudents(pending, students) {
    const pendingList = document.getElementById('pendingStudentsList');
    const list = document.getElementById('studentsList');
    const empty = document.getElementById('studentsEmpty');
    pendingList.innerHTML = '';
    list.innerHTML = '';

    pending.forEach(student => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle">${avatarText(student.name, 'S')}</div>
                <div>
                    <div class="user-name">${esc(student.name)} <span class="nav-tag">PENDING</span></div>
                    <div class="user-meta">${esc(student.instituteName || '')} | ${esc(student.rollNo)} | ${esc(student.enrollNo)} | Admin: ${esc(adminName(student))}</div>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn btn-primary btn-sm" onclick="approveStudent(${jsArg(student.id)})">Approve</button>
                <button class="btn btn-ghost btn-sm" onclick="rejectStudent(${jsArg(student.id)})" style="color:var(--error)">Reject</button>
            </div>
        `;
        pendingList.appendChild(row);
    });

    students.forEach(student => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle">${avatarText(student.name, 'S')}</div>
                <div>
                    <div class="user-name">${esc(student.name)}</div>
                    <div class="user-meta">${esc(student.instituteName || '')} | ${esc(student.rollNo)} | Plan: ${esc(student.plan || 'free')} | Admin: ${esc(adminName(student))}</div>
                </div>
            </div>
            <div class="user-actions">
                ${student.plan === 'pro' ? '' : `<button class="btn btn-primary btn-sm" onclick="upgradeStudent(${jsArg(student.id)})">Upgrade</button>`}
                <button class="btn btn-ghost btn-sm" onclick="removeStudent(${jsArg(student.id)})" style="color:var(--error)">Remove</button>
            </div>
        `;
        list.appendChild(row);
    });

    const hasStudents = pending.length || students.length;
    pendingList.style.display = pending.length ? 'block' : 'none';
    list.style.display = students.length ? 'block' : 'none';
    empty.style.display = hasStudents ? 'none' : 'block';
}

function renderMaterials(materials) {
    const list = document.getElementById('materialsAdminList');
    list.innerHTML = '';
    if (!materials.length) {
        list.innerHTML = '<div class="empty-state"><h3>No materials yet</h3></div>';
        return;
    }

    materials.forEach(mat => {
        const owner = mat.createdBy && typeof mat.createdBy === 'object'
            ? (mat.createdBy.name || mat.createdBy.rollNo || 'Admin')
            : 'Unassigned';
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle" style="background:var(--blue-light); color:var(--blue)">N</div>
                <div>
                    <div class="user-name">${esc(mat.title)}</div>
                    <div class="user-meta">${esc(mat.subject)} | ${esc(mat.size)} | Owner: ${esc(owner)}</div>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn-icon-tile" onclick="window.location.href = apiMaterialUrl('view', ${jsArg(mat.id)}, currentSuperAdmin.id)" title="View" style="color:var(--blue); background:var(--blue-light);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="btn-icon-tile" onclick="deleteMat(${jsArg(mat.id)})" title="Delete" style="color:var(--error); background:rgba(231,76,60,0.1);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `;
        list.appendChild(row);
    });
}

async function approveAdmin(id) {
    const res = await DataStore.approveAdmin(id);
    showToast(res.success ? 'Admin approved' : res.message || 'Approval failed', res.success ? 'success' : 'error');
    if (res.success) refreshData();
}

async function rejectAdmin(id) {
    const res = await DataStore.rejectAdmin(id);
    showToast(res.success ? 'Admin request rejected' : res.message || 'Reject failed', res.success ? 'info' : 'error');
    if (res.success) refreshData();
}

async function removeAdmin(id) {
    if (!confirm('Remove this admin? Their students will become pending and unassigned.')) return;
    const res = await DataStore.removeAdmin(id);
    showToast(res.success ? 'Admin removed' : res.message || 'Remove failed', res.success ? 'success' : 'error');
    if (res.success) refreshData();
}

async function approveStudent(id) {
    const res = await DataStore.approveStudent(id);
    showToast(res.success ? 'Student approved' : res.message || 'Approval failed', res.success ? 'success' : 'error');
    if (res.success) refreshData();
}

async function rejectStudent(id) {
    const res = await DataStore.rejectStudent(id);
    showToast(res.success ? 'Student request rejected' : res.message || 'Reject failed', res.success ? 'info' : 'error');
    if (res.success) refreshData();
}

async function removeStudent(id) {
    if (!confirm('Remove this student?')) return;
    const res = await DataStore.removeStudent(id);
    showToast(res.success ? 'Student removed' : res.message || 'Remove failed', res.success ? 'success' : 'error');
    if (res.success) refreshData();
}

async function upgradeStudent(id) {
    const res = await DataStore.upgradeStudent(id);
    showToast(res.success ? 'Student upgraded to Pro' : res.message || 'Upgrade failed', res.success ? 'success' : 'error');
    if (res.success) refreshData();
}

async function deleteMat(id) {
    if (!confirm('Delete material?')) return;
    const res = await DataStore.deleteMaterial(id);
    showToast(res.success ? 'Material deleted' : res.message || 'Delete failed', res.success ? 'success' : 'error');
    if (res.success) refreshData();
}

function toggleUploadForm() {
    const form = document.getElementById('uploadForm');
    const area = document.getElementById('uploadArea');
    const visible = form.style.display === 'block';
    form.style.display = visible ? 'none' : 'block';
    area.style.display = visible ? 'block' : 'none';
}

function updateUploadFields() {
    const val = document.getElementById('matCategory').value;
    const videoSource = document.getElementById('matVideoSource').value;
    const fileGroup = document.getElementById('fileFieldGroup');
    const linkGroup = document.getElementById('linkFieldGroup');
    const quizGroup = document.getElementById('quizFieldGroup');
    const videoSourceGroup = document.getElementById('videoSourceGroup');
    const fileInput = document.getElementById('matFile');
    const linkInput = document.getElementById('matLink');
    const fileLabel = document.getElementById('matFileLabel');

    if (val === 'Video') {
        videoSourceGroup.style.display = 'block';
        quizGroup.style.display = 'none';
        const useFile = videoSource === 'file';
        fileGroup.style.display = useFile ? 'block' : 'none';
        linkGroup.style.display = useFile ? 'none' : 'block';
        fileInput.required = useFile;
        linkInput.required = !useFile;
        fileInput.accept = useFile ? 'video/*' : '';
        fileLabel.textContent = useFile ? 'Select Video File' : 'Select File';
    } else if (val === 'Quiz') {
        videoSourceGroup.style.display = 'none';
        fileGroup.style.display = 'none';
        linkGroup.style.display = 'none';
        quizGroup.style.display = 'block';
        fileInput.required = false;
        linkInput.required = false;
    } else {
        videoSourceGroup.style.display = 'none';
        fileGroup.style.display = 'block';
        linkGroup.style.display = 'none';
        quizGroup.style.display = 'none';
        fileInput.required = true;
        linkInput.required = false;
        fileInput.accept = '.pdf,.doc,.docx,.ppt,.pptx,.txt';
        fileLabel.textContent = 'Select File';
    }
}

document.getElementById('matCategory').addEventListener('change', updateUploadFields);
document.getElementById('matVideoSource').addEventListener('change', updateUploadFields);
updateUploadFields();

document.getElementById('addMaterialForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('uploadBtn');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    const category = document.getElementById('matCategory').value;
    const formData = new FormData();
    formData.append('title', document.getElementById('matTitle').value);
    formData.append('subject', document.getElementById('matSubject').value);
    formData.append('category', category);

    if (category === 'Video') {
        const videoSource = document.getElementById('matVideoSource').value;
        formData.append('videoSource', videoSource);
        if (videoSource === 'file') {
            const file = document.getElementById('matFile').files[0];
            if (!file) { showToast('Please select a video file', 'error'); btn.disabled = false; btn.textContent = 'Upload'; return; }
            formData.append('file', file);
        } else {
            const link = document.getElementById('matLink').value.trim();
            if (!link) { showToast('Please enter a video link', 'error'); btn.disabled = false; btn.textContent = 'Upload'; return; }
            formData.append('link', link);
        }
    } else if (category === 'Quiz') {
        const questions = [];
        document.querySelectorAll('.question-input-group').forEach(group => {
            const q = group.querySelector('.question-text').value.trim();
            const options = Array.from(group.querySelectorAll('.option-input')).map(opt => opt.value.trim());
            const correct = parseInt(group.querySelector('.correct-answer-select').value);
            const explanation = group.querySelector('.explanation-input').value.trim();
            if (q && options.filter(Boolean).length >= 2) questions.push({ question: q, options, correctAnswer: correct, explanation });
        });
        if (!questions.length) { showToast('Add at least one complete question', 'error'); btn.disabled = false; btn.textContent = 'Upload'; return; }
        formData.append('questions', JSON.stringify(questions));
    } else {
        const file = document.getElementById('matFile').files[0];
        if (!file) { showToast('Please select a file', 'error'); btn.disabled = false; btn.textContent = 'Upload'; return; }
        formData.append('file', file);
    }

    try {
        const res = await DataStore.uploadMaterial(formData);
        showToast(res.success ? 'Uploaded successfully' : res.message || 'Upload failed', res.success ? 'success' : 'error');
        if (res.success) {
            document.getElementById('addMaterialForm').reset();
            document.getElementById('questionsContainer').innerHTML = '';
            updateUploadFields();
            toggleUploadForm();
            refreshData();
        }
    } catch (err) {
        showToast('Upload failed', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Upload';
    }
});

function addQuizQuestion() {
    const container = document.getElementById('questionsContainer');
    const qNum = container.querySelectorAll('.question-input-group').length + 1;
    const questionGroup = document.createElement('div');
    questionGroup.className = 'question-input-group';
    questionGroup.innerHTML = `
        <div class="question-card-head">
            <label>Question ${qNum}</label>
            <button type="button" onclick="this.closest('.question-input-group').remove()" class="btn btn-ghost btn-inline">Remove</button>
        </div>
        <input type="text" class="question-text input-box" placeholder="Enter question" required>
        <div class="options-grid">
            <input type="text" class="option-input input-box" placeholder="Option 1">
            <input type="text" class="option-input input-box" placeholder="Option 2">
            <input type="text" class="option-input input-box" placeholder="Option 3">
            <input type="text" class="option-input input-box" placeholder="Option 4">
        </div>
        <div class="answer-grid">
            <select class="correct-answer-select input-box" required><option value="">Correct answer</option><option value="0">Option 1</option><option value="1">Option 2</option><option value="2">Option 3</option><option value="3">Option 4</option></select>
            <input type="text" class="explanation-input input-box" placeholder="Explanation (optional)">
        </div>
    `;
    container.appendChild(questionGroup);
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
    });
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    DataStore.logout();
    window.location.href = 'index.html';
});
document.getElementById('editProfileBtn')?.addEventListener('click', openEditProfileModal);
document.getElementById('closeEditProfileModal')?.addEventListener('click', closeEditProfileModal);
document.getElementById('cancelEditProfileBtn')?.addEventListener('click', closeEditProfileModal);
document.getElementById('editProfileForm')?.addEventListener('submit', saveCurrentUserProfile);
document.getElementById('editProfileModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'editProfileModal') closeEditProfileModal();
});

refreshData();
